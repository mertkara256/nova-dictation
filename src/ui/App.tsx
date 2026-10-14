import { useState } from 'react'
import { appendSegment } from '../core/text.ts'
import type { TranscriberError } from '../speech/transcriber.ts'
import { createWebSpeechTranscriber, getSpeechRecognition } from '../speech/webSpeech.ts'
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
  const dictation = useDictation(transcriber)

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
      <textarea
        className="editor"
        aria-label="Metin"
        placeholder="Metniniz burada görünecek…"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="toolbar">
        <button
          type="button"
          className="mic"
          aria-pressed={dictation.listening}
          disabled={!transcriber}
          onClick={toggleMic}
        >
          {dictation.listening ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
        </button>
        <p className="partial" aria-live="polite">
          {dictation.partial}
        </p>
      </div>
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
