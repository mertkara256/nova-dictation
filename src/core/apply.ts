import type { Command } from '../commands/types.ts'
import { type Doc, type Range, hasSelection } from './document.ts'
import type { DeletedWhat, FeedbackDetail, MissingWhat } from './feedback.ts'
import {
  type Removal,
  addBullets,
  clearSelection,
  deleteAll,
  deleteParagraph,
  deletePhrase,
  deleteRange,
  deleteSentence,
  deleteWords,
  insertBreak,
  insertMark,
  moveToBullet,
  moveToEdge,
  moveToLine,
  moveToPhrase,
  replacePhrase,
  rewriteRange,
  selectAll,
  selectBetween,
  selectParagraph,
  selectPhrase,
  selectRange,
  selectSentence,
  selectWords,
} from './operations.ts'
import { capitalizeWords, findPhrases, toLowerTr } from './text.ts'

export interface ApplyResult {
  doc: Doc
  detail: FeedbackDetail | null
}

/** Geri alma ve yineleme dışındaki komutları belgeye uygular. */
export function applyCommand(
  doc: Doc,
  command: Exclude<Command, { type: 'undo' | 'redo' }>,
  lastDictation: Range | null,
): ApplyResult {
  switch (command.type) {
    case 'delete-sentence':
      return removal(doc, deleteSentence(doc, command.which), 'sentence')
    case 'delete-paragraph':
      return removal(doc, deleteParagraph(doc, command.which), 'paragraph')
    case 'delete-words':
      return removal(doc, deleteWords(doc, command.count), 'words')
    case 'delete-phrase': {
      const result = deletePhrase(doc, command.phrase)
      return result ? removal(doc, result, 'phrase') : notFound(doc, command.phrase)
    }
    case 'delete-that':
      if (hasSelection(doc) && doc.selection) {
        return removal(doc, deleteRange(doc, doc.selection), 'selection')
      }
      return removal(doc, lastDictation && deleteRange(doc, lastDictation), 'dictation')
    case 'delete-selection':
      return removal(doc, doc.selection && deleteRange(doc, doc.selection), 'selection')
    case 'delete-all':
      return removal(doc, deleteAll(doc), 'all')

    case 'replace': {
      const result = replacePhrase(doc, command.from, command.to)
      if (!result) return notFound(doc, command.from)
      return { doc: result.doc, detail: { type: 'replaced', from: result.from, to: result.to } }
    }
    case 'insert-break':
      return { doc: insertBreak(doc, command.kind), detail: null }
    case 'insert-mark':
      return { doc: insertMark(doc, command.mark), detail: null }
    case 'add-bullets':
      return { doc: addBullets(doc, command.count), detail: { type: 'bullets', count: command.count } }
    case 'set-case':
      return rewrite(doc, command.phrase, lastDictation, command.to === 'upper' ? capitalizeWords : toLowerTr)
    case 'wrap':
      return rewrite(doc, command.phrase, lastDictation, (text) =>
        command.marks === 'quotes' ? `“${text}”` : `(${text})`,
      )

    case 'go-to-line':
      return move(doc, moveToLine(doc, command.line), { kind: 'line', line: command.line }, 'line')
    case 'go-to-edge':
      return move(doc, moveToEdge(doc, command.edge), { kind: command.edge })
    case 'go-to-bullet':
      return move(
        doc,
        moveToBullet(doc, command.direction),
        { kind: 'bullet', direction: command.direction },
        'bullet',
      )
    case 'go-to-phrase': {
      const result = moveToPhrase(doc, command.phrase, command.side)
      if (!result) return notFound(doc, command.phrase)
      return move(doc, result, { kind: 'phrase', phrase: command.phrase, side: command.side })
    }

    case 'select-sentence':
      return selection(doc, selectSentence(doc, command.which), 'sentence')
    case 'select-paragraph':
      return selection(doc, selectParagraph(doc, command.which), 'paragraph')
    case 'select-between': {
      const result = selectBetween(doc, command.from, command.to)
      if (!result) return notFound(doc, `${command.from} … ${command.to}`)
      return selection(doc, result, 'selection')
    }
    case 'select-phrase': {
      const result = selectPhrase(doc, command.phrase)
      if (!result) return notFound(doc, command.phrase)
      return selection(doc, result, 'target')
    }
    case 'select-words':
      return selection(doc, selectWords(doc, command.count), 'target')
    case 'select-that': {
      const range = thatRange(doc, lastDictation)
      return selection(doc, range && selectRange(doc, range), 'target')
    }
    case 'select-all':
      return selection(doc, selectAll(doc), 'target')
    case 'clear-selection':
      return { doc: clearSelection(doc), detail: { type: 'selection-cleared' } }

    case 'stop-listening':
    case 'copy':
    case 'show-help':
      return { doc, detail: { type: command.type } }
  }
}

function removal(doc: Doc, result: Removal | null, what: DeletedWhat): ApplyResult {
  if (!result) return missing(doc, what === 'phrase' || what === 'all' ? 'words' : what)
  return { doc: result.doc, detail: { type: 'deleted', what, removed: result.removed, at: result.at } }
}

function move(
  doc: Doc,
  result: Doc | null,
  target: Extract<FeedbackDetail, { type: 'moved' }>['target'],
  missingWhat: MissingWhat = 'line',
): ApplyResult {
  if (!result) return missing(doc, missingWhat)
  return { doc: result, detail: { type: 'moved', target } }
}

function selection(doc: Doc, result: Doc | null, missingWhat: MissingWhat): ApplyResult {
  if (!result?.selection) return missing(doc, missingWhat)
  const { start, end } = result.selection
  return { doc: result, detail: { type: 'selected', text: result.text.slice(start, end) } }
}

/** "bunu" ile verilen komutların hedefi: seçim varsa o, yoksa son dikte edilen parça. */
function thatRange(doc: Doc, lastDictation: Range | null): Range | null {
  return hasSelection(doc) && doc.selection ? doc.selection : lastDictation
}

/** Söylenen ifadenin son geçtiği yeri ya da phrase null ise "bunu"yu yeniden yazar. */
function rewrite(
  doc: Doc,
  phrase: string | null,
  lastDictation: Range | null,
  transform: (text: string) => string,
): ApplyResult {
  const range = phrase === null ? thatRange(doc, lastDictation) : findPhrases(doc.text, phrase).at(-1)
  if (!range || range.start >= range.end || range.end > doc.text.length) {
    return phrase === null ? missing(doc, 'target') : notFound(doc, phrase)
  }
  const result = rewriteRange(doc, range, transform)
  return { doc: result.doc, detail: { type: 'replaced', from: result.from, to: result.to } }
}

function missing(doc: Doc, what: MissingWhat): ApplyResult {
  return { doc, detail: { type: 'missing', what } }
}

function notFound(doc: Doc, phrase: string): ApplyResult {
  return { doc, detail: { type: 'phrase-not-found', phrase } }
}
