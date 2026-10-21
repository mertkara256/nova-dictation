import type { TranscriberError } from './transcriber.ts'

export interface Microphone {
  sampleRate: number
  close(): Promise<void>
}

/** Mikrofonu açar ve gelen sesi tek kanallı ham örnekler olarak iletir. */
export type OpenMicrophone = (onAudio: (samples: Float32Array) => void) => Promise<Microphone>

// Ses işleme ayrı bir iş parçacığında çalışır; gelen her ses bloğunu ana sayfaya iletir.
const recorderSource = `
class NovaRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0][0]
    if (channel) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('nova-recorder', NovaRecorder)
`

export const openMicrophone: OpenMicrophone = async (onAudio) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  try {
    return await listen(stream, onAudio)
  } catch (error) {
    // Ses işleme kurulamazsa mikrofon açık kalmasın.
    for (const track of stream.getTracks()) track.stop()
    throw error
  }
}

/** Mikrofon akışını ses işleyiciye bağlar; kurulamazsa ses bağlamını kapatır. */
async function listen(stream: MediaStream, onAudio: (samples: Float32Array) => void): Promise<Microphone> {
  const context = new AudioContext()
  try {
    const moduleUrl = URL.createObjectURL(
      new Blob([recorderSource], { type: 'application/javascript' }),
    )
    try {
      await context.audioWorklet.addModule(moduleUrl)
    } finally {
      URL.revokeObjectURL(moduleUrl)
    }
    if (context.state === 'suspended') await context.resume()

    const source = context.createMediaStreamSource(stream)
    const recorder = new AudioWorkletNode(context, 'nova-recorder')
    recorder.port.onmessage = (event: MessageEvent<Float32Array>) => onAudio(event.data)
    // Hoparlöre sessizlik gider; bağlantı, tarayıcının sesi işlemeye devam etmesi için gerekli.
    source.connect(recorder).connect(context.destination)

    return {
      sampleRate: context.sampleRate,
      async close() {
        recorder.port.onmessage = null
        source.disconnect()
        recorder.disconnect()
        for (const track of stream.getTracks()) track.stop()
        await context.close()
      },
    }
  } catch (error) {
    await context.close()
    throw error
  }
}

export function toMicrophoneError(error: unknown): TranscriberError {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'permission'
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return 'no-microphone'
    }
  }
  return 'unavailable'
}
