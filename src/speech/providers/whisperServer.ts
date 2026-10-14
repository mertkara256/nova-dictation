import { downsample, encodeWav } from '../audio.ts'
import { type Microphone, type OpenMicrophone, toMicrophoneError } from '../microphone.ts'
import type { LivePreview, PreviewSession } from '../preview.ts'
import type { Transcriber, TranscriberError } from '../transcriber.ts'
import { UtteranceDetector } from '../utterances.ts'

const WHISPER_SAMPLE_RATE = 16000

export interface WhisperServerOptions {
  /** whisper.cpp sunucusunun adresi (geliştirmede Vite'ın /whisper yönlendirmesi). */
  baseUrl: string
  openMicrophone: OpenMicrophone
  /** Konuşurken metni canlı göstermek için (ör. Nemotron). Yoksa yalnızca "…" gösterilir. */
  preview?: LivePreview
  fetch?: typeof fetch
}

interface Utterance {
  /** Canlı önizlemenin bu parça için o ana kadarki metni. */
  text: string
  session: PreviewSession | null
}

/**
 * Bilgisayarda çalışan whisper.cpp sunucusunu kullanır. Konuşma duraklamalarda
 * parçalara bölünür ve her parça sırayla Whisper'a gönderilir; kesin metin
 * (noktalamasıyla) Whisper'dan gelir. Konuşma sürerken metin, varsa canlı
 * önizleme servisinden ara metin olarak gösterilir ve Whisper'ın sonucu
 * gelince onun yerini alır.
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
      options.preview?.reset()

      let microphone: Microphone | null = null
      let detector: UtteranceDetector | null = null
      let queue = Promise.resolve()
      let stopping = false
      let failed = false
      let ended = false
      // Şu an söylenmekte olan parça ve Whisper'ın sonucunu bekleyen parçalar (sırasıyla).
      let speaking: Utterance | null = null
      const waiting: Utterance[] = []

      const showPartial = () => {
        if (ended) return
        const parts = speaking ? [...waiting, speaking] : waiting
        const text = parts
          .map((utterance) => utterance.text)
          .filter(Boolean)
          .join(' ')
        handlers.onPartial(text || (waiting.length > 0 ? '…' : ''))
      }

      const shutdown = async () => {
        speaking?.session?.cancel()
        speaking = null
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

      const startUtterance = (samples: Float32Array, sampleRate: number) => {
        const utterance: Utterance = { text: '', session: null }
        utterance.session =
          options.preview?.open(sampleRate, {
            onText: (text) => {
              utterance.text = text
              showPartial()
            },
            onError: () => {
              utterance.session = null
            },
          }) ?? null
        utterance.session?.push(samples)
        speaking = utterance
      }

      const finishUtterance = (samples: Float32Array, sampleRate: number) => {
        const utterance = speaking ?? { text: '', session: null }
        speaking = null
        utterance.session?.finish()
        waiting.push(utterance)
        showPartial()

        const wav = encodeWav(
          downsample(samples, sampleRate, WHISPER_SAMPLE_RATE),
          WHISPER_SAMPLE_RATE,
        )
        queue = queue.then(async () => {
          try {
            if (failed) return
            const text = await transcribe(wav)
            if (text && !failed) handlers.onFinal(text)
          } catch {
            fail('unavailable')
          } finally {
            waiting.splice(waiting.indexOf(utterance), 1)
            showPartial()
          }
        })
      }

      const discardUtterance = () => {
        speaking?.session?.cancel()
        speaking = null
        showPartial()
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
        detector = new UtteranceDetector(
          { sampleRate: mic.sampleRate },
          {
            onSpeechStart: (samples) => startUtterance(samples, mic.sampleRate),
            onSpeech: (samples) => speaking?.session?.push(samples),
            onUtterance: (samples) => finishUtterance(samples, mic.sampleRate),
            onDiscard: discardUtterance,
          },
        )
      })()
    },

    stop() {
      active?.stop()
    },
  }
}
