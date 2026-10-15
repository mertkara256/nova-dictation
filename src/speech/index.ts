import { withFallback } from './fallback.ts'
import { openMicrophone } from './microphone.ts'
import { createWhisperPreview } from './preview.ts'
import { createWebSpeechTranscriber, getSpeechRecognition } from './providers/webSpeech.ts'
import { createWhisperServerTranscriber } from './providers/whisperServer.ts'
import type { Transcriber } from './transcriber.ts'
import { createWhisperClient } from './whisperClient.ts'

export type SpeechProvider = 'whisper' | 'webspeech'

/** Arayüzün konuşma tanıma hakkında bilmesi gerekenler. */
export interface SpeechService {
  /** Tarayıcı hiçbir servisi desteklemiyorsa null. */
  transcriber: Transcriber | null
  /** Arayüzde gösterilecek ad (ör. "Whisper"). */
  name: string
  /** Servisin şu an kullanılabilir olup olmadığını denetler (ör. sunucu açık mı). */
  isAvailable(): Promise<boolean>
  /** Servis kullanılamazken kullanıcıya gösterilecek açıklama. */
  offlineHint: string
}

/**
 * Uygulamanın kullanacağı konuşma tanıma servisini seçer. Servis, .env.local
 * dosyasındaki VITE_STT_PROVIDER ayarıyla değiştirilir:
 *
 * - whisper (varsayılan): bilgisayarda çalışan whisper.cpp sunucusu. Konuşurken
 *   metin de yaklaşık saniyede bir Whisper'dan önizleme olarak gösterilir.
 *   Sunucuya ulaşılamazsa tarayıcının konuşma tanımasına geçilir.
 * - webspeech: tarayıcının yerleşik konuşma tanıması (Chrome ve Safari).
 *
 * Yeni bir servis eklemek için providers/ altına bir dosya yazıp burada seçmek yeterli.
 */
export function createSpeechService(
  provider: SpeechProvider = import.meta.env.VITE_STT_PROVIDER ?? 'whisper',
): SpeechService {
  const Recognition = getSpeechRecognition()
  const webSpeech = Recognition ? createWebSpeechTranscriber(Recognition) : null

  switch (provider) {
    case 'webspeech':
      return {
        transcriber: webSpeech,
        name: 'Tarayıcı tanıması',
        isAvailable: async () => webSpeech !== null,
        offlineHint: 'Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome ya da Safari kullanabilirsin.',
      }
    case 'whisper': {
      const client = createWhisperClient('/whisper')
      return {
        transcriber: withFallback(
          createWhisperServerTranscriber({
            client,
            openMicrophone,
            preview: createWhisperPreview({ client }),
          }),
          webSpeech,
        ),
        name: 'Whisper',
        isAvailable: () => client.isUp(),
        offlineHint:
          'Whisper sunucusu çalışmıyor; şimdilik tarayıcının konuşma tanıması kullanılır. ' +
          'Başlatmak için terminalde “npm run whisper” komutunu çalıştır.',
      }
    }
  }
}
