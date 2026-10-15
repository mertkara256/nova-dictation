import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { Command } from '../commands/types.ts'
import { editorReducer, initialEditorState } from '../core/editor.ts'
import { countWords } from '../core/text.ts'
import { createSpeechService } from '../speech/index.ts'
import type { TranscriberError } from '../speech/transcriber.ts'
import { CommandHelp } from './CommandHelp.tsx'
import { CommandHistory } from './CommandHistory.tsx'
import { CommandToast } from './CommandToast.tsx'
import { Composer } from './Composer.tsx'
import { downloadText } from './download.ts'
import { loadDraft, useDraftAutosave } from './draft.ts'
import { useShortcuts } from './shortcuts.ts'
import { StatusBadge } from './StatusBadge.tsx'
import { type PanelName, Toolbar } from './Toolbar.tsx'
import { useDictation } from './useDictation.ts'
import { useServiceStatus } from './useServiceStatus.ts'

const speech = createSpeechService()

const errorMessages: Record<TranscriberError, string> = {
  permission: 'Mikrofon izni verilmedi. Adres çubuğundaki izin ayarından mikrofona izin ver.',
  'no-microphone': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine bağlanılamadı. İnternet bağlantını kontrol et.',
  unavailable: 'Konuşma tanıma şu an kullanılamıyor.',
}

/** Uygulama, en son kaydedilen taslakla açılır. */
function initEditor() {
  return { ...initialEditorState, text: loadDraft() }
}

function App() {
  const [editor, dispatch] = useReducer(editorReducer, undefined, initEditor)
  const { text, selection, feedback, log } = editor
  const dictation = useDictation(speech.transcriber)
  const serviceStatus = useServiceStatus(speech.isAvailable)
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  useDraftAutosave(text)

  // "Nova, komutları göster" komut listesini açar.
  const [handledFeedbackId, setHandledFeedbackId] = useState<number | null>(null)
  if (feedback && feedback.id !== handledFeedbackId) {
    setHandledFeedbackId(feedback.id)
    if (feedback.type === 'show-help') setOpenPanel('commands')
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

  /** Düğmeyle verilen komutu, sesli komutla aynı yoldan uygular. */
  function runCommand(command: Command, source: string) {
    dispatch({ type: 'command', command, source, at: Date.now() })
  }

  function toggleMic() {
    if (dictation.listening) {
      dictation.stop()
    } else {
      dictation.start((segment) => dispatch({ type: 'dictate', segment, at: Date.now() }))
    }
  }

  function togglePanel(panel: PanelName) {
    setOpenPanel(openPanel === panel ? null : panel)
  }

  useShortcuts({
    toggleMic,
    escape: () => {
      if (dictation.listening) dictation.stop()
      else setOpenPanel(null)
    },
  })

  return (
    <main className="app">
      <header className="app-header">
        <h1>Nova Dictation</h1>
        <StatusBadge name={speech.name} status={serviceStatus} offlineHint={speech.offlineHint} />
      </header>
      <Composer
        text={text}
        selection={selection}
        feedback={feedback}
        partial={dictation.partial}
        listening={dictation.listening}
        readLevel={dictation.readLevel}
        micAvailable={speech.transcriber !== null}
        onToggleMic={toggleMic}
        onType={(value, range) => dispatch({ type: 'type', text: value, selection: range })}
        onSelect={(range) => dispatch({ type: 'select', selection: range })}
      />
      <Toolbar
        wordCount={countWords(text)}
        openPanel={openPanel}
        onCopy={() => runCommand({ type: 'copy' }, 'Kopyala düğmesi')}
        onDownload={(format) => downloadText(text, format)}
        onClear={() => runCommand({ type: 'delete-all' }, 'Temizle düğmesi')}
        onTogglePanel={togglePanel}
      />
      <CommandToast
        feedback={feedback}
        onUndo={() => runCommand({ type: 'undo' }, 'Geri al düğmesi')}
        onRedo={() => runCommand({ type: 'redo' }, 'Yinele düğmesi')}
      />
      {!speech.transcriber && (
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
        </p>
      )}
      {copyFailed && (
        <p className="notice">Metin panoya kopyalanamadı; metin alanından elle kopyalayabilirsin.</p>
      )}
      {openPanel === 'commands' && <CommandHelp onClose={() => setOpenPanel(null)} />}
      {openPanel === 'history' && <CommandHistory log={log} onClose={() => setOpenPanel(null)} />}
    </main>
  )
}

export default App
