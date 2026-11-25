import { concatAudio, rms } from './audio.ts'

export interface UtteranceOptions {
  sampleRate: number
  /** Bu kadar sessiz kalınınca konuşma parçası biter. */
  silenceMs?: number
  /** Konuşmanın başı kesilmesin diye, öncesindeki bu kadarlık ses de parçaya eklenir. */
  preRollMs?: number
  /** Bundan kısa sesler (öksürük, tıkırtı) yok sayılır. */
  minSpeechMs?: number
  /** Whisper 30 saniyelik pencerelerle çalıştığı için daha uzun konuşmalar bu sürede bölünür. */
  maxUtteranceMs?: number
}

export interface UtteranceEvents {
  /** Konuşma parçası bitti; parçanın tamamı (öncesindeki ses dahil). */
  onUtterance(samples: Float32Array): void
  /** Konuşma başladı; öncesindeki ses ve ilk konuşma bloğu. */
  onSpeechStart?(samples: Float32Array): void
  /** Konuşma sürerken gelen her yeni ses bloğu. */
  onSpeech?(samples: Float32Array): void
  /** Başlayan ses, konuşma sayılamayacak kadar kısa çıktı ve atıldı. */
  onDiscard?(): void
}

const FRAME_MS = 30
// Bu seviyenin (yaklaşık -40 dBFS) altındaki ses hiçbir koşulda konuşma sayılmaz.
const MIN_SPEECH_LEVEL = 0.01
// Uzun konuşma bölünürken kesilecek yer, sonundaki bu kadarlık seste aranır.
const SPLIT_SEARCH_MS = 2000
// `endSoon`: kelimenin bittiği bu kadarlık sessizlikten anlaşılır; en fazla bu kadar beklenir.
// Kelimenin içindeki sessizlik (ör. "nokta"daki "k" ile "t" arası) Yelda sesinde en çok 150 ms.
const END_SILENCE_MS = 250
const END_MAX_MS = 500

/**
 * Mikrofondan gelen sesi konuşma parçalarına böler: ses yükselince kayda başlar,
 * belirli bir süre sessiz kalınınca parçayı bitirip iletir.
 */
export class UtteranceDetector {
  private readonly frameSize: number
  private readonly silenceFrames: number
  private readonly preRollFrames: number
  private readonly minSpeechFrames: number
  private readonly maxFrames: number
  private readonly splitSearchFrames: number
  private readonly endSilenceFrames: number
  private readonly endMaxFrames: number
  private readonly events: UtteranceEvents
  private buffer = new Float32Array(0)
  private preRoll: Float32Array[] = []
  private frames: Float32Array[] | null = null
  private speechCount = 0
  private silenceCount = 0
  private noiseFloor = 0
  /** `endSoon` ile bitirilmeyi bekleyen konuşma: en fazla kaç blok daha süreceği ve bitince çağrılacak olan. */
  private ending: { framesLeft: number; onEnd?: () => void } | null = null

  constructor(options: UtteranceOptions, events: UtteranceEvents) {
    const framesFor = (ms: number) => Math.max(1, Math.round(ms / FRAME_MS))
    this.frameSize = Math.round((options.sampleRate * FRAME_MS) / 1000)
    this.silenceFrames = framesFor(options.silenceMs ?? 700)
    this.preRollFrames = framesFor(options.preRollMs ?? 300)
    this.minSpeechFrames = framesFor(options.minSpeechMs ?? 250)
    this.maxFrames = framesFor(options.maxUtteranceMs ?? 25_000)
    this.splitSearchFrames = framesFor(SPLIT_SEARCH_MS)
    this.endSilenceFrames = framesFor(END_SILENCE_MS)
    this.endMaxFrames = framesFor(END_MAX_MS)
    this.events = events
  }

  push(samples: Float32Array) {
    const data = new Float32Array(this.buffer.length + samples.length)
    data.set(this.buffer)
    data.set(samples, this.buffer.length)

    let offset = 0
    for (; offset + this.frameSize <= data.length; offset += this.frameSize) {
      this.processFrame(data.slice(offset, offset + this.frameSize))
    }
    this.buffer = data.slice(offset)
  }

