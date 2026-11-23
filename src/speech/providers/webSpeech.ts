import { capitalizeTr } from '../../core/text.ts'
import type { Transcriber, TranscriberError } from '../transcriber.ts'

/**
 * Tarayıcının Web Speech API'sinden kullandığımız kısım. TypeScript'in DOM
 * tiplerinde SpeechRecognition sınıfı bulunmadığı için burada tanımlanıyor.
 */
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  /** Bekleyen sesi tamamlayıp sonucunu verir, sonra biter. */
  stop(): void
  /** Bekleyen sesi atarak biter. */
  abort(): void
}

export interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

/** Tarayıcı Web Speech API'yi desteklemiyorsa undefined döner (ör. Firefox). */
export function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const scope = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

export function createWebSpeechTranscriber(
  Recognition: SpeechRecognitionConstructor,
  lang = 'tr-TR',
): Transcriber {
  // Süren oturum. İptal edilen oturum onend'i beklemeden bırakılır: tarayıcı onu biraz
  // sonra bitirir, o arada yeni oturum başlayabilir ve eskinin işleyicilerine karışmaz.
  let session: { stop(): void; cancel(): void } | null = null

  return {
    start(handlers) {
      if (session) return
      let listening = true
      let cancelled = false

      const rec = new Recognition()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true

      rec.onresult = (event) => {
        // abort() sonrasında tarayıcı yine de sonuç gönderebilir; iptal edilen ses yazılmaz.
        if (cancelled) return
        let partial = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) handlers.onFinal(result[0].transcript)
          else partial += result[0].transcript
        }
        handlers.onPartial(partial)
      }

      rec.onerror = (event) => {
        // Sessizlik ve kullanıcının durdurması hata sayılmaz.
        if (event.error === 'no-speech' || event.error === 'aborted') return
        listening = false
        handlers.onError(toTranscriberError(event.error))
      }

      rec.onend = () => {
        // Chrome bir süre sessiz kalınca dinlemeyi kendiliğinden bitirir;
        // kullanıcı mikrofonu kapatmadıysa yeniden başlatılır.
        if (listening) {
          try {
            rec.start()
            return
          } catch {
            listening = false
            handlers.onError('unavailable')
          }
        }
        if (session === current) session = null
        handlers.onPartial('')
        handlers.onEnd()
      }

      const current = {
        stop() {
          listening = false
          rec.stop()
        },
        cancel() {
          listening = false
          cancelled = true
          session = null
          rec.abort()
        },
      }
      session = current
      rec.start()
    },

    stop() {
      session?.stop()
    },

    cancel() {
      session?.cancel()
    },
  }
}

/**
 * Tarayıcının tanıması Türkçede noktalama koymaz; her duraklamada bir kesin parça verir.
 * Bu parçalar cümle sayılır: baş harfi büyütülür, sonuna nokta konur. Whisper da
 * duraklamaları böyle yazar; böylece “son cümleyi sil” gibi cümle komutları bu modda da
 * çalışır. Cümlenin ortasında duraklanırsa araya yanlış bir nokta girer.
 */
export function punctuateAtPauses(transcriber: Transcriber): Transcriber {
  return {
    ...transcriber,
    start: (handlers) => transcriber.start({ ...handlers, onFinal: (text) => handlers.onFinal(toSentence(text)) }),
  }
}

/** " yarın toplantı var" → "Yarın toplantı var." Noktalaması olan parça olduğu gibi kalır. */
export function toSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return text
  return capitalizeTr(trimmed) + (/[.!?…:;,]$/.test(trimmed) ? '' : '.')
}

function toTranscriberError(code: string): TranscriberError {
  switch (code) {
    case 'not-allowed':
      return 'permission'
    case 'audio-capture':
      return 'no-microphone'
    case 'network':
      return 'network'
    default:
      return 'unavailable'
  }
}
