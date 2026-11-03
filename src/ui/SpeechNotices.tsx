import type { TranscriberError } from '../speech/transcriber.ts'
import type { Dictation } from './useDictation.ts'

const errorMessages: Record<TranscriberError, string> = {
  permission: 'Mikrofon izni verilmedi. Adres çubuğundaki izin ayarından mikrofona izin ver.',
  'no-microphone': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine bağlanılamadı. İnternet bağlantını kontrol et.',
  unavailable: 'Konuşma tanıma şu an kullanılamıyor.',
  timeout: 'Whisper zamanında yanıt vermedi. Mikrofon kapatıldı; bekleyen ses henüz metne eklenmedi.',
  transcription: 'Ses yazıya çevrilemedi. Mikrofon kapatıldı; bekleyen ses henüz metne eklenmedi.',
}

interface SpeechNoticesProps {
  /** Bu tarayıcıda konuşma tanıma var mı? */
  available: boolean
  dictation: Dictation
  onListenAgain(): void
}

/** Konuşma tanımayla ilgili uyarılar: kullanılamaması, yedek tanıma, hatalar ve bekleyen ses. */
export function SpeechNotices({ available, dictation, onListenAgain }: SpeechNoticesProps) {
  return (
    <>
      {!available && (
        <p className="notice">Bu tarayıcıda konuşma tanıma kullanılamıyor.</p>
      )}
      {dictation.usingFallback && (
        <p className="hint">
          Ana konuşma tanıma servisine ulaşılamadı; tarayıcının kendi tanıması kullanılıyor
          (noktalama olmadan).
        </p>
      )}
      {dictation.error && (
        <p className="notice" role="alert">
          {errorMessages[dictation.error]}
          {!dictation.canRetry && !dictation.listening && !dictation.finishing && (
            <>
              {' '}
              <button type="button" className="link-button" onClick={onListenAgain}>Yeniden dinle</button>
            </>
          )}
        </p>
      )}
      {(dictation.finishing || dictation.canRetry) && (
        <div className="speech-recovery">
          <p role="status">
            {dictation.finishing ? 'Bekleyen ses yazıya çevriliyor…' :
              'Ses bu sekmede geçici olarak tutuluyor. Yeniden denersen bekleyen metin ve komutlar mevcut imleç konumunda işlenir. Sayfa kapanırsa bekleyen ses kaybolur.'}
          </p>
          {dictation.canRetry && !dictation.finishing && (
            <button type="button" className="button" onClick={dictation.retry}>Yeniden dene</button>
          )}
          <button type="button" className="link-button" onClick={dictation.cancel}>
            Bekleyen sesten vazgeç
          </button>
        </div>
      )}
    </>
  )
}
