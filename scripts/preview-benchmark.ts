/**
 * Konuşurken gösterilen önizlemenin (gri metnin) kalitesini ölçer.
 *
 * Ses kayıtlarını mikrofondan geliyormuş gibi gerçek zamanlı çalar, uygulamanın
 * kullandığı Whisper akışından geçirir ve ekranda görünecek gri metni, yerine
 * geçen kesin metinle karşılaştırır.
 *
 * Kullanım (Whisper sunucusu açıkken, `npm run whisper`):
 *   npm run bench:preview -- kayit1.wav kayit2.wav
 *   npm run bench:preview -- --timeline kayit.wav   (gri metnin her halini de yazar)
 *
 * Kayıtlar 16 bit PCM WAV olmalı. macOS'ta örnek kayıt üretmek için:
 *   say -v Yelda -o kayit.aiff "Merhaba, yarınki toplantı saat onda."
 *   afconvert -f WAVE -d LEI16@48000 -c 1 kayit.aiff kayit.wav
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { toLowerTr } from '../src/core/text.ts'
import type { OpenMicrophone } from '../src/speech/microphone.ts'
import { createWhisperPreview } from '../src/speech/preview.ts'
import { createWhisperServerTranscriber } from '../src/speech/providers/whisperServer.ts'
import { createWhisperClient } from '../src/speech/whisperClient.ts'

const WHISPER_URL = process.env.WHISPER_URL ?? 'http://127.0.0.1:8178'
// Mikrofon sesi tarayıcıda yaklaşık bu aralıklarla gelir.
const BLOCK_MS = 20
// Son konuşma parçasının bitmesi için kaydın sonuna eklenen sessizlik.
const TRAILING_SILENCE_MS = 2000
// Konuşmanın başladığı ve bittiği yeri bulmak için (konuşma algılamadaki eşikle aynı).
const SPEECH_LEVEL = 0.01

interface TimelineEvent {
  /** Kaydın başından bu yana geçen süre (saniye). */
  at: number
  kind: 'partial' | 'final'
  text: string
}

interface ClipResult {
  name: string
  /** Gri metnin kaç kez değiştiği. */
  updates: number
  /** İki gri metin güncellemesi arasındaki ortalama süre (saniye). */
  meanInterval: number
  /** Konuşma başladıktan sonra ilk gri kelimenin görünmesine kadar geçen süre. */
  firstPreviewDelay: number
  /** Ekranda kalma süresiyle ağırlıklandırılmış yanlış gri kelime oranı. */
  wrongWordRate: number
  /** Bir güncellemede, daha önce gösterilip değişen ortalama kelime sayısı. */
  rewrittenPerUpdate: number
  /** Konuşurken, söylenip henüz ekranda (gri ya da kesin) görünmeyen ortalama kelime sayısı. */
  wordsBehind: number
  /** Konuşma bittikten sonra son kesin metnin gelmesine kadar geçen süre. */
  finalDelay: number
  finalText: string
}

async function main() {
  const args = process.argv.slice(2)
  const showTimeline = args.includes('--timeline')
  const files = args.filter((arg) => !arg.startsWith('--'))
  if (files.length === 0) {
    console.error('Kullanım: npm run bench:preview -- kayit1.wav kayit2.wav …')
    process.exit(1)
  }
  const client = createWhisperClient(WHISPER_URL)
  if (!(await client.isUp())) {
    console.error(`Whisper sunucusuna ulaşılamadı (${WHISPER_URL}). Önce "npm run whisper" çalıştırın.`)
    process.exit(1)
  }

  const results: ClipResult[] = []
  for (const file of files) {
    const { samples, sampleRate } = readWav(file)
    const timeline = await transcribeInRealTime(samples, sampleRate)
    if (showTimeline) printTimeline(basename(file), timeline)
    const result = measure(basename(file), timeline, speechActivity(samples, sampleRate))
    results.push(result)
    console.log(`${result.name}: ${result.finalText}`)
  }
  printTable(results)
}

/** Kaydı gerçek zamanlı çalarak uygulamadaki Whisper akışından geçirir. */
function transcribeInRealTime(samples: Float32Array, sampleRate: number): Promise<TimelineEvent[]> {
  const client = createWhisperClient(WHISPER_URL)
  const transcriber = createWhisperServerTranscriber({
    client,
    openMicrophone: playback(withSilence(samples, sampleRate), sampleRate, () => transcriber.stop()),
    preview: createWhisperPreview({ client }),
  })

  return new Promise((resolve, reject) => {
    const timeline: TimelineEvent[] = []
    const startedAt = performance.now()
    const at = () => (performance.now() - startedAt) / 1000
    transcriber.start({
      onPartial: (text) => timeline.push({ at: at(), kind: 'partial', text }),
      onFinal: (text) => timeline.push({ at: at(), kind: 'final', text }),
      onError: (error) => reject(new Error(`Konuşma tanıma hatası: ${error}`)),
      onEnd: () => resolve(timeline),
    })
  })
}

