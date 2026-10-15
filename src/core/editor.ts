import { parseSegment } from '../commands/parse.ts'
import { applyCommand } from './apply.ts'
import { type Doc, type Range, normalizeSelection, sameDoc } from './document.ts'
import type { EditorFeedback, FeedbackDetail } from './feedback.ts'
import { insertText } from './operations.ts'

export type { EditorFeedback, FeedbackDetail } from './feedback.ts'

const HISTORY_LIMIT = 100

export interface EditorState extends Doc {
  /** Geri almak için önceki haller; en yenisi sonda. */
  past: Doc[]
  /** Yinelemek için geri alınan haller; en yenisi sonda. */
  future: Doc[]
  lastChange: 'typing' | 'voice' | null
  /** Son dikte edilen parçanın yeri ("bunu sil" için). Metin başka şekilde değişince silinir. */
  lastDictation: Range | null
  feedback: EditorFeedback | null
}

export type EditorAction =
  /** Kullanıcı metin alanına elle yazdı. */
  | { type: 'type'; text: string; selection: Range | null }
  /** Kullanıcı imleci taşıdı ya da metin seçti. */
  | { type: 'select'; selection: Range | null }
  /** Konuşma tanımadan kesinleşmiş bir parça geldi; komut içerebilir. */
  | { type: 'dictate'; segment: string }
  | { type: 'undo' }
  | { type: 'redo' }

export const initialEditorState: EditorState = {
  text: '',
  selection: null,
  past: [],
  future: [],
  lastChange: null,
  lastDictation: null,
  feedback: null,
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'type': {
      const doc = { text: action.text, selection: normalizeSelection(action.text, action.selection) }
      if (sameDoc(doc, state)) return state
      if (doc.text === state.text) return { ...state, selection: doc.selection }
      return {
        ...state,
        ...doc,
        // Art arda yazılanlar tek seferde geri alınır.
        past: state.lastChange === 'typing' ? state.past : remember(state.past, state),
        future: [],
        lastChange: 'typing',
        lastDictation: null,
      }
    }
    case 'select': {
      const selection = normalizeSelection(state.text, action.selection)
      if (sameDoc({ text: state.text, selection }, state)) return state
      return { ...state, selection, lastChange: null }
    }
    case 'undo':
      return undo(state)
    case 'redo':
      return redo(state)
    case 'dictate':
      return dictate(state, action.segment)
  }
}

function undo(state: EditorState): EditorState {
  const previous = state.past.at(-1)
  if (!previous) return withFeedback(state, { type: 'nothing-to-undo' })
  return withFeedback(
    {
      ...state,
      ...previous,
      past: state.past.slice(0, -1),
      future: [...state.future, docOf(state)],
      lastChange: null,
      lastDictation: null,
    },
    { type: 'undone' },
  )
}

function redo(state: EditorState): EditorState {
  const next = state.future.at(-1)
  if (!next) return withFeedback(state, { type: 'nothing-to-redo' })
  return withFeedback(
    {
      ...state,
      ...next,
      past: remember(state.past, state),
      future: state.future.slice(0, -1),
      lastChange: null,
      lastDictation: null,
    },
    { type: 'redone' },
  )
}

/**
 * Konuşma parçasını uygular. Parçadaki metin ve komutların hepsi tek bir
 * değişiklik sayılır; bir sonraki "geri al" hepsini birlikte geri alır.
 * Yalnızca imleci taşıyan ya da seçen komutlar geçmişe yazılmaz.
 */
function dictate(state: EditorState, segment: string): EditorState {
  const { parts, unrecognized } = parseSegment(segment)
  let doc: Doc = docOf(state)
  let base: Doc = doc
  let { past, future, lastDictation } = state
  let detail: FeedbackDetail | null =
    unrecognized.length > 0 ? { type: 'unrecognized', phrase: unrecognized[0] } : null

  for (const part of parts) {
    if (part.type === 'text') {
      const result = insertText(doc, part.text)
      if (result) {
        doc = result.doc
        lastDictation = result.inserted
      }
      continue
    }

    const { command } = part
    if (command.type === 'undo') {
      // Bu parçada az önce bir değişiklik yapıldıysa onu, yoksa öncekini geri al.
      if (doc.text !== base.text) {
        doc = base
        detail = { type: 'undone' }
      } else if (past.length > 0) {
        future = [...future, doc]
        doc = past[past.length - 1]
        base = doc
        past = past.slice(0, -1)
        detail = { type: 'undone' }
      } else {
        detail = { type: 'nothing-to-undo' }
      }
      lastDictation = null
      continue
    }
    if (command.type === 'redo') {
      const next = future.at(-1)
      if (next && doc.text === base.text) {
        past = remember(past, doc)
        future = future.slice(0, -1)
        doc = next
        base = next
        detail = { type: 'redone' }
      } else {
        detail = { type: 'nothing-to-redo' }
      }
      lastDictation = null
      continue
    }

    const before = doc.text
    const result = applyCommand(doc, command, lastDictation)
    doc = result.doc
    detail = result.detail ?? detail
    if (doc.text !== before) lastDictation = null
  }

  if (doc.text !== base.text) {
    past = remember(past, base)
    future = []
  }
  const next: EditorState = { ...state, ...doc, past, future, lastChange: 'voice', lastDictation }
  return detail ? withFeedback(next, detail) : next
}

function docOf(state: Doc): Doc {
  return { text: state.text, selection: state.selection }
}

function remember(past: Doc[], doc: Doc) {
  return [...past, docOf(doc)].slice(-HISTORY_LIMIT)
}

function withFeedback(state: EditorState, detail: FeedbackDetail): EditorState {
  return { ...state, feedback: { ...detail, id: (state.feedback?.id ?? 0) + 1 } }
}
