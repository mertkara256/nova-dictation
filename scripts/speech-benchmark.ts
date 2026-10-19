/**
 * Konuşma tanımanın hızını ve doğruluğunu ses kayıtlarıyla ölçer.
 *
 * Kayıtları mikrofondan geliyormuş gibi gerçek zamanlı çalar ve uygulamanın
 * kullandığı Whisper akışından geçirir:
 * - Önizleme: ekranda görünecek gri metin, yerine geçen kesin metinle karşılaştırılır.
 * - Doğruluk: kaydın yanında beklenen metin (aynı adlı .json) varsa, uygulamanın
 *   ortaya çıkaracağı metin bununla karşılaştırılır. Bu kayıtlar uygulamadaki
 *   "Ölçüm için kaydet" seçeneğiyle test-recordings/ klasörüne yazılır; komut
 *   tuşunun basıldığı anlar da kayıttaki gibi tekrarlanır.
 *
 * Kullanım (Whisper sunucusu açıkken, `npm run whisper`):
 *   npm run bench                            (test-recordings/ içindeki bütün kayıtlar)
 *   npm run bench -- kayit1.wav kayit2.wav
 *   npm run bench -- --timeline kayit.wav    (gri ve kesin metnin her halini de yazar)
 *
 * Kayıtlar 16 bit PCM WAV olmalı. macOS'ta beklenen metni olmayan örnek kayıt üretmek için:
 *   say -v Yelda -o kayit.aiff "Merhaba, yarınki toplantı saat onda."
 *   afconvert -f WAVE -d LEI16@48000 -c 1 kayit.aiff kayit.wav
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { type EditorState, editorReducer, initialEditorState } from '../src/core/editor.ts'
import { toLowerTr } from '../src/core/text.ts'
import type { OpenMicrophone } from '../src/speech/microphone.ts'
import { createWhisperPreview } from '../src/speech/preview.ts'
import { createWhisperServerTranscriber } from '../src/speech/providers/whisperServer.ts'
import type { CommandModeChange } from '../src/speech/recorder.ts'
import { createWhisperClient } from '../src/speech/whisperClient.ts'
import type { TestRecordingInfo } from '../src/ui/testRecordings.ts'
import { TEST_RECORDINGS_DIR } from './test-recordings-plugin.ts'

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
  /** Gri metin, kesinleşmiş dikte ya da komut tuşuyla söylenmiş komut. */
  kind: 'partial' | 'final' | 'command'
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

interface Accuracy {
  /** Uygulamanın kayıttan ortaya çıkaracağı metin. */
  resultText: string
  expectedText: string
  /** Beklenen metne göre yanlış, eksik ya da fazla kelime oranı. */
  wordErrorRate: number
}

async function main() {
  const args = process.argv.slice(2)
  const showTimeline = args.includes('--timeline')
  const named = args.filter((arg) => !arg.startsWith('--'))
  const files = named.length > 0 ? named : savedRecordings()
  if (files.length === 0) {
    console.error(
      `Ölçülecek kayıt yok. Uygulamada Ayarlar → "Ölçüm için kaydet" ile ${TEST_RECORDINGS_DIR}/ ` +
        'klasörüne kayıt ekleyin ya da dosyaları verin: npm run bench -- kayit.wav',
    )
    process.exit(1)
  }
  const client = createWhisperClient(WHISPER_URL)
  if (!(await client.isUp())) {
    console.error(`Whisper sunucusuna ulaşılamadı (${WHISPER_URL}). Önce "npm run whisper" çalıştırın.`)
    process.exit(1)
  }

  const results: { clip: ClipResult; accuracy: Accuracy | null }[] = []
  for (const file of files) {
    const { samples, sampleRate } = readWav(file)
    const info = readInfo(file)
    const timeline = await transcribeInRealTime(samples, sampleRate, info?.commandModeChanges ?? [])
    if (showTimeline) printTimeline(basename(file), timeline)
    const clip = measure(basename(file), timeline, speechActivity(samples, sampleRate))
    const accuracy = info ? checkAccuracy(timeline, info) : null
    results.push({ clip, accuracy })

    console.log(`${clip.name}: ${accuracy?.resultText ?? clip.finalText}`)
    if (accuracy && accuracy.wordErrorRate > 0) console.log(`  beklenen: ${accuracy.expectedText}`)
  }
  printTable(results)
}

/** test-recordings/ klasöründeki kayıtlar, eskiden yeniye. */
function savedRecordings(): string[] {
  if (!existsSync(TEST_RECORDINGS_DIR)) return []
  return readdirSync(TEST_RECORDINGS_DIR)
    .filter((file) => file.endsWith('.wav'))
    .sort()
    .map((file) => join(TEST_RECORDINGS_DIR, file))
}

/** Kaydın yanındaki, aynı adlı .json dosyasındaki bilgiler (varsa). */
function readInfo(wavFile: string): TestRecordingInfo | null {
  const infoFile = wavFile.replace(/\.wav$/, '.json')
  return existsSync(infoFile) ? (JSON.parse(readFileSync(infoFile, 'utf8')) as TestRecordingInfo) : null
}