  /** O an süren konuşma parçasını burada bitirip iletir; dinleme sürer. */
  cut() {
    this.finish()
  }

  /**
   * Süren konuşmayı, son kelimenin bitmesini bekleyerek bitirir: kısa bir sessizlik gelince
   * ya da en geç yarım saniye sonra iletir. Konuşma yoksa ya da zaten susulmuşsa hemen
   * bitirir. Bitince `onEnd` çağrılır. Komut tuşu son hecede bırakılınca komut yarıda
   * kesilmesin diye.
   */
  endSoon(onEnd?: () => void) {
    if (this.frames && this.silenceCount < this.endSilenceFrames) {
      this.ending = { framesLeft: this.ending?.framesLeft ?? this.endMaxFrames, onEnd: onEnd ?? this.ending?.onEnd }
      return
    }
    this.finish()
    onEnd?.()
  }

  /** Süren konuşma `endSoon` ile bitirilmeyi mi bekliyor? */
  get isEnding() {
    return this.ending !== null
  }

  /** Mikrofon kapanırken o an süren konuşmayı iletir. */
  flush() {
    this.finish()
    this.buffer = new Float32Array(0)
    this.preRoll = []
  }

  private processFrame(frame: Float32Array) {
    const level = rms(frame)
    const isSpeech = level > this.speechLevel()

    if (!this.frames) {
      if (isSpeech) {
        this.frames = [...this.preRoll, frame]
        this.preRoll = []
        this.speechCount = 1
        this.silenceCount = 0
        this.events.onSpeechStart?.(concatAudio(this.frames))
      } else {
        this.noiseFloor = this.noiseFloor * 0.95 + level * 0.05
        this.preRoll.push(frame)
        if (this.preRoll.length > this.preRollFrames) this.preRoll.shift()
      }
      return
    }

    this.frames.push(frame)
    this.events.onSpeech?.(frame)
    if (isSpeech) {
      this.speechCount++
      this.silenceCount = 0
    } else {
      this.silenceCount++
    }
    if (this.silenceCount >= this.silenceFrames) this.finish()
    else if (this.ending && (this.silenceCount >= this.endSilenceFrames || --this.ending.framesLeft <= 0)) this.finish()
    else if (this.frames.length >= this.maxFrames) this.splitAtQuietestFrame(this.frames)
  }

  /**
   * Çok uzun süren konuşmayı, bir kelimenin ortasından kesmemek için son iki
   * saniyedeki en sessiz anda (ör. nefes arasında) böler. Öncesi parça olarak
   * iletilir, arkası yeni bir parçanın başı olur.
   */
  private splitAtQuietestFrame(frames: Float32Array[]) {
    let quietest = frames.length - 1
    let quietestLevel = rms(frames[quietest])
    for (let i = Math.max(0, frames.length - this.splitSearchFrames); i < frames.length - 1; i++) {
      const level = rms(frames[i])
      if (level < quietestLevel) {
        quietest = i
        quietestLevel = level
      }
    }
    const rest = frames.slice(quietest + 1)
    this.frames = frames.slice(0, quietest + 1)
    this.finish()
    if (rest.length === 0) return
    this.frames = rest
    this.speechCount = rest.filter((frame) => rms(frame) > this.speechLevel()).length
    this.events.onSpeechStart?.(concatAudio(rest))
  }

  /** Bu seviyenin üstündeki ses konuşma sayılır; ortam gürültüsüne göre yükselir. */
  private speechLevel() {
    return Math.max(MIN_SPEECH_LEVEL, this.noiseFloor * 3)
  }

  private finish() {
    const frames = this.frames
    const speechCount = this.speechCount
    const onEnd = this.ending?.onEnd
    this.frames = null
    this.speechCount = 0
    this.silenceCount = 0
    this.ending = null
    if (frames) {
      if (speechCount >= this.minSpeechFrames) this.events.onUtterance(concatAudio(frames))
      else this.events.onDiscard?.()
    }
    onEnd?.()
  }
}
