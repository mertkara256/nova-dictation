import { useEffect, useReducer, useState } from 'react'
import type { Command } from '../commands/types.ts'
import { editorReducer, initialEditorState } from '../core/editor.ts'
import type { Transcriber } from '../speech/transcriber.ts'
import { MicrophoneCheck } from './MicrophoneCheck.tsx'
import { Panel } from './Panel.tsx'
import { SpeechNotices } from './SpeechNotices.tsx'
import { useDictation } from './useDictation.ts'
import { useListeningCommands } from './useListeningCommands.ts'
import type { ServiceStatus } from './useServiceStatus.ts'

const EXAMPLES: { phrase: string; command: Command; explanation: string }[] = [
  { phrase: 'son cümleyi sil', command: { type: 'delete-sentence', which: 'last' }, explanation: 'Son cümleyi kaldırır.' },
  { phrase: 'geri al', command: { type: 'undo' }, explanation: 'Silinen cümleyi geri getirir.' },
  { phrase: 'yeni paragraf', command: { type: 'insert-break', kind: 'paragraph' }, explanation: 'Yeni bir paragraf açar.' },
]

interface GettingStartedProps {
  wakeWord: string
  serviceName: string
  status: ServiceStatus
  localModel: boolean
  /** Komutları söyleyerek denemek için; tarayıcıda konuşma tanıma yoksa null. */
  transcriber: Transcriber | null
  /** Whisper'a ulaşılamazsa tarayıcının tanımasına geçmeye izin verir. */
  allowFallback?(): void
  onRecheck(): void
  onClose(): void
}

/**
 * Mikrofon kontrolü ve komut denemesi, asıl taslaktan ayrı tutulur. Komutlar
 * söylenerek denenir: rehberin mikrofonuyla söylenenler yalnızca deneme metnine
 * yazılır ve sesle uygulanan örnek komutun yanına işaret konur.
 */
export function GettingStarted({ wakeWord, serviceName, status, localModel, transcriber, allowFallback, onRecheck, onClose }: GettingStartedProps) {
  const [demo, dispatch] = useReducer(editorReducer, {
    ...initialEditorState,
    text: 'Bugün bir deneme yapıyorum. İkinci cümle hazır.',
  })
  const dictation = useDictation(transcriber)
  useListeningCommands(demo.log, dictation, localModel)
  const [heard, setHeard] = useState('')
  const spoken = EXAMPLES.map(({ command }) =>
    demo.log.some((entry) => entry.via === 'voice' && entry.command && isExample(command, entry.command)),
  )
  const idle = !dictation.listening && !dictation.finishing && !dictation.canRetry

  // Mikrofon kapanınca tek başına söylenmiş komut kelimesi unutulur; asıl metindeki gibi.
  useEffect(() => {
    if (idle) dispatch({ type: 'speech-ended' })
  }, [idle])

  function listen() {
    dictation.start({
      onFinal: (segment) => {
        setHeard(segment.trim())
        dispatch({ type: 'dictate', segment, wakeWord, at: Date.now() })
      },
      // Komut tuşu (⌃) rehber açıkken kapalıdır; buraya bir şey gelmez.
      onCommand: () => {},
    })
  }

  return (
    <Panel title="İlk kullanım rehberi" onClose={onClose}>
      <p className="panel-intro">Birkaç adımda hazır ol. Bu alandaki denemeler taslağını değiştirmez.</p>
      <ol className="setup-steps">
        <li>
          <h3>Konuşma tanımayı hazırla</h3>
          <p className="setting-help" role="status">
            {serviceName}: {status === 'checking' ? 'bağlantı denetleniyor…' :
              status === 'ready' ? 'servis bağlantısı hazır.' :
                status === 'loading' ? 'servis açık, model yükleniyor…' : 'servise ulaşılamıyor.'}
          </p>
          {localModel && <p className="setting-help">
            Model: {status === 'ready' ? 'yüklendi, dikteye hazır.' :
              status === 'loading' ? 'yüklenmesi bekleniyor.' : 'hazır olduğu henüz doğrulanamadı.'}
          </p>}
          {localModel && status !== 'ready' && (
            <div className="setup-install">
              <p>Kurulumu tamamladıysan proje klasöründe <code>npm start</code> çalıştır ve modelin yüklenmesini bekle.</p>
              <p>İlk kurulumda Whisper ve model dosyaları gerekir. <a href="https://github.com/mertkara256/nova-dictation#whisper-kurulumu" target="_blank" rel="noreferrer">macOS / Windows kurulum adımlarını aç</a>.</p>
            </div>
          )}
          {!localModel && <p className="setting-help">Tarayıcının tanımasında ses Google'a ya da Apple'a gider.</p>}
          <button type="button" className="link-button setup-action" disabled={status === 'checking'} onClick={onRecheck}>Durumu yeniden denetle</button>
        </li>
        <li>
          <h3>Mikrofonunu kontrol et</h3>
          <MicrophoneCheck />
        </li>
        <li>
          <h3>Üç komutu söyle</h3>
          {transcriber ? (
            <>
              <p className="setting-help">
                Mikrofonu açıp komutları sırayla söyle; anlaşılan komutun yanına işaret konur. Söylediklerin
                yalnızca aşağıdaki deneme metnine yazılır. Düğmelere basarak da deneyebilirsin.
              </p>
              <div className="setup-listen">
                <button
                  type="button"
                  className="button"
                  aria-pressed={dictation.listening}
                  disabled={!dictation.listening && (!idle || status === 'checking' || status === 'loading')}
                  onClick={dictation.listening ? dictation.stop : listen}
                >
                  {dictation.listening ? 'Dinlemeyi bitir' : 'Mikrofonu aç'}
                </button>
                {dictation.listening && (
                  <span className="setting-help" role="status">{dictation.partial || 'Dinleniyor…'}</span>
                )}
              </div>
            </>
          ) : (
            <p className="setting-help">Düğmelere sırayla tıkla ve aşağıdaki metni izle.</p>
          )}
          <div className="setup-examples">
            {EXAMPLES.map(({ phrase, command, explanation }, index) => (
              <button key={phrase} type="button" className="setup-example" onClick={() => dispatch({ type: 'command', command, source: phrase, at: Date.now() })}>
                <strong>“{wakeWord}, {phrase}”</strong>
                <span>{spoken[index] ? '✓ Söylendi' : explanation}</span>
              </button>
            ))}
          </div>
          {heard && <p className="setting-help">Son duyulan: “{heard}”</p>}
          <pre className="setup-demo" aria-label="Deneme metni" aria-live="polite">{demo.text}</pre>
          {spoken.every(Boolean) && (
            <p className="setup-success" role="status">Üç komut da sesle çalıştı: mikrofon, konuşma tanıma ve komutlar hazır.</p>
          )}
          {transcriber && <SpeechNotices available dictation={dictation} onListenAgain={listen} allowFallback={allowFallback} />}
        </li>
      </ol>
      <p className="setting-help">Hazır olduğunda rehberi kapat, editörde mikrofona bas ve konuş. Rehberi Ayarlar’dan tekrar açabilirsin.</p>
      <button type="button" className="button setup-action" onClick={onClose}>Editöre geç</button>
    </Panel>
  )
}

/** Söylenen komut örnekteki komut mu? Örnekte olmayan ayrıntılar (ör. "iki kere geri al") fark etmez. */
function isExample(example: Command, spoken: Command): boolean {
  const fields = spoken as unknown as Record<string, unknown>
  return Object.entries(example).every(([key, value]) => fields[key] === value)
}
