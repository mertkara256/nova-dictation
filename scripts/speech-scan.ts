/**
 * Ses taraması (`npm run scan:speech`): `speech-cases.ts` içindeki her vakayı macOS'un
 * Yelda sesiyle seslendirip Whisper'a yazdırır. Whisper'ın yazdığı metin uygulamanın
 * düzenleyicisinden geçirilir ve sonucun beklenen olup olmadığına bakılır.
 *
 * Seçenekler:
 *   --category komut,dikte      yalnızca bu kategoriler (varsayılan: hepsi)
 *   --variant normal,gürültülü  sesin çeşitleri: normal, hızlı, yavaş, gürültülü (varsayılan: normal)
 *   --save                      sonuçları speech-scan-results.json dosyasına yazar
 *
 * Sonuçlar kayıtlı sonuçlarla karşılaştırılır: önceden doğru olup artık yanlış olan
 * vaka varsa çıkış kodu 1 olur. Gerekenler: macOS ve açık bir Whisper sunucusu
 * (`npm run whisper`). Yelda'nın sesi gerçek bir sesten farklıdır; tarama bir
 * değişikliğin eskiden çalışanı bozup bozmadığını gösterir, gerçek doğruluğu değil.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { concatAudio, decodeWav } from '../src/speech/audio.ts'
import { type WhisperClient, createWhisperClient } from '../src/speech/whisperClient.ts'
import { CATEGORIES, type Category, SCAN_CASES, type ScanCase, isAccepted } from './speech-cases.ts'

const WHISPER_URL = process.env.WHISPER_URL ?? 'http://127.0.0.1:8178'
const RESULTS_FILE = join(import.meta.dirname, 'speech-scan-results.json')
const SAMPLE_RATE = 16000
// Uygulamanın Whisper'a gönderdiği parçalardaki gibi: konuşmadan önce ve sonra kısa sessizlik.
const LEADING_SILENCE_MS = 300
const TRAILING_SILENCE_MS = 700
// Gürültülü çeşitte konuşmanın gürültüye oranı (desibel).
const NOISE_SNR_DB = 25

/** Sesin çeşitleri: konuşma hızı (`say -r`, dakikada kelime) ve arkaya eklenen gürültü. */
const VARIANTS = {
  normal: {},
  hızlı: { rate: 240 },
  yavaş: { rate: 120 },
  gürültülü: { noise: true },
} satisfies Record<string, { rate?: number; noise?: boolean }>

type Variant = keyof typeof VARIANTS

interface Result {
  heard: string
  ok: boolean
}

