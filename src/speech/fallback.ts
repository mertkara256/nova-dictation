import type { Transcriber } from './transcriber.ts'

/**
 * Ana servis kullanılamazsa (ör. Whisper sunucusu kapalıysa) yedek servise geçer.
 * Mikrofon izni gibi diğer hatalarda geçiş yapılmaz; yedek servis de aynı
 * sorunla karşılaşacağı için hata olduğu gibi iletilir.
 */
export function withFallback(primary: Transcriber, fallback: Transcriber | null): Transcriber {
  if (!fallback) return primary
  let current: Transcriber | null = null

  return {
    start(handlers) {
      let switched = false
      current = primary
      primary.start({
        onPartial: (text) => {
          if (!switched) handlers.onPartial(text)
        },
        onFinal: (text) => handlers.onFinal(text),
        onError: (error) => {
          if (error !== 'unavailable' || switched) return handlers.onError(error)
          switched = true
          current = fallback
          handlers.onFallback?.()
          fallback.start(handlers)
        },
        onEnd: () => {
          if (!switched) handlers.onEnd()
        },
      })
    },

    stop() {
      current?.stop()
    },
  }
}
