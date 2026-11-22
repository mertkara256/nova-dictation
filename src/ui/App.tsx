import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { Command } from '../commands/types.ts'
import { editorReducer, initialEditorState } from '../core/editor.ts'
import { CommandHelp } from './CommandHelp.tsx'
import { CommandHistory } from './CommandHistory.tsx'
import { CommandToast } from './CommandToast.tsx'
import { Composer } from './Composer.tsx'
import { DemoNotice } from './DemoNotice.tsx'
import { downloadText } from './download.ts'
import { forgetClearedDraft, loadClearedDraft, loadDraft, useDraftAutosave } from './draft.ts'
import { shorten } from './feedbackMessages.ts'
import { RecordingReview } from './RecordingReview.tsx'
import { SettingsIcon } from './icons.tsx'
import { Settings } from './Settings.tsx'
import { GettingStarted } from './GettingStarted.tsx'
import { NotesPanel } from './NotesPanel.tsx'
import { markSetupSeen, shouldShowSetup } from './setupSetting.ts'
import { useShortcuts } from './shortcuts.ts'
import { speech } from './speechService.ts'
import { SpeechNotices } from './SpeechNotices.tsx'
import { StatusBadge } from './StatusBadge.tsx'
import { type PanelName, Toolbar } from './Toolbar.tsx'
import { useCommandKey } from './useCommandKey.ts'
import { useDictation } from './useDictation.ts'
import { useMeasurementRecording } from './useMeasurementRecording.ts'
import { useNotes } from './useNotes.ts'
import { useServiceStatus } from './useServiceStatus.ts'
import { useVocabulary } from './vocabularySetting.ts'
import { useWakeWord } from './wakeWordSetting.ts'


/** Uygulama, en son kaydedilen taslakla açılır. */
function initEditor() {
  return { ...initialEditorState, text: loadDraft() }
}

