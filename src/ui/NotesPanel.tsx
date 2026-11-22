import { useState } from 'react'
import { ClearIcon } from './icons.tsx'
import { type Notes, byRecent, noteTitle } from './notes.ts'
import { Panel } from './Panel.tsx'

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

// Kimliği sabit olduğu için React bunu yalnızca düğme sayfaya girdiğinde çağırır.
const focusOnMount = (element: HTMLElement | null) => element?.focus()

interface NotesPanelProps {
  notes: Notes
  /** Açık notun şu anki metni; listedeki adı bundan alınır. */
  currentText: string
  /**
   * Mikrofon açıkken ya da bekleyen ses varken not değiştirilemez: o ana kadar
   * söylenenler sonradan yazıya çevrilir ve açık nota yazılır, başka bir nota değil.
   */
  locked: boolean
  onOpen(id: string): void
  onCreate(): void
  onDelete(id: string): void
  onClose(): void
}

/** Bu tarayıcıdaki notlar, en son değişen üstte: not açma, yeni not ve silme. */
export function NotesPanel({ notes, currentText, locked, onOpen, onCreate, onDelete, onClose }: NotesPanelProps) {
  // Silinmesi onay bekleyen not.
  const [confirming, setConfirming] = useState<string | null>(null)
  // Onaydan vazgeçilen not: silme düğmesi geri gelince odak ona döner, sayfaya düşmez.
  const [cancelled, setCancelled] = useState<string | null>(null)

  return (
    <Panel title="Notlar" onClose={onClose}>
      {locked && (
        <p className="panel-intro">Mikrofon açıkken ya da bekleyen ses yazıya çevrilirken not değiştirilemez.</p>
      )}
      <button
        type="button"
        className="button notes-new"
        disabled={locked || !currentText}
        title={currentText ? undefined : 'Açık not zaten boş'}
        onClick={onCreate}
      >
        Yeni not
      </button>
      <ul className="notes">
        {byRecent(notes.list).map((note) => {
          const open = note.id === notes.current
          const title = noteTitle(open ? currentText : note.text)
          return (
            <li key={note.id} className="note-row">
              {confirming === note.id ? (
                <>
                  <span className="note-confirm">“{title}” silinsin mi?</span>
                  <button
                    type="button"
                    className="link-button danger"
                    onClick={() => {
                      setConfirming(null)
                      onDelete(note.id)
                    }}
                  >
                    Sil
                  </button>
                  <button
                    ref={focusOnMount}
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setConfirming(null)
                      setCancelled(note.id)
                    }}
                  >
                    Vazgeç
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="note-open"
                    aria-current={open ? 'true' : undefined}
                    disabled={locked}
                    onClick={() => onOpen(note.id)}
                  >
                    <span className="note-title">{title}</span>
                    {open ? (
                      <span className="note-meta">Açık</span>
                    ) : (
                      <time className="note-meta" dateTime={new Date(note.updatedAt).toISOString()}>
                        {timeFormat.format(note.updatedAt)}
                      </time>
                    )}
                  </button>
                  <button
                    ref={cancelled === note.id ? focusOnMount : undefined}
                    type="button"
                    className="tool"
                    aria-label={`Notu sil: ${title}`}
                    title="Notu sil"
                    disabled={locked}
                    onClick={() => setConfirming(note.id)}
                  >
                    <ClearIcon />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
