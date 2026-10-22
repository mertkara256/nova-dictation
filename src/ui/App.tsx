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
import { forgetClearedDraft, loadClearedDraft, loadDraft, useDraftAutosave } from './draft.ts'
import { shorten } from './feedbackMessages.ts'
import { type PendingRecording, RecordingReview } from './RecordingReview.tsx'
import { SettingsIcon } from './icons.tsx'
import { Settings } from './Settings.tsx'
import { useShortcuts } from './shortcuts.ts'
import { StatusBadge } from './StatusBadge.tsx'
import { type PanelName, Toolbar } from './Toolbar.tsx'
import { useDictation } from './useDictation.ts'
import { useServiceStatus } from './useServiceStatus.ts'
import { useVocabulary } from './vocabularySetting.ts'
import { useWakeWord } from './wakeWordSetting.ts'

const speech = createSpeechService()

const errorMessages: Record<TranscriberError, string> = {
  permission: 'Mikrofon izni verilmedi. Adres çubuğundaki izin ayarından mikrofona izin ver.',
  'no-microphone': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine bağlanılamadı. İnternet bağlantını kontrol et.',
  unavailable: 'Konuşma tanıma şu an kullanılamıyor.',
  timeout: 'Whisper zamanında yanıt vermedi. Mikrofon kapatıldı; bekleyen ses henüz metne eklenmedi.',
  transcription: 'Ses yazıya çevrilemedi. Mikrofon kapatıldı; bekleyen ses henüz metne eklenmedi.',
}

/** Uygulama, en son kaydedilen taslakla açılır. */
function initEditor() {
  return { ...initialEditorState, text: loadDraft() }
}