function App() {
  const [editor, dispatch] = useReducer(editorReducer, undefined, initEditor)
  const { text, selection, feedback, log, pendingWake, paused } = editor
  const dictation = useDictation(speech.transcriber)
  const { status: serviceStatus, refresh: refreshService } = useServiceStatus(speech.isAvailable, speech.getStatus)
  const [openPanel, setOpenPanel] = useState<PanelName | null>(() =>
    shouldShowSetup(Boolean(text || loadClearedDraft())) ? 'setup' : null,
  )
  // Panoya kopyalanamayan komutun geçmişteki numarası; uyarı başka bir komut verilene kadar görünür.
  const [failedCopyId, setFailedCopyId] = useState<number | null>(null)
  const copyFailed = failedCopyId !== null && failedCopyId === log.at(-1)?.id
  const [wakeWord, setWakeWord] = useWakeWord()
  const [vocabulary, setVocabulary] = useVocabulary()
  const measurement = useMeasurementRecording({ wakeWord, vocabulary })
  const notes = useNotes(editor, dispatch)
  const commandKey = useCommandKey({
    blocked: openPanel === 'setup' || dictation.finishing || dictation.canRetry,
    supported: dictation.supportsCommandMode && !dictation.usingFallback && serviceStatus === 'ready',
    listening: dictation.listening,
    startListening,
    stopListening: dictation.stop,
    setCommandMode(active) {
      dictation.setCommandMode(active)
      speech.recorder?.markCommandMode(active)
    },
  })
  const draft = useDraftAutosave(text, notes.openId)
  // Uygulama boş açıldıysa, önceki oturumda tamamen silinmiş metin geri getirilebilir.
  const [clearedDraft, setClearedDraft] = useState(() => (text ? '' : loadClearedDraft()))

  // Sonradan çalışan işler (mikrofonu kapatma, gelen dikte) en güncel değerleri buradan okur.
  const latest = useRef({ dictation, wakeWord })
  useLayoutEffect(() => {
    latest.current = { dictation, wakeWord }
  })

  useEffect(() => {
    speech.setVocabulary?.(vocabulary)
  }, [vocabulary])
  useEffect(() => {
    if (!dictation.listening && !dictation.finishing && !dictation.canRetry) dispatch({ type: 'speech-ended' })
  }, [dictation.listening, dictation.finishing, dictation.canRetry])

  // Komutların sayfadaki işleri (listeyi açma, mikrofonu kapatma, panoya kopyalama) komut
  // geçmişinin yeni satırlarından yapılır. Ekrandaki bildirim yalnızca son komutu gösterir;
  // "kopyala ve her şeyi sil" gibi art arda komutlarda ilki atlanmasın. Geçmişin numaraları
  // not değişince sıfırlanmaz.
  const [helpLogId, setHelpLogId] = useState(0)
  const lastHelp = log.findLast((entry) => entry.detail?.type === 'show-help')
  if (lastHelp && lastHelp.id > helpLogId) {
    setHelpLogId(lastHelp.id)
    setOpenPanel('commands')
  }

  const handledLogId = useRef(0)
  useEffect(() => {
    for (const { id, detail } of log) {
      if (id <= handledLogId.current) continue
      handledLogId.current = id
      // Komut işlendiğinde henüz yazıya çevrilmemiş ses, komuttan sonra söylenmiştir; metne yazılmaz.
      if (detail?.type === 'stop-listening') latest.current.dictation.cancel()
      // Tarayıcının tanımasında ses Google'a gider; duraklatmak mikrofonu kapatır.
      if (detail?.type === 'pause-listening' && (latest.current.dictation.usingFallback || !speech.getStatus)) {
        latest.current.dictation.cancel()
      }
      if (detail?.type === 'copy') {
        navigator.clipboard.writeText(detail.text).catch(() => setFailedCopyId(id))
      }
      // Kesilen metin "yapıştır" için düzenleyicide de durur; panoya yazılamazsa uyarı gerekmez.
      if (detail?.type === 'cut') navigator.clipboard.writeText(detail.text).catch(() => {})
    }
  }, [log])

  /** Düğmeyle verilen komutu, sesli komutla aynı yoldan uygular. */
  function runCommand(command: Command, source: string) {
    dispatch({ type: 'command', command, source, at: Date.now() })
  }

  function startListening() {
    if (openPanel === 'setup' || serviceStatus === 'loading') return
    measurement.markStart(text, selection)
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

  function restoreClearedDraft() {
    dispatch({ type: 'type', text: clearedDraft, selection: null })
    forgetClearedDraft()
    setClearedDraft('')
  }

  function togglePanel(panel: PanelName) {
    if (openPanel === 'setup') markSetupSeen()
    if (panel === 'notes' && openPanel !== 'notes') notes.refresh()
    setOpenPanel(openPanel === panel ? null : panel)
  }

  /** Not değişince, önceki oturumda silinen metni geri getirme önerisi o nota ait olmaz. */
  function changeNote(change: () => void) {
    change()
    setClearedDraft('')
  }

  function closePanel() {
    if (openPanel === 'setup') markSetupSeen()
    setOpenPanel(null)
  }

  useShortcuts({
    toggleMic,
    escape: () => {
      if (dictation.listening) dictation.stop()
      else closePanel()
    },
    // Tarayıcının tanımasında komut modu hiç yok; orada ⌃ tuşu yok sayılır.
    commandKeyDown: () => {
      if (dictation.supportsCommandMode) commandKey.press()
    },
    commandKeyUp: commandKey.release,
  })

  return (
    <div className="app">
      <main>
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
        {import.meta.env.MODE === 'demo' && <DemoNotice />}
        <Composer
          text={text}
          selection={selection}
          feedback={feedback}
          partial={paused ? '' : dictation.partial}
          listening={dictation.listening}
          readLevel={dictation.readLevel}
          micAvailable={speech.transcriber !== null && openPanel !== 'setup' && serviceStatus !== 'loading' && !dictation.finishing && !dictation.canRetry}
          onToggleMic={toggleMic}
          onType={(value, range) => dispatch({ type: 'type', text: value, selection: range })}
          onSelect={(range) => dispatch({ type: 'select', selection: range })}
        />
        <Toolbar
          text={text}
          wakeWord={wakeWord}
          openPanel={openPanel}
          onCopy={() => runCommand({ type: 'copy', target: 'all' }, 'Kopyala düğmesi')}
          onDownload={(format) => downloadText(text, format)}
          onClear={() => runCommand({ type: 'delete-all' }, 'Temizle düğmesi')}
          onTogglePanel={togglePanel}
        />
        {/* Kayıt yolundayken sessizdir; yalnızca kaydedilemezse uyarı çıkar. */}
        {draft.status === 'failed' && (
          <div className="draft-status">
            <span role="alert">Taslak kaydedilemedi. Sayfayı kapatmadan metnini indir.</span>
            <button type="button" className="link-button" onClick={draft.retry}>Kaydetmeyi yeniden dene</button>
            <button type="button" className="link-button" disabled={!text} onClick={() => downloadText(text, 'txt')}>Metni indir</button>
          </div>
        )}
        {paused && dictation.listening && (
          <p className="command-indicator" role="status">
            <span className="command-badge">Duraklatıldı</span>
            Devam etmek için “{wakeWord}, devam et” de.
          </p>
        )}
        {/* Komut tuşu basılıyken ya da tek başına "Nova" denip komut beklenirken. */}
        {(commandKey.state === 'held' || dictation.commandPartial || pendingWake) && (
          <p className="command-indicator" role="status">
            <span className="command-badge">Komut</span>
            {dictation.commandPartial || 'Dinleniyor…'}
          </p>
        )}
        {openPanel === 'setup' && (
          <p className="hint">
            İlk kullanım rehberi açıkken bu metne dikte kapalı; komutları rehberde söyleyerek deneyebilirsin.
          </p>
        )}
        {commandKey.state === 'unavailable' && (
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
        <SpeechNotices
          available={speech.transcriber !== null}
          dictation={dictation}
          onListenAgain={startListening}
          allowFallback={speech.allowFallback}
        />
        {copyFailed && (
          <p className="notice" role="alert">Metin panoya kopyalanamadı; metin alanından elle kopyalayabilirsin.</p>
        )}
        {measurement.pending && (
          <RecordingReview
            key={measurement.pending.id}
            pending={measurement.pending}
            resultText={text}
            onClose={measurement.dismiss}
          />
        )}
      </main>
      {/* Açık panel: geniş ekranda metnin sağında durur, dar ekranda altında. */}
      {openPanel && (
        <aside className="side-panel">
          {openPanel === 'notes' && (
            <NotesPanel
              notes={notes.notes}
              currentText={text}
              locked={dictation.listening || dictation.finishing || dictation.canRetry}
              onOpen={(id) => changeNote(() => notes.open(id))}
              onCreate={() => changeNote(notes.create)}
              onDelete={(id) => changeNote(() => notes.remove(id))}
              onClose={() => setOpenPanel(null)}
            />
          )}
          {openPanel === 'commands' && (
            <CommandHelp
              wakeWord={wakeWord}
              commandKey={dictation.supportsCommandMode}
              onChangeWakeWord={() => setOpenPanel('settings')}
              onClose={() => setOpenPanel(null)}
            />
          )}
          {openPanel === 'history' && (
            <CommandHistory
              log={log}
              wakeWord={wakeWord}
              commandKey={dictation.supportsCommandMode}
              onClose={() => setOpenPanel(null)}
            />
          )}
          {openPanel === 'settings' && (
            <Settings
              wakeWord={wakeWord}
              onWakeWordChange={setWakeWord}
              onOpenSetup={() => setOpenPanel('setup')}
              setupDisabled={dictation.listening || dictation.finishing || dictation.canRetry}
              vocabulary={
                speech.setVocabulary ? { words: vocabulary, onChange: setVocabulary } : undefined
              }
              testRecording={
                import.meta.env.DEV && speech.recorder
                  ? { enabled: measurement.enabled, onChange: measurement.setEnabled }
                  : undefined
              }
              onClose={() => setOpenPanel(null)}
            />
          )}
          {openPanel === 'setup' && (
            <GettingStarted
              wakeWord={wakeWord}
              serviceName={speech.name}
              status={serviceStatus}
              localModel={Boolean(speech.getStatus)}
              transcriber={speech.transcriber}
              allowFallback={speech.allowFallback}
              onRecheck={() => { void refreshService() }}
              onClose={closePanel}
            />
          )}
        </aside>
      )}
    </div>
  )
}

export default App
