import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { SettingsIcon } from './icons.tsx'
import { Settings } from './Settings.tsx'
import { useShortcuts } from './shortcuts.ts'
import { StatusBadge } from './StatusBadge.tsx'
import { type PanelName, Toolbar } from './Toolbar.tsx'
import { useDictation } from './useDictation.ts'
import { useServiceStatus } from './useServiceStatus.ts'
import { useWakeWord } from './wakeWordSetting.ts'

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
  const [wakeWord, setWakeWord] = useWakeWord()
  // Komut tuşu (⌃) basılıyken söylenenler komuttur. Mikrofon kapalıyken basıldıysa
  // yalnızca tuş basılı kaldığı süre için açılır.
  const [commandKey, setCommandKey] = useState<'up' | 'held' | 'unavailable'>('up')
  const micOpenedForCommand = useRef(false)
  useDraftAutosave(text)

  // "Nova, komutları göster" komut listesini açar.
  const [handledFeedbackId, setHandledFeedbackId] = useState<number | null>(null)
  if (feedback && feedback.id !== handledFeedbackId) {
    setHandledFeedbackId(feedback.id)
    if (feedback.type === 'show-help') setOpenPanel('commands')
  }

  // Sonradan çalışan işler (mikrofonu kapatma, kopyalama, gelen dikte) en güncel
  // değerleri buradan okur.
  const latest = useRef({ text, dictation, wakeWord })
  useLayoutEffect(() => {
    latest.current = { text, dictation, wakeWord }
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

  function startListening() {
    const spoken = (segment: string) => ({ segment, wakeWord: latest.current.wakeWord, at: Date.now() })
    dictation.start({
      onFinal: (segment) => dispatch({ type: 'dictate', ...spoken(segment) }),
      onCommand: (segment) => dispatch({ type: 'command-speech', ...spoken(segment) }),
    })
  }

  function toggleMic() {
    if (dictation.listening) dictation.stop()
    else startListening()
  }

  function pressCommandKey() {
    // Tarayıcının kendi tanıması komut modunu bilmez; söylenen metne yazılırdı.
    if (!dictation.supportsCommandMode || dictation.usingFallback || serviceStatus === 'offline') {
      setCommandKey('unavailable')
      return
    }
    if (!dictation.listening) {
      micOpenedForCommand.current = true
      startListening()
    }
    dictation.setCommandMode(true)
    setCommandKey('held')
  }

  function releaseCommandKey() {
    setCommandKey('up')
    dictation.setCommandMode(false)
    if (micOpenedForCommand.current) {
      micOpenedForCommand.current = false
      dictation.stop()
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
    commandKeyDown: pressCommandKey,
    commandKeyUp: releaseCommandKey,
  })

  // ⚡ OPTIMIZATION: Memoize word count to prevent expensive regex evaluation
  // on every partial dictation tick (which re-renders the entire App)
  const wordCount = useMemo(() => countWords(text), [text])

  return (
    <main className="app">
      <header className="app-header">
        <h1>Nova Dictation</h1>
        <div className="header-actions">
          <StatusBadge name={speech.name} status={serviceStatus} offlineHint={speech.offlineHint} />
          <button
            type="button"
            className="tool"
            aria-label="Ayarlar"
            title="Ayarlar"
            aria-pressed={openPanel === 'settings'}
            onClick={() => togglePanel('settings')}
          >
            <SettingsIcon />
          </button>
        </div>
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
        wordCount={wordCount}
        wakeWord={wakeWord}
        openPanel={openPanel}
        onCopy={() => runCommand({ type: 'copy' }, 'Kopyala düğmesi')}
        onDownload={(format) => downloadText(text, format)}
        onClear={() => runCommand({ type: 'delete-all' }, 'Temizle düğmesi')}
        onTogglePanel={togglePanel}
      />
      {(commandKey === 'held' || dictation.commandPartial) && (
        <p className="command-indicator" role="status">
          <span className="command-badge">Komut</span>
          {dictation.commandPartial || 'Dinleniyor…'}
        </p>
      )}
      {commandKey === 'unavailable' && (
        <p className="hint">
          Tuşla komut vermek için Whisper sunucusunun açık olması gerekiyor; şimdilik komutları
          “{wakeWord}” diyerek verebilirsin.
        </p>
      )}
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
      {openPanel === 'commands' && (
        <CommandHelp
          wakeWord={wakeWord}
          onChangeWakeWord={() => setOpenPanel('settings')}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === 'history' && (
        <CommandHistory log={log} wakeWord={wakeWord} onClose={() => setOpenPanel(null)} />
      )}
      {openPanel === 'settings' && (
        <Settings
          wakeWord={wakeWord}
          onWakeWordChange={setWakeWord}
          onClose={() => setOpenPanel(null)}
        />
      )}
    </main>
  )
}

export default App