/** Kaydı gerçek zamanlı çalarak uygulamadaki Whisper akışından geçirir. */
function transcribeInRealTime(
  samples: Float32Array,
  sampleRate: number,
  commandModeChanges: CommandModeChange[],
): Promise<TimelineEvent[]> {
  const client = createWhisperClient(WHISPER_URL)
  const transcriber = createWhisperServerTranscriber({
    client,
    openMicrophone: playback(withSilence(samples, sampleRate), sampleRate, {
      commandModeChanges,
      onCommandMode: (active) => transcriber.setCommandMode?.(active),
      onFinished: () => transcriber.stop(),
    }),
    preview: createWhisperPreview({ client }),
  })

  return new Promise((resolve, reject) => {
    const timeline: TimelineEvent[] = []
    const startedAt = performance.now()
    const at = () => (performance.now() - startedAt) / 1000
    transcriber.start({
      onPartial: (text) => timeline.push({ at: at(), kind: 'partial', text }),
      onFinal: (text) => timeline.push({ at: at(), kind: 'final', text }),
      onCommand: (text) => timeline.push({ at: at(), kind: 'command', text }),
      onError: (error) => reject(new Error(`Konuşma tanıma hatası: ${error}`)),
      onEnd: () => resolve(timeline),
    })
  })
}

interface PlaybackOptions {
  /** Komut tuşunun kayıtta basıldığı ve bırakıldığı anlar; çalarken aynı anlarda tekrarlanır. */
  commandModeChanges: CommandModeChange[]
  onCommandMode(active: boolean): void
  onFinished(): void
}

/** Kaydı küçük bloklar halinde, gerçek süresinde ileten sahte bir mikrofon. */
function playback(samples: Float32Array, sampleRate: number, options: PlaybackOptions): OpenMicrophone {
  const { commandModeChanges, onCommandMode, onFinished } = options
  return async (onAudio) => {
    const blockSize = Math.round((sampleRate * BLOCK_MS) / 1000)
    const startedAt = performance.now()
    let position = 0
    let nextChange = 0
    const timer = setInterval(() => {
      const due = Math.min(
        samples.length,
        Math.floor(((performance.now() - startedAt) / 1000) * sampleRate),
      )
      while (position < due) {
        const change = commandModeChanges[nextChange]
        const changeAt = change ? Math.round(change.at * sampleRate) : Infinity
        if (changeAt <= position) {
          onCommandMode(change.active)
          nextChange++
          continue
        }
        const end = Math.min(position + blockSize, due, changeAt)
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
    // Komutlar gri metin olarak gösterilmez; önizleme ölçümüne girmez.
    if (event.kind === 'command') return
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
  // Son kesinleşen parça bir dikte de olabilir, komut tuşuyla verilen bir komut da.
  const lastFinalAt = timeline.findLast((event) => event.kind !== 'partial')?.at ?? NaN
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

/** Kaydı uygulamadaki gibi metne uygular ve sonucu beklenen metinle karşılaştırır. */
function checkAccuracy(timeline: TimelineEvent[], info: TestRecordingInfo): Accuracy {
  let state: EditorState = {
    ...initialEditorState,
    text: info.initialText,
    selection: info.initialSelection,
  }
  for (const event of timeline) {
    const spoken = { segment: event.text, wakeWord: info.wakeWord, at: 0 }
    if (event.kind === 'final') state = editorReducer(state, { type: 'dictate', ...spoken })
    if (event.kind === 'command') state = editorReducer(state, { type: 'command-speech', ...spoken })
  }
  const expected = words(info.expectedText)
  return {
    resultText: state.text,
    expectedText: info.expectedText,
    wordErrorRate: wordDistance(words(state.text), expected) / Math.max(1, expected.length),
  }
}

/** Karşılaştırma için kelimeler: küçük harf, noktalamasız. */
function words(text: string): string[] {
  return toLowerTr(text)
    .replace(/[^\p{L}\p{N}'’\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** İki kelime dizisi arasındaki en az kelime değişikliği (ekleme, silme, değiştirme). */
function wordDistance(a: string[], b: string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
    }
    previous = current
  }
  return previous[b.length]
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
    const label = { partial: 'gri  ', final: 'KESİN', command: 'KOMUT' }[event.kind]
    console.log(`${event.at.toFixed(1).padStart(5)} sn  ${label}  ${event.text}`)
  }
}

function printTable(results: { clip: ClipResult; accuracy: Accuracy | null }[]) {
  const seconds = (value: number) => `${value.toFixed(1)} sn`
  const percent = (value: number) => `%${(value * 100).toFixed(0)}`
  const row = (
    name: string,
    clip: (pick: (result: ClipResult) => number) => number,
    wordErrorRate: number | null,
  ) => ({
    kayıt: name,
    'güncelleme aralığı': seconds(clip((result) => result.meanInterval)),
    'ilk gri kelime': seconds(clip((result) => result.firstPreviewDelay)),
    'yanlış gri kelime': percent(clip((result) => result.wrongWordRate)),
    'değişen kelime / güncelleme': clip((result) => result.rewrittenPerUpdate).toFixed(1),
    'geride kalan kelime': clip((result) => result.wordsBehind).toFixed(1),
    'kesin metin gecikmesi': seconds(clip((result) => result.finalDelay)),
    // Yalnızca beklenen metni olan kayıtlarda ölçülür.
    'metin hatası': wordErrorRate === null ? '–' : percent(wordErrorRate),
  })

  const rows = results.map(({ clip, accuracy }) =>
    row(clip.name, (pick) => pick(clip), accuracy?.wordErrorRate ?? null),
  )
  const checked = results.flatMap(({ accuracy }) => (accuracy ? [accuracy.wordErrorRate] : []))
  rows.push(
    row(
      'ORTALAMA',
      (pick) => average(results.map(({ clip }) => pick(clip))),
      checked.length > 0 ? average(checked) : null,
    ),
  )
  console.table(rows)
}

await main()
