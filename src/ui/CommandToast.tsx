import type { EditorFeedback } from '../core/feedback.ts'
import { describeFeedback } from './feedbackMessages.ts'
import { useTransient } from './useTransient.ts'

const VISIBLE_MS = 6000

interface CommandToastProps {
  feedback: EditorFeedback | null
  onUndo(): void
  onRedo(): void
}

/** Son komutun sonucunu kısa süre gösterir; gerekiyorsa "Geri al" ya da "Yinele" sunar. */
export function CommandToast({ feedback, onUndo, onRedo }: CommandToastProps) {
  const visible = useTransient(feedback?.id ?? null, VISIBLE_MS)
  if (!feedback || !visible) return null
  const described = describeFeedback(feedback)

  return (
    <div className="toast" role="status">
      <span>{described.message}</span>
      {described.action && (
        <button
          type="button"
          className="toast-action"
          onClick={described.action === 'undo' ? onUndo : onRedo}
        >
          {described.action === 'undo' ? 'Geri al' : 'Yinele'}
        </button>
      )}
    </div>
  )
}