/** Kaydı küçük bloklar halinde, gerçek süresinde ileten sahte bir mikrofon. */
function playback(samples: Float32Array, sampleRate: number, onFinished: () => void): OpenMicrophone {
  return async (onAudio) => {
    const blockSize = Math.round((sampleRate * BLOCK_MS) / 1000)
    const startedAt = performance.now()
    let position = 0
    const timer = setInterval(() => {
      const due = Math.min(
        samples.length,
        Math.floor(((performance.now() - startedAt) / 1000) * sampleRate),
      )
      while (position < due) {
        const end = Math.min(position + blockSize, due)
        onAudio(samples.slice(position, end))
        position = end
      }
      if (position >= samples.length) {
        clearInterval(timer)
        onFinished()
      }
    }, BLOCK_MS)
    return { sampleRate, close: async () => clearInterval(timer) }
  }
}

/** Gri metin ile kesin metni karşılaştırıp ölçümleri hesaplar. */
function measure(name: string, timeline: TimelineEvent[], speech: SpeechActivity): ClipResult {
  const finals = timeline.filter((event) => event.kind === 'final').map((event) => event.text)
  const finalWords = words(finals.join(' '))

  let finalWordsSoFar = 0
  let previous: string[] = []
  let updates = 0
  let rewritten = 0
  let wrongWeighted = 0
  let shownWeighted = 0
  let firstPreviewAt: number | null = null
  const updateTimes: number[] = []
  // Her olaydan sonra ekranda görünen kelime sayısı (kesin + gri).
  const visible: { at: number; words: number }[] = []

  timeline.forEach((event, index) => {
    if (event.kind === 'final') {
      finalWordsSoFar += words(event.text).length
      visible.push({ at: event.at, words: finalWordsSoFar })
      previous = []
      return
    }
    const shown = words(event.text === '…' ? '' : event.text)
    visible.push({ at: event.at, words: finalWordsSoFar + shown.length })
    if (shown.length === 0) {
      previous = []
      return
    }
    // Gri metin, kesin metinde henüz yazılmamış kısmın başıyla karşılaştırılır.
    const errors = prefixDistance(shown, finalWords.slice(finalWordsSoFar))
    const duration = (timeline[index + 1]?.at ?? event.at) - event.at
    wrongWeighted += errors * duration
    shownWeighted += shown.length * duration

    if (previous.length > 0) rewritten += previous.length - commonPrefixLength(previous, shown)
    firstPreviewAt ??= event.at
    updates++
    updateTimes.push(event.at)
    previous = shown
  })

  // Konuşma süresince, o ana kadar söylenmiş kelimelerden kaçının henüz görünmediği.
  const behind: number[] = []
  for (let t = speech.start; t <= speech.end; t += 0.05) {
    const spoken = finalWords.length * speech.spokenShare(t)
    const shown = visible.findLast((entry) => entry.at <= t)?.words ?? 0
    behind.push(Math.max(0, spoken - shown))
  }

  const intervals = updateTimes.slice(1).map((time, i) => time - updateTimes[i])
  const lastFinalAt = timeline.findLast((event) => event.kind === 'final')?.at ?? NaN
  return {
    name,
    updates,
    meanInterval: average(intervals),
    firstPreviewDelay: (firstPreviewAt ?? NaN) - speech.start,
    wrongWordRate: shownWeighted > 0 ? wrongWeighted / shownWeighted : 0,
    rewrittenPerUpdate: updates > 1 ? rewritten / (updates - 1) : 0,
    wordsBehind: average(behind),
    finalDelay: lastFinalAt - speech.end,
    finalText: finals.join(' '),
  }
}

