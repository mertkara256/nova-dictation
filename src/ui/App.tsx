import { useRef, useState } from 'react'
import { appendSegment } from '../core/text.ts'
import type { TranscriberError } from '../speech/transcriber.ts'
import { createWebSpeechTranscriber, getSpeechRecognition } from '../speech/webSpeech.ts'
import { MicIcon } from './MicIcon.tsx'
import { useAutoGrow } from './useAutoGrow.ts'
import { useDictation } from './useDictation.ts'

const Recognition = getSpeechRecognition()
const transcriber = Recognition ? createWebSpeechTranscriber(Recognition) : null

const errorMessages: Record<TranscriberError, string> = {
  permission: 'Mikrofon izni verilmedi. Adres çubuğundaki izin ayarından mikrofona izin ver.',
  'no-microphone': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine bağlanılamadı. İnternet bağlantını kontrol et.',
  unavailable: 'Konuşma tanıma bu tarayıcıda şu an kullanılamıyor.',
}

function App() {
  const [text, setText] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const dictation = useDictation(transcriber)
  useAutoGrow(editorRef, text)

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
        <textarea
          ref={editorRef}
          className="editor"
          rows={1}
          aria-label="Metin"
          placeholder="Yaz ya da mikrofona basıp konuş…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
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
      <p className="partial" aria-live="polite">
        {dictation.partial}
      </p>
      {!transcriber && (
        <p className="notice">
          Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Safari kullan.
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
