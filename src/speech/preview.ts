import { createResampler } from './audio.ts'

const SAMPLE_RATE = 16000

export interface PreviewHandlers {
  /** O ana kadar tanınan metin; her çağrıda bir öncekinin yerine geçer. */
  onText(text: string): void
  /** Bağlantı kurulamadı; bu parça için canlı önizleme yok. */
  onError(): void
}

export interface PreviewSession {
  push(samples: Float32Array): void
  /** Parça bitti: kalan sesi işletip oturumu kapatır. */
  finish(): void
  /** Parça atıldı: oturumu hemen kapatır. */
  cancel(): void
}

/**
 * Konuşma sürerken metni canlı gösteren yardımcı servis. Kesin metni üretmez;
 * yalnızca kullanıcı konuşurken ne söylediğini görsün diye kullanılır.
 */
export interface LivePreview {
  /** Yeni bir konuşma parçası için oturum açar; servis kullanılamıyorsa null döner. */
  open(sampleRate: number, handlers: PreviewHandlers): PreviewSession | null
  /** Önceki bağlantı hatasını unutur; yeni dikte başlarken yeniden denenir. */
  reset(): void
}

/**
 * sherpa-onnx'in akışlı WebSocket sunucusuyla (ör. Nemotron) canlı önizleme.
 * Her konuşma parçası ayrı bir bağlantıdır: ses 16 kHz Float32 olarak akıtılır,
 * sunucu metni her adımda JSON olarak geri gönderir. "Done" mesajı parçanın
 * bittiğini bildirir.
 */
export function createSherpaPreview(
  url: string,
  WebSocketImpl: typeof WebSocket = WebSocket,
): LivePreview {
  let unavailable = false

  return {
    reset() {
      unavailable = false
    },

    open(sampleRate, handlers) {
      if (unavailable) return null

      const resample = createResampler(sampleRate, SAMPLE_RATE)
      const socket = new WebSocketImpl(url)
      socket.binaryType = 'arraybuffer'
      const outbox: (ArrayBuffer | string)[] = []
      let opened = false
      let closed = false

      const send = (data: ArrayBuffer | string) => {
        if (closed) return
        if (opened) socket.send(data)
        else outbox.push(data)
      }

      const close = () => {
        if (closed) return
        closed = true
        socket.close()
      }

      socket.onopen = () => {
        opened = true
        for (const data of outbox) socket.send(data)
        outbox.length = 0
      }

      socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return
        if (event.data === 'Done!') return close()
        try {
          const { text } = JSON.parse(event.data) as { text: string }
          handlers.onText(text.trim())
        } catch {
          // JSON olmayan mesajlar yok sayılır.
        }
      }

      socket.onerror = () => {
        if (opened) return
        unavailable = true
        closed = true
        handlers.onError()
      }

      return {
        push(samples) {
          const resampled = resample(samples)
          if (resampled.length > 0) send(resampled.slice().buffer)
        },
        finish() {
          send('Done')
          // Sunucu yanıt vermezse bağlantı açık kalmasın.
          setTimeout(close, 5000)
        },
        cancel: close,
      }
    },
  }
}
