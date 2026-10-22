import { toLowerTr } from '../core/text.ts'
import { downsample, encodeWav } from './audio.ts'

const WHISPER_SAMPLE_RATE = 16000
export const TRANSCRIPTION_TIMEOUT_MS = 30_000

export interface TranscribeOptions {
  /**
   * Whisper'a sesten önce söylenmiş gibi verilen ipucu metni. İçinde geçen
   * kelimeleri (ör. özel isimler) o yazımla yazmaya yatkın olur.
   */
  prompt?: string
  signal?: AbortSignal
  timeoutMs?: number
}

/** Bilgisayarda çalışan whisper.cpp sunucusuyla konuşur. */
export interface WhisperClient {
  isUp(): Promise<boolean>
  /** Ses kaydını yazıya çevirir; satır sonları ve fazla boşluklar sadeleştirilir. */
  transcribe(samples: Float32Array, sampleRate: number, options?: TranscribeOptions): Promise<string>
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

    async transcribe(samples, sampleRate, options = {}) {
      const wav = encodeWav(downsample(samples, sampleRate, WHISPER_SAMPLE_RATE), WHISPER_SAMPLE_RATE)
      const body = new FormData()
      body.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
      body.append('response_format', 'json')
      body.append('temperature', '0')
      if (options.prompt) body.append('prompt', options.prompt)
      const controller = new AbortController()
      const abort = () => controller.abort(options.signal?.reason)
      if (options.signal?.aborted) abort()
      else options.signal?.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(
        () => controller.abort(new DOMException('Whisper yanıt vermedi.', 'TimeoutError')),
        options.timeoutMs ?? TRANSCRIPTION_TIMEOUT_MS,
      )
      try {
        controller.signal.throwIfAborted()
        const response = await fetchFn(`${baseUrl}/inference`, {
          method: 'POST', body, signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Whisper sunucusu ${response.status} yanıtı verdi.`)
        const { text } = (await response.json()) as { text: string }
        return text.replace(/\s+/g, ' ').trim()
      } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', abort)
      }
    },
  }
}

/**
 * Kullanıcının özel kelime listesini her isteğe ipucu olarak ekleyen istemci.
 * Liste sonradan `setVocabulary` ile değiştirilebilir.
 */
export function withVocabulary(client: WhisperClient) {
  let vocabulary: string[] = []
  const prompted: WhisperClient = {
    isUp: () => client.isUp(),
    transcribe: async (samples, sampleRate, options) => {
      const prompt = vocabularyPrompt(vocabulary)
      const text = await client.transcribe(samples, sampleRate, { prompt, ...options })
      return restoreVocabularyWords(text, vocabulary)
    },
  }
  return {
    client: prompted,
    setVocabulary(words: string[]) {
      vocabulary = words
    },
  }
}

/** Kelime listesini Whisper'ın ipucu metnine çevirir ("Ayşe Hanım, Kubernetes."). */
export function vocabularyPrompt(words: string[]): string {
  return words.length > 0 ? `${words.join(', ')}.` : ''
}

/**
 * İpucundaki kelimeleri Whisper bazen özel isim sanıp sonlarını ek gibi kesme
 * işaretiyle ayırıyor ("Grafana" → "Grafan'a"). Kesme işareti kaldırılınca
 * listedeki bir kelimenin aynısı çıkıyorsa o kelimeyi geri koyar. "Ankara'ya"
 * gibi doğru kullanımlara dokunmaz; "Ankaraya" listede olmaz.
 */
export function restoreVocabularyWords(text: string, words: string[]): string {
  const known = new Map(
    words.flatMap((entry) => entry.split(' ')).map((word) => [toLowerTr(word), word]),
  )
  return text.replace(
    /(\p{L}+)['’](\p{L}+)/gu,
    (match, stem: string, suffix: string) => known.get(toLowerTr(stem + suffix)) ?? match,
  )
}
