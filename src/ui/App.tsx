import { useReducer, useRef } from 'react'
import { editorReducer, initialEditorState } from '../core/editor.ts'
import { createTranscriber } from '../speech/index.ts'
import type { TranscriberError } from '../speech/transcriber.ts'
import { CommandToast } from './CommandToast.tsx'
import { MicIcon } from './MicIcon.tsx'
import { useAutoGrow } from './useAutoGrow.ts'
import { useDictation } from './useDictation.ts'
import { useTransient } from './useTransient.ts'

const transcriber = createTranscriber()

const errorMessages: Record<TranscriberError, string> = {
  permission: 'Mikrofon izni verilmedi. Adres çubuğundaki izin ayarından mikrofona izin ver.',
  'no-microphone': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine bağlanılamadı. İnternet bağlantını kontrol et.',
  unavailable: 'Konuşma tanıma şu an kullanılamıyor.',
}

// Yansımanın son satırı boş olsa bile yüksekliği olsun diye eklenen görünmez karakter.
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b)
const REMOVED_FLASH_MS = 1200

function App() {
  const [editor, dispatch] = useReducer(editorReducer, initialEditorState)
  const { text, feedback } = editor
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const dictation = useDictation(transcriber)

  // Silinen cümle, yeri hâlâ metnin sonundaysa kısa süre kırmızı ve üstü çizili görünür.
  const deletion = feedback?.type === 'deleted' ? feedback : null
  const flashing = useTransient(deletion?.id ?? null, REMOVED_FLASH_MS)
  const removed = flashing && deletion?.at === text.length ? withSeparator(text, deletion.removed) : ''
  // Henüz kesinleşmemiş metin, yazının devamında gri olarak görünür.
  const ghost = dictation.partial ? withSeparator(text + removed, dictation.partial) : ''
  useAutoGrow(editorRef, mirrorRef, text + removed + ghost)

  function toggleMic() {
    if (dictation.listening) {
      dictation.stop()
    } else {
      dictation.start((segment) => dispatch({ type: 'dictate', segment }))
    }
  }

  return (
    <main className="app">
      <h1>Nova Dictation</h1>
      <div className="composer">
        <div className="editor-area">
          {/* Metin alanının arkasındaki yansıma: aynı metni görünmez yazar, ara metni gri gösterir. */}
          <div ref={mirrorRef} className="editor-mirror" aria-hidden="true">
            {text}
            {removed && (
              <span key={deletion?.id} className="removed">
                {removed}
              </span>
            )}
            <span className="ghost">{ghost}</span>
            {ZERO_WIDTH_SPACE}
          </div>
          <textarea
            ref={editorRef}
            className="editor"
            rows={1}
            aria-label="Metin"
            placeholder={ghost || removed ? '' : 'Yaz ya da mikrofona basıp konuş…'}
            value={text}
            onChange={(event) => dispatch({ type: 'type', text: event.target.value })}
            onScroll={(event) => {
              if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop
            }}
          />
        </div>
        <button
          type="button"
          className="mic"
          aria-label="Mikrofon"
          aria-pressed={dictation.listening}
          title={dictation.listening ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
          disabled={!transcriber}
          onClick={toggleMic}
        >
          <MicIcon />
        </button>
      </div>
      <CommandToast feedback={feedback} onUndo={() => dispatch({ type: 'undo' })} />
      {!transcriber && <p className="notice">Bu tarayıcıda konuşma tanıma kullanılamıyor.</p>}
      {dictation.usingFallback && (
        <p className="hint">
          Ana konuşma tanıma servisine ulaşılamadı; tarayıcının kendi tanıması kullanılıyor
          (noktalama olmadan).
        </p>
      )}
      {dictation.error && (
        <p className="notice" role="alert">
          {errorMessages[dictation.error]}
        </p>
      )}
      <p className="hint">
        Komutlar: “Nova, son cümleyi sil” · “Nova, üç boş madde ekle” · “Nova, geri al”
      </p>
    </main>
  )
}

/** Eklenen metnin öncesine, gerekiyorsa bir boşluk koyar. */
function withSeparator(before: string, addition: string) {
  return (before && !/\s$/.test(before) ? ' ' : '') + addition
}

export default App
