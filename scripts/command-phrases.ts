/**
 * Komut listesindeki her ifadeyi macOS'un Yelda sesiyle seslendirip Whisper'a yazdırır
 * ve yazılan metnin aynı komut olarak tanınıp tanınmadığını denetler
 * (`npm run scan:phrases`). Her ifade iki şekilde denenir: komut kelimesiyle
 * ("Nova, son cümleyi sil") ve ⌃ basılıyken söylenir gibi tek başına ("son cümleyi sil").
 * Beklenen komut, ifadenin düz yazısı aynı ayrıştırıcıdan geçirilerek bulunur.
 *
 * Gerekenler: macOS ve açık bir Whisper sunucusu (`npm run whisper`). Yelda'nın sesi
 * gerçek bir sesten farklıdır; buradaki sonuçlar kesin değil, Whisper'ın bir ifadeyi
 * nasıl yazmaya yatkın olduğunu gösteren ipuçlarıdır.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMAND_HELP } from '../src/commands/help.ts'
import { type ParsedSegment, parseCommandSpeech, parseSegment } from '../src/commands/parse.ts'
import { DEFAULT_WAKE_WORD } from '../src/commands/wakeWord.ts'
import { toLowerTr } from '../src/core/text.ts'
import { concatAudio, decodeWav } from '../src/speech/audio.ts'
import { type WhisperClient, createWhisperClient } from '../src/speech/whisperClient.ts'

const WHISPER_URL = process.env.WHISPER_URL ?? 'http://127.0.0.1:8178'
const SAMPLE_RATE = 16000
// Uygulamanın Whisper'a gönderdiği parçalardaki gibi: konuşmadan önce ve sonra kısa sessizlik.
const LEADING_SILENCE_MS = 300
const TRAILING_SILENCE_MS = 700

const VARIANTS = [
  { name: `“${DEFAULT_WAKE_WORD}” ile`, spoken: (phrase: string) => `${DEFAULT_WAKE_WORD}, ${phrase}.`, parse: parseSegment },
  { name: '⌃ ile', spoken: (phrase: string) => phrase, parse: parseCommandSpeech },
]

async function main() {
  if (process.platform !== 'darwin') {
    console.error("İfade taraması yalnızca macOS'ta çalışır; Türkçe ses macOS'un say komutuyla üretilir.")
    process.exit(1)
  }
  const client = createWhisperClient(WHISPER_URL)
  if (!(await client.isUp())) {
    console.error(`Whisper sunucusuna ulaşılamadı (${WHISPER_URL}). Önce "npm run whisper" çalıştırın.`)
    process.exit(1)
  }

  const phrases = COMMAND_HELP.flatMap((group) => group.commands.flatMap(({ say }) => say.split(' · ')))
  const dir = mkdtempSync(join(tmpdir(), 'nova-phrases-'))
  let tried = 0
  let rewritten = 0
  const failures: string[] = []
  try {
    for (const [index, phrase] of phrases.entries()) {
      for (const variant of VARIANTS) {
        const text = variant.spoken(phrase)
        const expected = commandsOf(variant.parse(text))
        if (!expected) {
          failures.push(`${variant.name} “${text}”: listedeki ifadenin kendisi komut olarak tanınmıyor`)
          continue
        }
        const heard = (await transcribe(client, speak(text, join(dir, `${index}.wav`)))).trim()
        tried++
        const recognized = commandsOf(variant.parse(heard)) === expected
        if (comparable(heard) !== comparable(text)) {
          if (recognized) rewritten++
          console.log(`${recognized ? '~' : '✗'} ${variant.name} “${text}” → “${heard}”`)
        }
        if (!recognized) failures.push(`${variant.name} “${text}” → “${heard}”`)
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  console.log(
    `\n${tried} deneme: ${tried - failures.length} doğru tanındı` +
      (rewritten ? ` (${rewritten} tanesi Whisper farklı yazdığı halde, “~” ile gösterilenler)` : '') +
      `, ${failures.length} tanınmadı.`,
  )
  if (failures.length > 0) console.log(`Tanınmayanlar:\n  ${failures.join('\n  ')}`)
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
function speak(text: string, file: string): Float32Array {
  execFileSync('say', ['-v', 'Yelda', '--file-format=WAVE', `--data-format=LEI16@${SAMPLE_RATE}`, '-o', file, text])
  const silence = (ms: number) => new Float32Array((SAMPLE_RATE * ms) / 1000)
  return concatAudio([silence(LEADING_SILENCE_MS), decodeWav(readFileSync(file)).samples, silence(TRAILING_SILENCE_MS)])
}

/** Ayrıştırılan komutlar, karşılaştırılabilir halde; metin ya da tanınmayan ifade kalırsa null. */
function commandsOf(parsed: ParsedSegment): string | null {
  if (parsed.unrecognized.length > 0) return null
  if (parsed.parts.some((part) => part.type === 'text' && part.text.trim())) return null
  const commands = parsed.parts.flatMap((part) => (part.type === 'command' ? [part.command] : []))
  // Komuttaki kelimeler ("yarın kelimesini sil") Whisper'da büyük harfle başlayabilir.
  return commands.length > 0 ? toLowerTr(JSON.stringify(commands)) : null
}

/** Karşılaştırma için: küçük harf ve noktalamasız. */
function comparable(text: string): string {
  return toLowerTr(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).join(' ')
}

await main()