/** Karşılaştırma için kelimeler: küçük harf, noktalamasız. */
function words(text: string): string[] {
  return toLowerTr(text)
    .replace(/[^\p{L}\p{N}'’\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Gösterilen kelimeleri, kesin metnin en iyi uyan başlangıç kısmına dönüştürmek
 * için gereken en az kelime değişikliği (ekleme, silme, değiştirme).
 */
function prefixDistance(shown: string[], reference: string[]): number {
  let previous = Array.from({ length: reference.length + 1 }, () => 0)
  for (let i = 1; i <= shown.length; i++) {
    const current = [i]
    for (let j = 1; j <= reference.length; j++) {
      const substitution = previous[j - 1] + (shown[i - 1] === reference[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
    }
    previous = current
  }
  return Math.min(...previous)
}

function commonPrefixLength(a: string[], b: string[]): number {
  let length = 0
  while (length < a.length && length < b.length && a[length] === b[length]) length++
  return length
}

interface SpeechActivity {
  /** Konuşmanın başladığı ve bittiği an (saniye). */
  start: number
  end: number
  /** Verilen ana kadar konuşmanın ne kadarının söylendiği (0–1); sessiz anlar sayılmaz. */
  spokenShare(at: number): number
}

/** Kayıttaki konuşmalı anları bulur. Kelimelerin ne zaman söylendiğini kestirmek için. */
function speechActivity(samples: Float32Array, sampleRate: number): SpeechActivity {
  const frameSeconds = 0.03
  const frame = Math.round(sampleRate * frameSeconds)
  const speaking: number[] = []
  for (let offset = 0; offset + frame <= samples.length; offset += frame) {
    let sum = 0
    for (let i = offset; i < offset + frame; i++) sum += samples[i] * samples[i]
    if (Math.sqrt(sum / frame) >= SPEECH_LEVEL) speaking.push(offset / sampleRate)
  }
  return {
    start: speaking[0] ?? NaN,
    end: (speaking.at(-1) ?? NaN) + frameSeconds,
    spokenShare: (at) => speaking.filter((time) => time < at).length / speaking.length,
  }
}

function withSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const padded = new Float32Array(samples.length + (sampleRate * TRAILING_SILENCE_MS) / 1000)
  padded.set(samples)
  return padded
}

/** 16 bit PCM WAV dosyasını tek kanallı örneklere çevirir. */
function readWav(file: string): { samples: Float32Array; sampleRate: number } {
  const data = readFileSync(file)
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${file} bir WAV dosyası değil.`)
  }
  let channels = 1
  let sampleRate = 0
  let offset = 12
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4)
    const size = data.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') {
      if (data.readUInt16LE(body) !== 1 || data.readUInt16LE(body + 14) !== 16) {
        throw new Error(`${file}: yalnızca 16 bit PCM WAV desteklenir.`)
      }
      channels = data.readUInt16LE(body + 2)
      sampleRate = data.readUInt32LE(body + 4)
    } else if (id === 'data') {
      const frames = Math.floor(size / 2 / channels)
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        let sum = 0
        for (let c = 0; c < channels; c++) sum += data.readInt16LE(body + (i * channels + c) * 2)
        samples[i] = sum / channels / 32768
      }
      return { samples, sampleRate }
    }
    offset = body + size + (size % 2)
  }
  throw new Error(`${file}: ses verisi bulunamadı.`)
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN
}

function printTimeline(name: string, timeline: TimelineEvent[]) {
  console.log(`\n${name}`)
  for (const event of timeline) {
    const label = event.kind === 'final' ? 'KESİN' : 'gri  '
    console.log(`${event.at.toFixed(1).padStart(5)} sn  ${label}  ${event.text}`)
  }
}

function printTable(results: ClipResult[]) {
  const seconds = (value: number) => `${value.toFixed(1)} sn`
  const percent = (value: number) => `%${(value * 100).toFixed(0)}`
  const rows = results.map((result) => ({
    kayıt: result.name,
    güncelleme: result.updates,
    'güncelleme aralığı': seconds(result.meanInterval),
    'ilk gri kelime': seconds(result.firstPreviewDelay),
    'yanlış gri kelime': percent(result.wrongWordRate),
    'değişen kelime / güncelleme': result.rewrittenPerUpdate.toFixed(1),
    'geride kalan kelime': result.wordsBehind.toFixed(1),
    'kesin metin gecikmesi': seconds(result.finalDelay),
  }))
  const total = (pick: (result: ClipResult) => number) => average(results.map(pick))
  rows.push({
    kayıt: 'ORTALAMA',
    güncelleme: Math.round(total((result) => result.updates)),
    'güncelleme aralığı': seconds(total((result) => result.meanInterval)),
    'ilk gri kelime': seconds(total((result) => result.firstPreviewDelay)),
    'yanlış gri kelime': percent(total((result) => result.wrongWordRate)),
    'değişen kelime / güncelleme': total((result) => result.rewrittenPerUpdate).toFixed(1),
    'geride kalan kelime': total((result) => result.wordsBehind).toFixed(1),
    'kesin metin gecikmesi': seconds(total((result) => result.finalDelay)),
  })
  console.table(rows)
}

await main()
