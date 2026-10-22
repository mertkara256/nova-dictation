import { useReducer } from 'react'
import type { Command } from '../commands/types.ts'
import { editorReducer, initialEditorState } from '../core/editor.ts'
import { MicrophoneCheck } from './MicrophoneCheck.tsx'
import { Panel } from './Panel.tsx'
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
  onRecheck(): void
  onClose(): void
}

/** Mikrofon kontrolü ve komut denemesi, asıl taslaktan ayrı tutulur. */
export function GettingStarted({ wakeWord, serviceName, status, localModel, onRecheck, onClose }: GettingStartedProps) {
  const [demo, dispatch] = useReducer(editorReducer, {
    ...initialEditorState,
    text: 'Bugün bir deneme yapıyorum. İkinci cümle hazır.',
  })

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
          {!localModel && <p className="setting-help">Tarayıcı tanıması sesi çevrimiçi bir servise gönderebilir.</p>}
          <button type="button" className="link-button setup-action" disabled={status === 'checking'} onClick={onRecheck}>Durumu yeniden denetle</button>
        </li>
        <li>
          <h3>Mikrofonunu kontrol et</h3>
          <MicrophoneCheck />
        </li>
        <li>
          <h3>Üç komutu dene</h3>
          <p className="setting-help">Düğmelere sırayla tıkla ve aşağıdaki metni izle. Dikte sırasında aynı ifadeleri söyleyebilirsin.</p>
          <div className="setup-examples">
            {EXAMPLES.map(({ phrase, command, explanation }) => (
              <button key={phrase} type="button" className="setup-example" onClick={() => dispatch({ type: 'command', command, source: phrase, at: Date.now() })}>
                <strong>“{wakeWord}, {phrase}”</strong>
                <span>{explanation}</span>
              </button>
            ))}
          </div>
          <pre className="setup-demo" aria-label="Deneme metni" aria-live="polite">{demo.text}</pre>
        </li>
      </ol>
      <p className="setting-help">Hazır olduğunda rehberi kapat, editörde mikrofona bas ve konuş. Rehberi Ayarlar’dan tekrar açabilirsin.</p>
      <button type="button" className="button setup-action" onClick={onClose}>Editöre geç</button>
    </Panel>
  )
}
