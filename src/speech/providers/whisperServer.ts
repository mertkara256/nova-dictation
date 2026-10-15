import { type Microphone, type OpenMicrophone, toMicrophoneError } from '../microphone.ts'
import type { LivePreview, PreviewSession } from '../preview.ts'
import type { Transcriber, TranscriberError } from '../transcriber.ts'
import { UtteranceDetector } from '../utterances.ts'
import type { WhisperClient } from '../whisperClient.ts'

export interface WhisperServerOptions {
  client: WhisperClient
  openMicrophone: OpenMicrophone
  /** Konuşurken metni göstermek için. Yoksa Whisper beklenirken yalnızca "…" gösterilir. */
  preview?: LivePreview
}

interface Utterance {
  /** Önizlemenin bu parça için o ana kadarki metni. */
  text: string
  session: PreviewSession | null
}

/**
 * Bilgisayarda çalışan whisper.cpp sunucusunu kullanır. Konuşma duraklamalarda
 * parçalara bölünür ve her parça sırayla Whisper'a gönderilir; kesin metin
 * (noktalamasıyla) Whisper'dan gelir. Konuşma sürerken metin, varsa önizleme
 * olarak gösterilir ve Whisper'ın sonucu gelince onun yerini alır.
 */
export function createWhisperServerTranscriber(options: WhisperServerOptions): Transcriber {
  const { client } = options
  let active: { stop(): void } | null = null

  return {
    start(handlers) {
      if (active) return

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

        queue = queue.then(async () => {
          try {
            if (failed) return
            const text = await client.transcribe(samples, sampleRate)
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
        if (!(await client.isUp())) return fail('unavailable')
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
