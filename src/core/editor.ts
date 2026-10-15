import { parseSegment } from '../commands/parse.ts'
import { addBullets, deleteLastSentence, insertDictation } from './operations.ts'

const HISTORY_LIMIT = 100

export type FeedbackDetail =
  | { type: 'deleted'; removed: string; at: number }
  | { type: 'nothing-to-delete' }
  | { type: 'bullets'; count: number }
  | { type: 'undone' }
  | { type: 'nothing-to-undo' }
  | { type: 'unrecognized'; phrase: string }

/** Kullanıcıya gösterilecek son komut sonucu; id her yeni sonuçta artar. */
export type EditorFeedback = FeedbackDetail & { id: number }

export interface EditorState {
  text: string
  /** Geri almak için önceki metinler; en yenisi sonda. */
  past: string[]
  lastChange: 'typing' | 'voice' | null
  feedback: EditorFeedback | null
}

export type EditorAction =
  /** Kullanıcı metin alanına elle yazdı. */
  | { type: 'type'; text: string }
  /** Konuşma tanımadan kesinleşmiş bir parça geldi; komut içerebilir. */
  | { type: 'dictate'; segment: string }
  | { type: 'undo' }

export const initialEditorState: EditorState = {
  text: '',
  past: [],
  lastChange: null,
  feedback: null,
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'type':
      if (action.text === state.text) return state
      return {
        ...state,
        text: action.text,
        // Art arda yazılanlar tek seferde geri alınır.
        past: state.lastChange === 'typing' ? state.past : remember(state.past, state.text),
        lastChange: 'typing',
      }
    case 'undo':
      return undo(state)
    case 'dictate':
      return dictate(state, action.segment)
  }
}

function undo(state: EditorState): EditorState {
  const previous = state.past.at(-1)
  if (previous === undefined) return withFeedback(state, { type: 'nothing-to-undo' })
  return withFeedback(
    { ...state, text: previous, past: state.past.slice(0, -1), lastChange: null },
    { type: 'undone' },
  )
}

/**
 * Konuşma parçasını uygular. Parçanın tamamı tek bir değişiklik sayılır; bir
 * sonraki "geri al" parçadaki metni ve komutları birlikte geri alır.
 */
function dictate(state: EditorState, segment: string): EditorState {
  const { parts, unrecognized } = parseSegment(segment)
  let text = state.text
  let base = state.text
  let past = state.past
  let detail: FeedbackDetail | null =
    unrecognized.length > 0 ? { type: 'unrecognized', phrase: unrecognized[0] } : null

  for (const part of parts) {
    if (part.type === 'text') {
      text = insertDictation(text, part.text)
      continue
    }

    const { command } = part
    switch (command.type) {
      case 'delete-last-sentence': {
        const result = deleteLastSentence(text)
        if (result) {
          text = result.text
          detail = { type: 'deleted', removed: result.removed, at: result.text.length }
        } else {
          detail = { type: 'nothing-to-delete' }
        }
        break
      }
      case 'add-bullets':
        text = addBullets(text, command.count)
        detail = { type: 'bullets', count: command.count }
        break
      case 'undo': {
        // Bu parçada az önce yapılan bir değişiklik varsa onu, yoksa öncekini geri al.
        const previous = past.at(-1)
        if (text !== base) {
          text = base
        } else if (previous !== undefined) {
          text = previous
          base = previous
          past = past.slice(0, -1)
        } else {
          detail = { type: 'nothing-to-undo' }
          break
        }
        detail = { type: 'undone' }
        break
      }
    }
  }

  if (text !== base) past = remember(past, base)
  const next = { text, past, lastChange: 'voice' as const, feedback: state.feedback }
  return detail ? withFeedback(next, detail) : next
}

function remember(past: string[], text: string) {
  return [...past, text].slice(-HISTORY_LIMIT)
}

function withFeedback(state: EditorState, detail: FeedbackDetail): EditorState {
  return { ...state, feedback: { ...detail, id: (state.feedback?.id ?? 0) + 1 } }
}
