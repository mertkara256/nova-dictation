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
  /** Whisper'a ulaşılamazsa tarayıcının tanımasına geçmeye izin verir; böyle bir yedek yoksa tanımsız. */
  allowFallback?(): void
}

/** Konuşma tanımayla ilgili uyarılar: kullanılamaması, yedek tanıma, hatalar ve bekleyen ses. */
export function SpeechNotices({ available, dictation, onListenAgain, allowFallback }: SpeechNoticesProps) {
  const idle = !dictation.listening && !dictation.finishing
  // Tarayıcının tanımasına sormadan geçilmez: ses o zaman bilgisayardan çıkar.
  const offerFallback = dictation.error === 'unavailable' && allowFallback !== undefined

  function continueWithBrowser() {
    allowFallback?.()
    onListenAgain()
  }

  return (
    <>
      {!available && (
        <p className="notice">Bu tarayıcıda konuşma tanıma kullanılamıyor; Chrome ya da Safari'de açabilirsin.</p>
      )}
      {dictation.usingFallback && (
        <p className="hint">
          Whisper'a ulaşılamadığı için tarayıcının kendi tanıması kullanılıyor; ses Google'a ya da Apple'a
          gidiyor. Bu tanıma noktalama koymadığı için her duraklamaya nokta konur.
        </p>
      )}
      {offerFallback && (
        <div className="speech-recovery">
          <p role="alert">
            Whisper sunucusuna ulaşılamadı; mikrofon kapalı. Başlatmak için proje klasöründe terminalde{' '}
            <code>npm run whisper</code> komutunu çalıştır, sonra yeniden dinle. Whisper kurulu değilse{' '}
            <a href="https://github.com/mertkara256/nova-dictation#whisper-kurulumu" target="_blank" rel="noreferrer">
              kurulum adımlarına bak
            </a>
            .
          </p>
          <p>
            İstersen tarayıcının kendi tanımasıyla devam edebilirsin. O zaman ses bilgisayardan çıkar, Google'a
            ya da Apple'a gider. Bu izin sayfa açık kaldığı sürece geçerli.
          </p>
          {idle && (
            <>
              <button type="button" className="button" onClick={continueWithBrowser}>
                Tarayıcının tanımasıyla devam et
              </button>
              <button type="button" className="link-button" onClick={onListenAgain}>Yeniden dinle</button>
            </>
          )}
        </div>
      )}
      {dictation.error && !offerFallback && (
        <p className="notice" role="alert">
          {errorMessages[dictation.error]}
          {!dictation.canRetry && idle && (
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