async function main() {
  const { values } = parseArgs({
    options: { category: { type: 'string' }, variant: { type: 'string' }, save: { type: 'boolean' } },
  })
  const categories = listOption(values.category, Object.keys(CATEGORIES), 'kategori') as Category[]
  const variants = listOption(values.variant ?? 'normal', Object.keys(VARIANTS), 'çeşit') as Variant[]

  if (process.platform !== 'darwin') {
    console.error("Ses taraması yalnızca macOS'ta çalışır; Türkçe ses macOS'un say komutuyla üretilir.")
    process.exit(1)
  }
  const client = createWhisperClient(WHISPER_URL)
  if (!(await client.isUp())) {
    console.error(`Whisper sunucusuna ulaşılamadı (${WHISPER_URL}). Önce "npm run whisper" çalıştırın.`)
    process.exit(1)
  }

  const saved: Record<string, Result> = existsSync(RESULTS_FILE) ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) : {}
  const results: Record<string, Result> = {}
  const summary: string[] = []
  let broken = 0
  let fixed = 0
  const dir = mkdtempSync(join(tmpdir(), 'nova-speech-'))
  try {
    for (const category of categories) {
      const cases = SCAN_CASES.filter((scanCase) => scanCase.category === category)
      for (const variant of variants) {
        console.log(`\n${CATEGORIES[category]} (${variant}, ${cases.length} vaka)`)
        let correct = 0
        for (const scanCase of cases) {
          const samples = speak(scanCase.say, variant, join(dir, 'say.wav'))
          const heard = (await transcribe(client, samples)).trim()
          const ok = isAccepted(scanCase, scanCase.outcome(heard))
          const key = resultKey(scanCase, variant)
          const before = saved[key]
          results[key] = { heard, ok }
          if (ok) correct++
          if (before && before.ok !== ok) {
            if (ok) fixed++
            else broken++
          }
          if (!ok || (before && !before.ok)) {
            const change = before && before.ok !== ok ? (ok ? ' (düzeldi)' : ' (YENİ)') : ''
            console.log(`  ${ok ? '✓' : '✗'} ${scanCase.key ? '⌃ ' : ''}“${scanCase.id}” → “${heard}”${change}`)
          }
        }
        summary.push(`  ${CATEGORIES[category]} (${variant}): ${correct}/${cases.length}`)
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  console.log(`\nDoğru sonuç verenler:\n${summary.join('\n')}`)
  if (Object.keys(saved).length > 0) {
    console.log(`Kayıtlı sonuçlara göre: ${broken} yeni hata, ${fixed} düzelen.`)
  }
  if (values.save) {
    // Artık olmayan vakaların sonuçları atılır.
    const known = new Set(
      SCAN_CASES.flatMap((scanCase) => (Object.keys(VARIANTS) as Variant[]).map((variant) => resultKey(scanCase, variant))),
    )
    const merged = { ...saved, ...results }
    const sorted = Object.fromEntries(
      Object.keys(merged).filter((key) => known.has(key)).sort().map((key) => [key, merged[key]]),
    )
    writeFileSync(RESULTS_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
    console.log(`Sonuçlar ${RESULTS_FILE} dosyasına yazıldı.`)
  }
  if (broken > 0) process.exit(1)
}

/** Virgülle ayrılmış seçenek; bilinmeyen bir ad verilirse çıkar. */
function listOption(value: string | undefined, known: string[], what: string): string[] {
  if (value === undefined) return known
  const names = value.split(',').map((name) => name.trim()).filter(Boolean)
  const unknown = names.filter((name) => !known.includes(name))
  if (unknown.length > 0) {
    console.error(`Bilinmeyen ${what}: ${unknown.join(', ')}. Seçenekler: ${known.join(', ')}`)
    process.exit(1)
  }
  return names
}

function resultKey(scanCase: ScanCase, variant: Variant): string {
  return `${scanCase.category} · ${variant} · ${scanCase.key ? '⌃ ' : ''}${scanCase.id}`
}

/** Sunucu boşta kalan bağlantıyı kapatmış olabilir; uygulamadaki gibi bir kez daha dener. */
async function transcribe(client: WhisperClient, samples: Float32Array): Promise<string> {
  try {
    return await client.transcribe(samples, SAMPLE_RATE)
  } catch {
    return client.transcribe(samples, SAMPLE_RATE)
  }
}

/** Metni Yelda sesiyle seslendirir; öncesine ve sonrasına kısa sessizlik koyar. */
function speak(text: string, variant: Variant, file: string): Float32Array {
  const { rate, noise } = VARIANTS[variant] as { rate?: number; noise?: boolean }
  const args = ['-v', 'Yelda', '--file-format=WAVE', `--data-format=LEI16@${SAMPLE_RATE}`, '-o', file]
  if (rate) args.push('-r', String(rate))
  execFileSync('say', [...args, text])
  const silence = (ms: number) => new Float32Array((SAMPLE_RATE * ms) / 1000)
  const samples = concatAudio([silence(LEADING_SILENCE_MS), decodeWav(readFileSync(file)).samples, silence(TRAILING_SILENCE_MS)])
  return noise ? withNoise(samples, text) : samples
}

/**
 * Sese beyaz gürültü ekler. Gürültü metinden türetilen sabit bir tohumla üretilir;
 * böylece her çalıştırmada aynı ses Whisper'a gider ve sonuçlar karşılaştırılabilir.
 */
function withNoise(samples: Float32Array, seedText: string): Float32Array {
  let power = 0
  for (const sample of samples) power += sample * sample
  const level = Math.sqrt(power / samples.length) / 10 ** (NOISE_SNR_DB / 20)
  const random = seededRandom(seedText)
  // Box-Muller: iki düzgün dağılımlı sayıdan bir normal dağılımlı sayı.
  return samples.map((sample) => sample + level * Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random()))
}

/** Metinden tohumlanan basit bir rastgele sayı üreteci (mulberry32). */
function seededRandom(text: string): () => number {
  let state = 0
  for (const char of text) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

await main()
