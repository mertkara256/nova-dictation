import type { Transcriber } from './transcriber.ts'

/**
 * Ana servis kullanılamazsa (ör. Whisper sunucusu kapalıysa) yedek servise geçer.
 * Mikrofon izni gibi diğer hatalarda geçiş yapılmaz; yedek servis de aynı
 * sorunla karşılaşacağı için hata olduğu gibi iletilir.
 */
export function withFallback(primary: Transcriber, fallback: Transcriber | null): Transcriber {
  if (!fallback) return primary
  let current: Transcriber | null = null
  let stopped = false

  return {
    start(handlers) {
      let switched = false
      stopped = false
      current = primary
      primary.start({
        onPartial: (text) => {
          if (!switched) handlers.onPartial(text)
        },
        onFinal: (text) => handlers.onFinal(text),
        onCommand: (text) => handlers.onCommand?.(text),
        onCommandPartial: (text) => {
          if (!switched) handlers.onCommandPartial?.(text)
        },
        onError: (error) => {
          if (stopped && error === 'unavailable') return handlers.onError(error)
          if (error !== 'unavailable' || switched) return handlers.onError(error)
          switched = true
          current = fallback
          handlers.onFallback?.()
          fallback.start(handlers)
        },
        onEnd: () => {
          if (!switched) handlers.onEnd()
        },
        onLevel: (level) => {
          if (!switched) handlers.onLevel?.(level)
        },
        onRetryAvailable: (available) => handlers.onRetryAvailable?.(available),
      })
    },

    stop() {
      stopped = true
      current?.stop()
    },

    cancel() {
      stopped = true
      if (current?.cancel) current.cancel()
      else current?.stop()
    },

    retry() { current?.retry?.() },

    // Yedek servis komut modunu desteklemiyorsa çağrı yok sayılır.
    setCommandMode(active) {
      current?.setCommandMode?.(active)
    },
  }
}
