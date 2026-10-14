import { useRef, useState } from 'react'
import { appendSegment } from '../core/text.ts'
import { createTranscriber } from '../speech/index.ts'
import type { TranscriberError } from '../speech/transcriber.ts'
import { MicIcon } from './MicIcon.tsx'
import { useAutoGrow } from './useAutoGrow.ts'
import { useDictation } from './useDictation.ts'

const transcriber = createTranscriber()

const errorMessages: Record<TranscriberError, string> = {
  permission: 'Mikrofon izni verilmedi. Adres çubuğundaki izin ayarından mikrofona izin ver.',
  'no-microphone': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine bağlanılamadı. İnternet bağlantını kontrol et.',
  unavailable: 'Konuşma tanıma şu an kullanılamıyor.',
}

function App() {
  const [text, setText] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const dictation = useDictation(transcriber)
  // Henüz kesinleşmemiş metin, yazının devamında gri olarak görünür.
  const separator = text && !/\s$/.test(text) ? ' ' : ''
  const ghost = dictation.partial ? separator + dictation.partial : ''
  useAutoGrow(editorRef, mirrorRef, text + ghost)

  function toggleMic() {
    if (dictation.listening) {
      dictation.stop()
    } else {
      dictation.start((segment) => setText((current) => appendSegment(current, segment)))
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
            <span className="ghost">{ghost}</span>
            {'​'}
          </div>
          <textarea
            ref={editorRef}
            className="editor"
            rows={1}
            aria-label="Metin"
            placeholder={ghost ? '' : 'Yaz ya da mikrofona basıp konuş…'}
            value={text}
            onChange={(event) => setText(event.target.value)}
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
    </main>
  )
}

export default App
