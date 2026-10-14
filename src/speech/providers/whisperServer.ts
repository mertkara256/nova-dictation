import { downsample, encodeWav } from '../audio.ts'
import { type Microphone, type OpenMicrophone, toMicrophoneError } from '../microphone.ts'
import type { Transcriber, TranscriberError } from '../transcriber.ts'
import { UtteranceDetector } from '../utterances.ts'

const WHISPER_SAMPLE_RATE = 16000

export interface WhisperServerOptions {
  /** whisper.cpp sunucusunun adresi (geliştirmede Vite'ın /whisper yönlendirmesi). */
  baseUrl: string
  openMicrophone: OpenMicrophone
  fetch?: typeof fetch
}

/**
 * Bilgisayarda çalışan whisper.cpp sunucusunu kullanır. Konuşma duraklamalarda
 * parçalara bölünür ve her parça sırayla yazıya çevrilir; Whisper canlı ara
 * metin üretmediği için çeviri sürerken ara metin olarak "…" gösterilir.
 */
export function createWhisperServerTranscriber(options: WhisperServerOptions): Transcriber {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis)
  let active: { stop(): void } | null = null

  async function isServerUp() {
    try {
      const response = await fetchFn(`${options.baseUrl}/`, { signal: AbortSignal.timeout(2000) })
      return response.ok
    } catch {
      return false
    }
  }

  async function transcribe(wav: ArrayBuffer) {
    const body = new FormData()
    body.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
    body.append('response_format', 'json')
    body.append('temperature', '0')
    const response = await fetchFn(`${options.baseUrl}/inference`, { method: 'POST', body })
    if (!response.ok) throw new Error(`Whisper sunucusu ${response.status} yanıtı verdi.`)
    const { text } = (await response.json()) as { text: string }
    return text.replace(/\s+/g, ' ').trim()
  }

  return {
    start(handlers) {
      if (active) return

      let microphone: Microphone | null = null
      let detector: UtteranceDetector | null = null
      let queue = Promise.resolve()
      let pending = 0
      let stopping = false
      let failed = false
      let ended = false

      const shutdown = async () => {
        await microphone?.close()
        await queue
        if (ended) return
        ended = true
        active = null
        handlers.onPartial('')
        handlers.onEnd()
      }

      const fail = (error: TranscriberError) => {
        if (failed || ended) return
        failed = true
        stopping = true
        handlers.onError(error)
        void shutdown()
      }

      const enqueue = (samples: Float32Array, sampleRate: number) => {
        const wav = encodeWav(downsample(samples, sampleRate, WHISPER_SAMPLE_RATE), WHISPER_SAMPLE_RATE)
        pending++
        handlers.onPartial('…')
        queue = queue.then(async () => {
          try {
            if (failed) return
            const text = await transcribe(wav)
            if (text && !failed) handlers.onFinal(text)
          } catch {
            fail('unavailable')
          } finally {
            pending--
            if (pending === 0 && !ended) handlers.onPartial('')
          }
        })
      }

      active = {
        stop() {
          if (stopping) return
          stopping = true
          detector?.flush()
          void shutdown()
        },
      }

      void (async () => {
        if (!(await isServerUp())) return fail('unavailable')
        if (stopping) return

        let mic: Microphone
        try {
          mic = await options.openMicrophone((samples) => detector?.push(samples))
        } catch (error) {
          return fail(toMicrophoneError(error))
        }
        if (stopping) return void mic.close()

        microphone = mic
        detector = new UtteranceDetector({ sampleRate: mic.sampleRate }, (samples) =>
          enqueue(samples, mic.sampleRate),
        )
      })()
    },

    stop() {
      active?.stop()
    },
  }
}
