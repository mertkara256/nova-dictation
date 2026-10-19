import { concatAudio } from './audio.ts'
import type { OpenMicrophone } from './microphone.ts'

/** Komut modunun açıldığı ya da kapandığı an. */
export interface CommandModeChange {
  /** Kaydın başından bu yana geçen süre (saniye). */
  at: number
  active: boolean
}

/** Bir mikrofon oturumunun, açılışından kapanışına kadarki ham sesi. */
export interface SessionRecording {
  samples: Float32Array
  sampleRate: number
  commandModeChanges: CommandModeChange[]
}

/**
 * Ölçüm için mikrofon oturumlarını ham ses olarak kaydeder. Mikrofonu açan
 * fonksiyonu sarar: kayıt açıksa gelen ses hem konuşma tanımaya hem kayda
 * gider; mikrofon kapanınca kayıt `onRecording` ile iletilir.
 */
export interface SessionRecorder {
  /** Açıkken her mikrofon oturumu kaydedilir. */
  enabled: boolean
  /** Mikrofon kapanınca biten kaydı alır. */
  onRecording: ((recording: SessionRecording) => void) | null
  /** Komut modunun değiştiğini kaydın o anına not eder; test aynı anda değiştirir. */
  markCommandMode(active: boolean): void
  wrap(openMicrophone: OpenMicrophone): OpenMicrophone
}

interface Session {
  length: number
  /** Komut modu değişiklikleri; kaydın kaçıncı örneğine denk geldikleriyle. */
  changes: { sample: number; active: boolean }[]
}

export function createSessionRecorder(): SessionRecorder {
  let commandMode = false
  let session: Session | null = null

  const recorder: SessionRecorder = {
    enabled: false,
    onRecording: null,

    markCommandMode(active) {
      commandMode = active
      session?.changes.push({ sample: session.length, active })
    },

    wrap(openMicrophone) {
      return async (onAudio) => {
        if (!recorder.enabled) return openMicrophone(onAudio)

        const chunks: Float32Array[] = []
        // Mikrofon komut tuşuyla açıldıysa kayıt komut modunda başlar.
        const current: Session = {
          length: 0,
          changes: commandMode ? [{ sample: 0, active: true }] : [],
        }
        session = current
        let microphone
        try {
          microphone = await openMicrophone((samples) => {
            chunks.push(samples.slice())
            current.length += samples.length
            onAudio(samples)
          })
        } catch (error) {
          session = null
          throw error
        }

        const { sampleRate } = microphone
        return {
          sampleRate,
          async close() {
            await microphone.close()
            if (session === current) session = null
            recorder.onRecording?.({
              samples: concatAudio(chunks),
              sampleRate,
              commandModeChanges: current.changes.map(({ sample, active }) => ({
                at: sample / sampleRate,
                active,
              })),
            })
          },
        }
      }
    },
  }
  return recorder
}
