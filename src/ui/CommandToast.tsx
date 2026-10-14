import type { EditorFeedback } from '../core/editor.ts'
import { useTransient } from './useTransient.ts'

const VISIBLE_MS = 6000

interface CommandToastProps {
  feedback: EditorFeedback | null
  onUndo(): void
}

/** Son komutun sonucunu kısa süre gösterir; gerekiyorsa "Geri al" düğmesi sunar. */
export function CommandToast({ feedback, onUndo }: CommandToastProps) {
  const visible = useTransient(feedback?.id ?? null, VISIBLE_MS)
  if (!feedback || !visible) return null

  const { message, undoable } = describe(feedback)
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {undoable && (
        <button type="button" className="toast-action" onClick={onUndo}>
          Geri al
        </button>
      )}
    </div>
  )
}

function describe(feedback: EditorFeedback): { message: string; undoable: boolean } {
  switch (feedback.type) {
    case 'deleted':
      return { message: `Son cümle silindi: “${shorten(feedback.removed)}”`, undoable: true }
    case 'nothing-to-delete':
      return { message: 'Silinecek cümle yok.', undoable: false }
    case 'bullets':
      return { message: `${feedback.count} boş madde eklendi.`, undoable: true }
    case 'undone':
      return { message: 'Geri alındı.', undoable: false }
    case 'nothing-to-undo':
      return { message: 'Geri alınacak bir şey yok.', undoable: false }
    case 'unrecognized':
      return {
        message: `Komut anlaşılamadı, metin olarak eklendi: “${shorten(feedback.phrase)}”`,
        undoable: true,
      }
  }
}

function shorten(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
