import { withFallback } from './fallback.ts'
import { openMicrophone } from './microphone.ts'
import { createSherpaPreview } from './preview.ts'
import { createWebSpeechTranscriber, getSpeechRecognition } from './providers/webSpeech.ts'
import { createWhisperServerTranscriber } from './providers/whisperServer.ts'
import type { Transcriber } from './transcriber.ts'

export type SpeechProvider = 'whisper' | 'webspeech'

/**
 * Uygulamanın kullanacağı konuşma tanıma servisini seçer. Servis, .env.local
 * dosyasındaki VITE_STT_PROVIDER ayarıyla değiştirilir:
 *
 * - whisper (varsayılan): bilgisayarda çalışan whisper.cpp sunucusu. Konuşurken
 *   metin, Nemotron sunucusu çalışıyorsa ondan canlı olarak gösterilir. Whisper
 *   sunucusuna ulaşılamazsa tarayıcının konuşma tanımasına geçilir.
 * - webspeech: tarayıcının yerleşik konuşma tanıması (Chrome ve Safari).
 *
 * Yeni bir servis eklemek için providers/ altına bir dosya yazıp burada seçmek yeterli.
 */
export function createTranscriber(
  provider: SpeechProvider = import.meta.env.VITE_STT_PROVIDER ?? 'whisper',
): Transcriber | null {
  const Recognition = getSpeechRecognition()
  const webSpeech = Recognition ? createWebSpeechTranscriber(Recognition) : null

  switch (provider) {
    case 'webspeech':
      return webSpeech
    case 'whisper':
      return withFallback(
        createWhisperServerTranscriber({
          baseUrl: '/whisper',
          openMicrophone,
          preview: createSherpaPreview(webSocketUrl('/nemotron')),
        }),
        webSpeech,
      )
  }
}

function webSocketUrl(path: string) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}${path}`
}
