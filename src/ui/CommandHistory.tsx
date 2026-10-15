import type { CommandLogEntry } from '../core/editor.ts'
import { describeFeedback } from './feedbackMessages.ts'
import { Panel } from './Panel.tsx'

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

interface CommandHistoryProps {
  log: CommandLogEntry[]
  wakeWord: string
  onClose(): void
}

/** Bu oturumda verilen komutları, en yenisi üstte olacak şekilde listeler. */
export function CommandHistory({ log, wakeWord, onClose }: CommandHistoryProps) {
  return (
    <Panel title="Komut geçmişi" onClose={onClose}>
      {log.length === 0 ? (
        <p className="panel-intro">
          Henüz komut verilmedi. “{wakeWord}” ile başlayan komutlar ve düğmelerle yapılanlar
          burada listelenir.
        </p>
      ) : (
        <ol className="history">
          {log.toReversed().map((entry) => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </Panel>
  )
}

function HistoryRow({ entry }: { entry: CommandLogEntry }) {
  // Sonucu olmayan komutlar (ör. "yeni satır") yalnızca uygulandı olarak gösterilir.
  const outcome = entry.detail ? describeFeedback(entry.detail) : { message: 'Uygulandı.' }
  return (
    <li className="history-row">
      <time dateTime={new Date(entry.at).toISOString()}>{timeFormat.format(entry.at)}</time>
      <div>
        <p className="history-source">
          {entry.via === 'voice' ? `“${entry.source}”` : entry.source}
        </p>
        <p className={outcome.failed ? 'history-result failed' : 'history-result'}>
          {outcome.message}
        </p>
      </div>
    </li>
  )
}
