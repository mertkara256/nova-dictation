import { rms } from '../audio.ts'
import { type Microphone, type OpenMicrophone, toMicrophoneError } from '../microphone.ts'
import type { LivePreview, PreviewSession } from '../preview.ts'
import type { Transcriber, TranscriberError } from '../transcriber.ts'
import { UtteranceDetector } from '../utterances.ts'
import type { WhisperClient } from '../whisperClient.ts'

export interface WhisperServerOptions {
  client: WhisperClient
  openMicrophone: OpenMicrophone
  preview?: LivePreview
  /** Konuşma parçasını bitiren sessizlik süresi; ölçüm aracı farklı değerleri denemek için verir. */
  silenceMs?: number
  /** Komut tuşu basılıyken söylenen parçalarda Whisper'a verilen ipucu (komut listesi). */
  commandPrompt?: string
}

interface Utterance {
  text: string
  session: PreviewSession | null
  isCommand: boolean
}
interface PendingUtterance extends Utterance {
  samples: Float32Array
  sampleRate: number
}

/** Kesin metin sırayla işlenir; başarısız parçalar yeniden denemek için bellekte tutulur. */
export function createWhisperServerTranscriber(options: WhisperServerOptions): Transcriber {
  const { client } = options
  let active: { stop(): void; cancel(): void; retry(): void; cut(): void } | null = null
  let commandMode = false

  return {
    start(handlers) {
      if (active) return
      let microphone: Microphone | null = null
      let closing: Promise<void> | null = null
      let detector: UtteranceDetector | null = null
      let stopping = false
      let paused = false
      let cancelled = false
      let ended = false
      let running = false
      let speaking: Utterance | null = null
      const waiting: PendingUtterance[] = []
      const controller = new AbortController()

      const showPartial = () => {
        if (ended || cancelled) return
        const parts = speaking ? [...waiting, speaking] : waiting
        const show = (isCommand: boolean) =>
          parts.filter((part) => part.isCommand === isCommand).map((part) => part.text).filter(Boolean).join(' ') ||
          (waiting.some((part) => part.isCommand === isCommand) ? '…' : '')
        handlers.onPartial(show(false))
        handlers.onCommandPartial?.(show(true))
      }

      const closeMicrophone = () => {
        detector = null
        return closing ??= microphone?.close().catch(() => {}) ?? Promise.resolve()
      }

      const finish = async () => {
        await closeMicrophone()
        if (ended || (!cancelled && (running || waiting.length > 0))) return
        ended = true
        active = null
        commandMode = false
        handlers.onPartial('')
        handlers.onCommandPartial?.('')
        handlers.onRetryAvailable?.(false)
        handlers.onEnd()
      }

      const failStartup = (error: TranscriberError) => {
        if (ended || cancelled || stopping) return
        stopping = true
        handlers.onError(error)
        void finish()
      }

      const pump = async () => {
        if (running || paused || cancelled || ended) return
        running = true
        while (waiting.length && !paused && !cancelled) {
          const utterance = waiting[0]
          try {
            const prompt = utterance.isCommand ? options.commandPrompt : undefined
            const text = await transcribeWithRetry(client, utterance, { signal: controller.signal, prompt })
            if (cancelled) break
            waiting.shift()
            if (text) {
              if (utterance.isCommand) handlers.onCommand?.(text)
              else handlers.onFinal(text)
            }
            showPartial()
          } catch (error) {
            if (cancelled) break
            paused = true
            stopping = true
            // Hata anında konuşulan son parçayı da koru; mikrofonu açık bırakma.
            detector?.flush()
            await closeMicrophone()
            if (cancelled) break
            handlers.onRetryAvailable?.(true)
            handlers.onError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'transcription')
            handlers.onEnd()
          }
        }
        running = false
        if (stopping && !paused) void finish()
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
          void closeMicrophone()
          if (!running) void finish()
        },
        cancel() {
          if (ended || cancelled) return
          cancelled = true
          stopping = true
          controller.abort()
          speaking?.session?.cancel()
          speaking = null
          for (const part of waiting) part.session?.cancel()
          waiting.length = 0
          void finish()
        },
        retry() {
          if (!paused || cancelled || running) return
          paused = false
          handlers.onRetryAvailable?.(false)
          void pump()
        },
        cut() { detector?.cut() },
      }

      void (async () => {
        const up = await client.isUp()
        if (stopping || ended) return
        if (!up) return failStartup('unavailable')
        let mic: Microphone
        try {
          mic = await options.openMicrophone((samples) => {
            if (stopping) return
            handlers.onLevel?.(rms(samples))
            detector?.push(samples)
          })
        } catch (error) {
          return failStartup(toMicrophoneError(error))
        }
        if (stopping || ended) return void mic.close().catch(() => {})
        microphone = mic
        detector = new UtteranceDetector({ sampleRate: mic.sampleRate, silenceMs: options.silenceMs }, {
          onSpeechStart: (samples) => {
            const part: Utterance = { text: '', session: null, isCommand: commandMode }
            part.session = options.preview?.open(mic.sampleRate, {
              onText: (text) => { part.text = text; showPartial() },
            }) ?? null
            part.session?.push(samples)
            speaking = part
          },
          onSpeech: (samples) => speaking?.session?.push(samples),
          onUtterance: (samples) => {
            const part = speaking ?? { text: '', session: null, isCommand: commandMode }
            speaking = null
            part.session?.finish()
            waiting.push({ ...part, samples, sampleRate: mic.sampleRate })
            showPartial()
            void pump()
          },
          onDiscard: discardUtterance,
        })
      })()
    },
    stop() { active?.stop() },
    cancel() { active?.cancel() },
    retry() { active?.retry() },
    setCommandMode(isActive) {
      if (isActive === commandMode) return
      commandMode = isActive
      active?.cut()
    },
  }
}

/** Geçici ağ hatasında bir kez otomatik dene; iptal ve zaman aşımında beklemeyi uzatma. */
async function transcribeWithRetry(
  client: WhisperClient,
  part: PendingUtterance,
  options: { signal: AbortSignal; prompt?: string },
) {
  try {
    return await client.transcribe(part.samples, part.sampleRate, options)
  } catch (error) {
    if (options.signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) throw error
    return client.transcribe(part.samples, part.sampleRate, options)
  }
}
