import { useState } from 'react'
import type { EditorFeedback } from '../core/feedback.ts'
import { describeFeedback } from './feedbackMessages.ts'
import { useTransient } from './useTransient.ts'

const VISIBLE_MS = 6000

const ACTION_LABELS = { undo: 'Geri al', redo: 'Yinele', 'apply-command': 'Komut olarak uygula' } as const

interface CommandToastProps {
  feedback: EditorFeedback | null
  onUndo(): void
  onRedo(): void
  /** Metne yazılan ifadeyi komut olarak uygular; bildirimin kimliğiyle çağrılır. */
  onApplyCommand(feedbackId: number): void
}

/**
 * Son komutun sonucunu kısa süre gösterir; gerekiyorsa "Geri al", "Yinele" ya da
 * "Komut olarak uygula" sunar. Odak düğmedeyken ya da fare üzerindeyken kalkmaz.
 */
export function CommandToast({ feedback, onUndo, onRedo, onApplyCommand }: CommandToastProps) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const visible = useTransient(feedback?.id ?? null, VISIBLE_MS, focused || hovered)
  const described = feedback && visible ? describeFeedback(feedback) : null
  // Odaktaki düğme ya da bildirim sayfadan kalkınca blur ve mouseleave gelmez.
  if (focused && !described?.action) setFocused(false)
  if (hovered && !described) setHovered(false)
  if (!feedback || !described) return null

  const { action } = described
  const run = () => {
    if (action === 'undo') onUndo()
    else if (action === 'redo') onRedo()
    else onApplyCommand(feedback.id)
  }

  return (
    <div className="toast" role="status" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span>{described.message}</span>
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={run}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          {ACTION_LABELS[action]}
        </button>
      )}
    </div>
  )
}