function App() {
  const [editor, dispatch] = useReducer(editorReducer, undefined, initEditor)
  const { text, selection, feedback, log, pendingWake } = editor
  const dictation = useDictation(speech.transcriber)
  const serviceStatus = useServiceStatus(speech.isAvailable)
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [wakeWord, setWakeWord] = useWakeWord()
  const [vocabulary, setVocabulary] = useVocabulary()
  // Komut tuşu (⌃) basılıyken söylenenler komuttur. Mikrofon kapalıyken basıldıysa
  // yalnızca tuş basılı kaldığı süre için açılır.
  const [commandKey, setCommandKey] = useState<'up' | 'held' | 'unavailable'>('up')
  const micOpenedForCommand = useRef(false)
  // Ölçüm kaydı (yalnızca geliştirmede): mikrofon açıldığı andaki metin ve biten kayıt.
  const [testRecordingEnabled, setTestRecordingEnabled] = useState(false)
  const [pendingRecording, setPendingRecording] = useState<PendingRecording | null>(null)
  const recordingStart = useRef({ text, selection })
  const draft = useDraftAutosave(text)
  // Uygulama boş açıldıysa, önceki oturumda tamamen silinmiş metin geri getirilebilir.
  const [clearedDraft, setClearedDraft] = useState(() => (text ? '' : loadClearedDraft()))

  // "Nova, komutları göster" komut listesini açar.
  const [handledFeedbackId, setHandledFeedbackId] = useState<number | null>(null)
  if (feedback && feedback.id !== handledFeedbackId) {
    setHandledFeedbackId(feedback.id)
    if (feedback.type === 'show-help') setOpenPanel('commands')
  }

  // Sonradan çalışan işler (mikrofonu kapatma, kopyalama, gelen dikte) en güncel
  // değerleri buradan okur.
  const latest = useRef({ text, dictation, wakeWord, vocabulary })
  useLayoutEffect(() => {
    latest.current = { text, dictation, wakeWord, vocabulary }
  })

  useEffect(() => {
    speech.setVocabulary?.(vocabulary)
  }, [vocabulary])
  useEffect(() => {
    if (!dictation.listening && !dictation.finishing && !dictation.canRetry) dispatch({ type: 'speech-ended' })
  }, [dictation.listening, dictation.finishing, dictation.canRetry])
  useEffect(() => {
    const { recorder } = speech
    if (!recorder) return
    recorder.onRecording = (recording) =>
      setPendingRecording({
        id: Date.now(),
        recording,
        initialText: recordingStart.current.text,
        initialSelection: recordingStart.current.selection,
        wakeWord: latest.current.wakeWord,
        vocabulary: latest.current.vocabulary,
      })
    return () => {
      recorder.onRecording = null
    }
  }, [])

  useEffect(() => {
    if (feedback?.type === 'stop-listening') latest.current.dictation.stop()
    if (feedback?.type === 'copy') {
      navigator.clipboard.writeText(feedback.text).then(
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
    recordingStart.current = { text, selection }
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
    if (dictation.finishing || dictation.canRetry) return
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
    speech.recorder?.markCommandMode(true)
    setCommandKey('held')
  }

  function releaseCommandKey() {
    setCommandKey('up')
    dictation.setCommandMode(false)
    speech.recorder?.markCommandMode(false)
    if (micOpenedForCommand.current) {
      micOpenedForCommand.current = false
      dictation.stop()
    }
  }

  function restoreClearedDraft() {
    dispatch({ type: 'type', text: clearedDraft, selection: null })
    forgetClearedDraft()
    setClearedDraft('')
  }

  function setTestRecording(enabled: boolean) {
    if (speech.recorder) speech.recorder.enabled = enabled
    setTestRecordingEnabled(enabled)
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
        micAvailable={speech.transcriber !== null && !dictation.finishing && !dictation.canRetry}
        onToggleMic={toggleMic}
        onType={(value, range) => dispatch({ type: 'type', text: value, selection: range })}
        onSelect={(range) => dispatch({ type: 'select', selection: range })}
      />
      <Toolbar
        wordCount={countWords(text)}
        wakeWord={wakeWord}
        openPanel={openPanel}
        onCopy={() => runCommand({ type: 'copy', target: 'all' }, 'Kopyala düğmesi')}
        onDownload={(format) => downloadText(text, format)}
        onClear={() => runCommand({ type: 'delete-all' }, 'Temizle düğmesi')}
        onTogglePanel={togglePanel}
      />
      <div className="draft-status" data-status={draft.status}>
        <span role="status">
          {draft.status === 'saving' ? 'Taslak kaydediliyor…' :
            draft.status === 'saved' ? 'Taslak bu tarayıcıya kaydedildi.' :
              'Taslak kaydedilemedi. Sayfayı kapatmadan metnini indir.'}
        </span>
        {draft.status === 'failed' && (
          <>
            <button type="button" className="link-button" onClick={draft.retry}>Kaydetmeyi yeniden dene</button>
            <button type="button" className="link-button" disabled={!text} onClick={() => downloadText(text, 'txt')}>Metni indir</button>
          </>
        )}
      </div>
      {/* Komut tuşu basılıyken ya da tek başına "Nova" denip komut beklenirken. */}
      {(commandKey === 'held' || dictation.commandPartial || pendingWake) && (
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
      {clearedDraft && !text && (
        <p className="hint">
          Son silinen metin: “{shorten(clearedDraft)}”{' '}
          <button type="button" className="link-button" onClick={restoreClearedDraft}>
            Geri getir
          </button>
        </p>
      )}
      <CommandToast
        // Kopyalama başarısız olduysa "kopyalandı" bildirimi yerine aşağıdaki uyarı görünür.
        feedback={copyFailed && feedback?.type === 'copy' ? null : feedback}
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
      {dictation.error && !dictation.canRetry && !dictation.listening && !dictation.finishing && (
        <p className="hint">
          <button type="button" className="link-button" onClick={startListening}>Yeniden dinle</button>
        </p>
      )}
      {copyFailed && (
        <p className="notice">Metin panoya kopyalanamadı; metin alanından elle kopyalayabilirsin.</p>
      )}
      {pendingRecording && (
        <RecordingReview
          key={pendingRecording.id}
          pending={pendingRecording}
          resultText={text}
          onClose={() => setPendingRecording(null)}
        />
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
          vocabulary={
            speech.setVocabulary ? { words: vocabulary, onChange: setVocabulary } : undefined
          }
          testRecording={
            import.meta.env.DEV && speech.recorder
              ? { enabled: testRecordingEnabled, onChange: setTestRecording }
              : undefined
          }
          onClose={() => setOpenPanel(null)}
        />
      )}
    </main>
  )
}

export default App
