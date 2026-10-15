import { downsample, encodeWav } from './audio.ts'

const WHISPER_SAMPLE_RATE = 16000

/** Bilgisayarda çalışan whisper.cpp sunucusuyla konuşur. */
export interface WhisperClient {
  isUp(): Promise<boolean>
  /** Ses kaydını yazıya çevirir; satır sonları ve fazla boşluklar sadeleştirilir. */
  transcribe(samples: Float32Array, sampleRate: number): Promise<string>
}

/**
 * @param baseUrl whisper.cpp sunucusunun adresi (geliştirmede Vite'ın /whisper yönlendirmesi)
 */
export function createWhisperClient(
  baseUrl: string,
  fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
): WhisperClient {
  return {
    async isUp() {
      try {
        const response = await fetchFn(`${baseUrl}/`, { signal: AbortSignal.timeout(2000) })
        return response.ok
      } catch {
        return false
      }
    },

    async transcribe(samples, sampleRate) {
      const wav = encodeWav(downsample(samples, sampleRate, WHISPER_SAMPLE_RATE), WHISPER_SAMPLE_RATE)
      const body = new FormData()
      body.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
      body.append('response_format', 'json')
      body.append('temperature', '0')
      const response = await fetchFn(`${baseUrl}/inference`, { method: 'POST', body })
      if (!response.ok) throw new Error(`Whisper sunucusu ${response.status} yanıtı verdi.`)
      const { text } = (await response.json()) as { text: string }
      return text.replace(/\s+/g, ' ').trim()
    },
  }
}
