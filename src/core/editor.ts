import { type SegmentPart, parseSegment } from '../commands/parse.ts'
import type { Command } from '../commands/types.ts'
import { applyCommand } from './apply.ts'
import { type Doc, type Range, normalizeSelection, sameDoc } from './document.ts'
import type { EditorFeedback, FeedbackDetail } from './feedback.ts'
import { insertText } from './operations.ts'

export type { EditorFeedback, FeedbackDetail } from './feedback.ts'

const HISTORY_LIMIT = 100
const LOG_LIMIT = 50

/** Komut geçmişindeki bir satır. */
export interface CommandLogEntry {
  id: number
  /** Komutun uygulandığı an (milisaniye). */
  at: number
  /** Komut sesle mi, düğmeyle mi verildi. */
  via: 'voice' | 'button'
  /** Söylenen ifade ya da düğmenin adı. */
  source: string
  /** Komutun sonucu; null ise bildirilecek bir sonucu yok (ör. yeni satır). */
  detail: FeedbackDetail | null
}

export interface EditorState extends Doc {
  /** Geri almak için önceki haller; en yenisi sonda. */
  past: Doc[]
  /** Yinelemek için geri alınan haller; en yenisi sonda. */
  future: Doc[]
  lastChange: 'typing' | 'voice' | null
  /** Son dikte edilen parçanın yeri ("bunu sil" için). Metin başka şekilde değişince silinir. */
  lastDictation: Range | null
  feedback: EditorFeedback | null
  /** Uygulanan komutlar; en yenisi sonda. */
  log: CommandLogEntry[]
}

export type EditorAction =
  /** Kullanıcı metin alanına elle yazdı. */
  | { type: 'type'; text: string; selection: Range | null }
  /** Kullanıcı imleci taşıdı ya da metin seçti. */
  | { type: 'select'; selection: Range | null }
  /** Konuşma tanımadan kesinleşmiş bir parça geldi; komut kelimesiyle başlayan komutlar içerebilir. */
  | { type: 'dictate'; segment: string; wakeWord: string; at: number }
  /** Bir düğme komut çalıştırdı (ör. Temizle, Geri al). */
  | { type: 'command'; command: Command; source: string; at: number }

export const initialEditorState: EditorState = {
  text: '',
  selection: null,
  past: [],
  future: [],
  lastChange: null,
  lastDictation: null,
  feedback: null,
  log: [],
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
    case 'dictate': {
      const { parts, unrecognized } = parseSegment(action.segment, action.wakeWord)
      return applyParts(state, parts, unrecognized, { at: action.at, via: 'voice' })
    }
    case 'command':
      return applyParts(
        state,
        [{ type: 'command', command: action.command, spoken: action.source }],
        [],
        { at: action.at, via: 'button' },
      )
  }
}

/**
 * Metin ve komut parçalarını sırayla uygular. Hepsi tek bir değişiklik sayılır;
 * bir sonraki "geri al" hepsini birlikte geri alır. Yalnızca imleci taşıyan ya
 * da seçen komutlar geri alma geçmişine yazılmaz.
 */
function applyParts(
  state: EditorState,
  parts: SegmentPart[],
  unrecognized: string[],
  origin: Pick<CommandLogEntry, 'at' | 'via'>,
): EditorState {
  // Bu değişiklikten önceki hal; "geri al" aynı parçada söylenirse buna döner.
  let base: Doc = docOf(state)
  let doc: Doc = base
  let { past, future, lastDictation, log } = state
  let detail: FeedbackDetail | null = null

  for (const phrase of unrecognized) {
    detail = { type: 'unrecognized', phrase }
    log = addLogEntry(log, { ...origin, source: phrase, detail })
  }

  for (const part of parts) {
    if (part.type === 'text') {
      const result = insertText(doc, part.text)
      if (result) {
        doc = result.doc
        lastDictation = result.inserted
      }
      continue
    }

    let partDetail: FeedbackDetail | null
    const { command } = part

    if (command.type === 'undo') {
      if (doc.text !== base.text) {
        // Bu parçada az önce yapılanı geri al.
        doc = base
        partDetail = { type: 'undone' }
      } else if (past.length > 0) {
        future = [...future, doc]
        doc = past[past.length - 1]
        base = doc
        past = past.slice(0, -1)
        partDetail = { type: 'undone' }
      } else {
        partDetail = { type: 'nothing-to-undo' }
      }
      lastDictation = null
    } else if (command.type === 'redo') {
      const next = future.at(-1)
      if (next && doc.text === base.text) {
        past = remember(past, doc)
        future = future.slice(0, -1)
        doc = next
        base = next
        partDetail = { type: 'redone' }
      } else {
        partDetail = { type: 'nothing-to-redo' }
      }
      lastDictation = null
    } else {
      const before = doc.text
      const result = applyCommand(doc, command, lastDictation)
      doc = result.doc
      partDetail = result.detail
      if (doc.text !== before) lastDictation = null
    }

    detail = partDetail ?? detail
    log = addLogEntry(log, { ...origin, source: part.spoken, detail: partDetail })
  }

  if (doc.text !== base.text) {
    past = remember(past, base)
    future = []
  }
  const next: EditorState = { ...state, ...doc, past, future, lastChange: 'voice', lastDictation, log }
  return detail ? withFeedback(next, detail) : next
}

function docOf(state: Doc): Doc {
  return { text: state.text, selection: state.selection }
}

function remember(past: Doc[], doc: Doc) {
  return [...past, docOf(doc)].slice(-HISTORY_LIMIT)
}

function addLogEntry(log: CommandLogEntry[], entry: Omit<CommandLogEntry, 'id'>) {
  const id = (log.at(-1)?.id ?? 0) + 1
  return [...log, { id, ...entry }].slice(-LOG_LIMIT)
}

function withFeedback(state: EditorState, detail: FeedbackDetail): EditorState {
  return { ...state, feedback: { ...detail, id: (state.feedback?.id ?? 0) + 1 } }
}
