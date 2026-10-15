import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { Range } from '../core/document.ts'
import { editorReducer, initialEditorState } from '../core/editor.ts'
import { createTranscriber } from '../speech/index.ts'
import type { TranscriberError } from '../speech/transcriber.ts'
import { CommandHelp } from './CommandHelp.tsx'
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
  const { text, selection, feedback } = editor
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const dictation = useDictation(transcriber)
  const [helpOpen, setHelpOpen] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  // İmleç metnin sonundaysa ara metin ve silme vurgusu yazının devamında gösterilir.
  const atEnd = selection === null
  const deletion = feedback?.type === 'deleted' ? feedback : null
  const flashing = useTransient(deletion?.id ?? null, REMOVED_FLASH_MS)
  const removed =
    atEnd && flashing && deletion?.at === text.length ? withSeparator(text, deletion.removed) : ''
  const ghost = atEnd && dictation.partial ? withSeparator(text + removed, dictation.partial) : ''
  useAutoGrow(editorRef, mirrorRef, text + removed + ghost)

  // Sesli komutların taşıdığı imleci ve seçimi metin alanına da yansıt.
  useLayoutEffect(() => {
    const element = editorRef.current
    if (!element) return
    const start = selection?.start ?? text.length
    const end = selection?.end ?? text.length
    if (element.selectionStart !== start || element.selectionEnd !== end) {
      element.setSelectionRange(start, end)
    }
  }, [selection, text])

  // "Nova, komutları göster" yardım panelini açar.
  const [handledFeedbackId, setHandledFeedbackId] = useState<number | null>(null)
  if (feedback && feedback.id !== handledFeedbackId) {
    setHandledFeedbackId(feedback.id)
    if (feedback.type === 'show-help') setHelpOpen(true)
  }

  // Mikrofonu kapatma ve kopyalama, yeni bildirim geldiğinde en güncel değerlerle yapılır.
  const latest = useRef({ text, dictation })
  useLayoutEffect(() => {
    latest.current = { text, dictation }
  })
  useEffect(() => {
    if (feedback?.type === 'stop-listening') latest.current.dictation.stop()
    if (feedback?.type === 'copy') {
      navigator.clipboard.writeText(latest.current.text).then(
        () => setCopyFailed(false),
        () => setCopyFailed(true),
      )
    }
  }, [feedback])

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
          {/* Metin alanının arkasındaki yansıma: aynı metni görünmez yazar; imleci,
              seçimi, silinen cümleyi ve ara metni gösterir. */}
          <div ref={mirrorRef} className="editor-mirror" aria-hidden="true">
            {selection ? <MirroredSelection text={text} selection={selection} /> : text}
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
            onChange={(event) =>
              dispatch({ type: 'type', text: event.target.value, selection: rangeOf(event.target) })
            }
            onSelect={(event) => dispatch({ type: 'select', selection: rangeOf(event.currentTarget) })}
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
      {/* İmleç metnin ortasındayken ara metin yazının içinde değil, burada görünür. */}
      {!atEnd && dictation.partial && <p className="pending">{dictation.partial}</p>}
      <CommandToast
        feedback={feedback}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
      />
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
      {copyFailed && (
        <p className="notice">Metin panoya kopyalanamadı; metin alanından elle kopyalayabilirsin.</p>
      )}
      {helpOpen ? (
        <CommandHelp onClose={() => setHelpOpen(false)} />
      ) : (
        <p className="hint">
          Komutlar “Nova” ile başlar.{' '}
          <button type="button" className="link-button" onClick={() => setHelpOpen(true)}>
            Bütün komutları gör
          </button>
        </p>
      )}
    </main>
  )
}

/** Yansımada imleci ince bir çizgiyle, seçimi vurguyla gösterir. */
function MirroredSelection({ text, selection }: { text: string; selection: Range }) {
  const { start, end } = selection
  return (
    <>
      {text.slice(0, start)}
      {start === end ? (
        <span className="caret" />
      ) : (
        <mark className="selection">{text.slice(start, end)}</mark>
      )}
      {text.slice(end)}
    </>
  )
}

function rangeOf(element: HTMLTextAreaElement): Range {
  return { start: element.selectionStart, end: element.selectionEnd }
}

/** Eklenen metnin öncesine, gerekiyorsa bir boşluk koyar. */
function withSeparator(before: string, addition: string) {
  return (before && !/\s$/.test(before) ? ' ' : '') + addition
}

export default App
