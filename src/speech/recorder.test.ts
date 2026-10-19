import { describe, expect, it, vi } from 'vitest'
import type { OpenMicrophone } from './microphone.ts'
import { createSessionRecorder } from './recorder.ts'

const RATE = 16000

/** Sesi testin elle verdiği sahte mikrofon. */
function fakeMicrophone() {
  let onAudio: ((samples: Float32Array) => void) | null = null
  const open: OpenMicrophone = async (callback) => {
    onAudio = callback
    return { sampleRate: RATE, close: async () => {} }
  }
  return { open, play: (seconds: number) => onAudio?.(new Float32Array(RATE * seconds).fill(0.1)) }
}

describe('createSessionRecorder', () => {
  it('açıkken oturumun sesini kaydeder ve konuşma tanımaya da iletir', async () => {
    const recorder = createSessionRecorder()
    recorder.enabled = true
    recorder.onRecording = vi.fn()
    const microphone = fakeMicrophone()
    const onAudio = vi.fn()

    const mic = await recorder.wrap(microphone.open)(onAudio)
    microphone.play(0.5)
    microphone.play(0.25)
    await mic.close()

    expect(onAudio).toHaveBeenCalledTimes(2)
    expect(recorder.onRecording).toHaveBeenCalledWith({
      samples: expect.any(Float32Array),
      sampleRate: RATE,
      commandModeChanges: [],
    })
    expect(vi.mocked(recorder.onRecording!).mock.calls[0][0].samples).toHaveLength(RATE * 0.75)
  })

  it('komut modunun değiştiği anları kaydın zamanına göre not eder', async () => {
    const recorder = createSessionRecorder()
    recorder.enabled = true
    recorder.onRecording = vi.fn()
    const microphone = fakeMicrophone()

    // Mikrofon komut tuşuyla açıldı: kayıt komut modunda başlar.
    recorder.markCommandMode(true)
    const mic = await recorder.wrap(microphone.open)(() => {})
    microphone.play(1.5)
    recorder.markCommandMode(false)
    microphone.play(0.5)
    await mic.close()

    expect(vi.mocked(recorder.onRecording!).mock.calls[0][0].commandModeChanges).toEqual([
      { at: 0, active: true },
      { at: 1.5, active: false },
    ])
  })

  it('kapalıyken mikrofonu olduğu gibi açar ve kaydetmez', async () => {
    const recorder = createSessionRecorder()
    recorder.onRecording = vi.fn()
    const microphone = fakeMicrophone()

    const mic = await recorder.wrap(microphone.open)(() => {})
    microphone.play(1)
    await mic.close()

    expect(recorder.onRecording).not.toHaveBeenCalled()
  })
})
