import type { Transcriber } from './transcriber.ts'

/**
 * Ana servis kullanılamazsa (ör. Whisper sunucusu kapalıysa) yedek servise geçer;
 * ama yalnızca `allowed()` doğruysa. Yedek servis sesi bilgisayardan çıkarabildiği
 * için (tarayıcının tanıması Google'a ya da Apple'a gönderir) geçiş kullanıcının
 * onayına bağlıdır; onay yoksa 'unavailable' hatası arayüze iletilir. Mikrofon izni gibi diğer hatalarda geçiş yapılmaz; yedek servis de aynı
 * sorunla karşılaşacağı için hata olduğu gibi iletilir. Komut modu açıkken (⌃
 * basılıyken) de geçilmez: yedek servis komut modunu bilmez, söyleneni metne yazardı.
 */
export function withFallback(
  primary: Transcriber,
  fallback: Transcriber | null,
  allowed: () => boolean,
): Transcriber {
  if (!fallback) return primary
  let current: Transcriber | null = null
  let stopped = false
  let commandMode = false

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
          if (error !== 'unavailable' || switched || stopped || commandMode || !allowed()) {
            return handlers.onError(error)
          }
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
      commandMode = active
      current?.setCommandMode?.(active)
    },
  }
}
