import { useState } from 'react'
import type { EditorFeedback } from '../core/feedback.ts'
import { describeFeedback } from './feedbackMessages.ts'
import { useTransient } from './useTransient.ts'

const VISIBLE_MS = 6000

interface CommandToastProps {
  feedback: EditorFeedback | null
  onUndo(): void
  onRedo(): void
}

/**
 * Son komutun sonucunu kısa süre gösterir; gerekiyorsa "Geri al" ya da "Yinele" sunar.
 * Odak düğmedeyken ya da fare üzerindeyken kalkmaz.
 */
export function CommandToast({ feedback, onUndo, onRedo }: CommandToastProps) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const visible = useTransient(feedback?.id ?? null, VISIBLE_MS, focused || hovered)
  const described = feedback && visible ? describeFeedback(feedback) : null
  // Odaktaki düğme ya da bildirim sayfadan kalkınca blur ve mouseleave gelmez.
  if (focused && !described?.action) setFocused(false)
  if (hovered && !described) setHovered(false)
  if (!described) return null

  return (
    <div className="toast" role="status" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span>{described.message}</span>
      {described.action && (
        <button
          type="button"
          className="toast-action"
          onClick={described.action === 'undo' ? onUndo : onRedo}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          {described.action === 'undo' ? 'Geri al' : 'Yinele'}
        </button>
      )}
    </div>
  )
}
