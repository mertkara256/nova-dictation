import { concatAudio } from './audio.ts'
import type { WhisperClient } from './whisperClient.ts'

export interface PreviewHandlers {
  /** O ana kadar tanınan metin; her çağrıda bir öncekinin yerine geçer. */
  onText(text: string): void
}

export interface PreviewSession {
  push(samples: Float32Array): void
  /** Parça bitti; önizleme durur. */
  finish(): void
  /** Parça atıldı; önizleme durur. */
  cancel(): void
}

/**
 * Konuşma sürerken metni gösteren yardımcı. Kesin metni üretmez; yalnızca
 * kullanıcı konuşurken ne söylediğini görsün diye kullanılır.
 */
export interface LivePreview {
  /** Yeni bir konuşma parçası için oturum açar. */
  open(sampleRate: number, handlers: PreviewHandlers): PreviewSession
}

// Sondaki bu kadarlık ses sessizse konuşmacının durakladığı kabul edilir.
const SILENCE_CHECK_MS = 300
// Konuşma algılamadaki eşikle aynı (yaklaşık -40 dBFS).
const SILENCE_LEVEL = 0.01

export interface WhisperPreviewOptions {
  client: WhisperClient
  /** İki önizleme isteği arasındaki en kısa süre. */
  intervalMs?: number
  /** Bundan kısa ses için önizleme istenmez; Whisper çok kısa seste kelime uydurabilir. */
  minAudioMs?: number
}

/**
 * Konuşma sürerken o ana kadarki sesi aralıklarla Whisper'a gönderip sonucu
 * önizleme olarak gösterir. Kesin metni yazan modelle aynı model olduğu için
 * önizleme doğrudur; ama her istek yaklaşık bir saniye sürdüğünden metin
 * kelime kelime değil, yaklaşık saniyede bir güncellenir. Bir istek sürerken
 * yenisi gönderilmez.
 *
 * Ses konuşmanın ortasında kesilip gönderildiği için son kelime çoğu zaman
 * yarımdır ve Whisper onu yanlış tamamlar ("gerekiyor" yerine "gerek"). Bu
 * yüzden son kelime gösterilmez; bir sonraki güncellemede tamamı gelir.
 * Ölçümlerde (`npm run bench`) bu, yanlış gri kelimeleri %9'dan %2'ye
 * indirdi; bedeli, önizlemenin yaklaşık bir kelime geriden gelmesi.
 */
export function createWhisperPreview({
  client,
  intervalMs = 1000,
  minAudioMs = 1000,
}: WhisperPreviewOptions): LivePreview {
  return {
    open(sampleRate, handlers) {
      const chunks: Float32Array[] = []
      const minLength = (sampleRate * minAudioMs) / 1000
      let length = 0
      let sentLength = 0
      let lastSentAt = -Infinity
      let busy = false
      let closed = false
      let timer: ReturnType<typeof setTimeout> | null = null

      // Önceki istek biter bitmez, son gönderimden bu yana en az intervalMs
      // geçtiyse yenisini gönderir; böylece güncelleme sıklığı Whisper'ın hızıyla sınırlı kalır.
      const schedule = () => {
        if (closed || busy || timer) return
        const wait = Math.max(0, lastSentAt + intervalMs - Date.now())
        timer = setTimeout(() => {
          timer = null
          void update()
        }, wait)
      }

      const update = async () => {
        if (busy || closed || length === sentLength || length < minLength) return
        // Konuşmacı durakladıysa parça birazdan bitecek; kesin metin isteğinin
        // önünü tıkamamak için önizleme istenmez.
        if (endsWithSilence(chunks, (sampleRate * SILENCE_CHECK_MS) / 1000)) {
          lastSentAt = Date.now()
          schedule()
          return
        }
        busy = true
        sentLength = length
        lastSentAt = Date.now()
        try {
          const text = await client.transcribe(concatAudio(chunks), sampleRate)
          if (!closed) handlers.onText(withoutLastWord(text))
        } catch {
          // Önizleme alınamazsa atlanır; kesin metin yine gelir.
        } finally {
          busy = false
          schedule()
        }
      }

      const close = () => {
        closed = true
        if (timer) clearTimeout(timer)
      }

      return {
        push(samples) {
          chunks.push(samples)
          length += samples.length
          schedule()
        },
        finish: close,
        cancel: close,
      }
    },
  }
}

/** Metnin son kelimesini, yanındaki noktalamayla birlikte atar. */
function withoutLastWord(text: string): string {
  return text.replace(/\s*\S+\s*$/, '')
}

/** Ses bloklarının son `count` örneğinin ortalama seviyesi sessizlik eşiğinin altında mı? */
function endsWithSilence(chunks: Float32Array[], count: number): boolean {
  let sum = 0
  let seen = 0
  for (let i = chunks.length - 1; i >= 0 && seen < count; i--) {
    const chunk = chunks[i]
    for (let j = chunk.length - 1; j >= 0 && seen < count; j--) {
      sum += chunk[j] * chunk[j]
      seen++
    }
  }
  return seen > 0 && Math.sqrt(sum / seen) < SILENCE_LEVEL
}
