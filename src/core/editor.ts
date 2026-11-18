import { type SegmentPart, isLoneWakeWord, parseCommandSpeech, parseSegment } from '../commands/parse.ts'
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
  /** Uygulanan komut; komut olarak anlaşılamayan ifadelerde yok. */
  command?: Command
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
  /** Tek başına söylenen komut kelimesi ("Nova."); komut bir sonraki parçada beklenir. */
  pendingWake: string | null
  /** "Duraklat" denildi: "devam et" denene kadar söylenenler yazılmaz, komutlar uygulanmaz. */
  paused: boolean
  /** Son kesilen ya da kopyalanan metin; "yapıştır" bunu yazar. Bütün notlar için ortaktır. */
  clipboard: string
}

export type EditorAction =
  /** Kullanıcı metin alanına elle yazdı. */
  | { type: 'type'; text: string; selection: Range | null }
  /** Kullanıcı imleci taşıdı ya da metin seçti. */
  | { type: 'select'; selection: Range | null }
  /** Konuşma tanımadan kesinleşmiş bir parça geldi; komut kelimesiyle başlayan komutlar içerebilir. */
  | { type: 'dictate'; segment: string; wakeWord: string; at: number }
  /** Komut tuşu basılıyken söylenen, kesinleşmiş parça; yalnızca komut içerir. */
  | { type: 'command-speech'; segment: string; wakeWord: string; at: number }
  /** Bir düğme komut çalıştırdı (ör. Temizle, Geri al). */
  | { type: 'command'; command: Command; source: string; at: number }
  /** Mikrofon kapandı; bekleyen komut kelimesi ve duraklatma unutulur. */
  | { type: 'speech-ended' }
  /**
   * Başka bir not açıldı: onun metni ve (bu oturumda açıldıysa) geri alma geçmişi
   * yüklenir. Komut geçmişi bütün notlar için ortaktır, korunur.
   */
  | { type: 'load'; state: EditorState }

export const initialEditorState: EditorState = {
  text: '',
  selection: null,
  past: [],
  future: [],
  lastChange: null,
  lastDictation: null,
  feedback: null,
  log: [],
  pendingWake: null,
  paused: false,
  clipboard: '',
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
        pendingWake: null,
      }
    }
    case 'select': {
      const selection = normalizeSelection(state.text, action.selection)
      if (sameDoc({ text: state.text, selection }, state)) return state
      return { ...state, selection, lastChange: null }
    }
    case 'dictate': {
      if (isLoneWakeWord(action.segment, action.wakeWord)) {
        return { ...state, pendingWake: action.segment.trim() }
      }
      // Bekleyen komut kelimesi bu parçanın başına eklenir: "Nova." + "Son cümleyi sil."
      // → "Nova, Son cümleyi sil." Komut değilse ikisi de bugünkü gibi metne yazılır.
      const segment = state.pendingWake
        ? `${state.pendingWake.replace(/[\s.,!?;:…]+$/, '')}, ${action.segment.trim()}`
        : action.segment
      const { parts, unrecognized } = parseSegment(segment, action.wakeWord)
      const unmatched = unrecognized.map((phrase) => ({ type: 'unrecognized' as const, phrase }))
      return { ...applyParts(state, parts, unmatched, { at: action.at, via: 'voice' }), pendingWake: null }
    }
    case 'command-speech': {
      const { parts, unrecognized } = parseCommandSpeech(action.segment, action.wakeWord)
      const unmatched = unrecognized.map((phrase) => ({ type: 'not-understood' as const, phrase }))
      return { ...applyParts(state, parts, unmatched, { at: action.at, via: 'voice' }), pendingWake: null }
    }
    case 'command':
      return applyParts(
        state,
        [{ type: 'command', command: action.command, spoken: action.source }],
        [],
        { at: action.at, via: 'button' },
      )
    case 'speech-ended':
      return state.pendingWake === null && !state.paused ? state : { ...state, pendingWake: null, paused: false }
    case 'load':
      return { ...action.state, feedback: null, pendingWake: null, paused: false, log: state.log, clipboard: state.clipboard }
  }
}

/**
 * Metin ve komut parçalarını sırayla uygular. Hepsi tek bir değişiklik sayılır;
 * bir sonraki "geri al" hepsini birlikte geri alır. Aynı parçada söylenen "geri al"
 * ise parçadaki son değişikliği geri alır. Yalnızca imleci taşıyan ya da seçen
 * komutlar geri alma geçmişine yazılmaz. Dinleme duraklatıldıysa söylenenlerden
 * yalnızca "devam et" ve ondan sonrası uygulanır; düğmeler etkilenmez.
 */
/** Komut olarak anlaşılamayan, yalnızca bildirilip geçmişe yazılan ifade. */
type UnmatchedPhrase = Extract<FeedbackDetail, { type: 'unrecognized' | 'not-understood' }>

function applyParts(
  state: EditorState,
  parts: SegmentPart[],
  unmatched: UnmatchedPhrase[],
  origin: Pick<CommandLogEntry, 'at' | 'via'>,
): EditorState {
  let doc: Doc = docOf(state)
  let { past, future, lastDictation, log, paused, clipboard } = state
  const voice = origin.via === 'voice'
  if (voice && paused && !parts.some((part) => part.type === 'command' && part.command.type === 'resume-listening')) {
    return state
  }
  let detail: FeedbackDetail | null = null
  // Bu parçada yapılıp geçmişe ayrı ayrı yazılan değişikliklerin sayısı. Parçanın içindeki
  // "geri al" bunları tek tek geri alır; parça bitince tek değişiklik olarak birleştirilir.
  let changesInPart = 0

  for (const phrase of voice && paused ? [] : unmatched) {
    detail = phrase
    log = addLogEntry(log, { ...origin, source: phrase.phrase, detail })
  }

  /** Metni değiştiren bir adımdan sonra önceki hali geçmişe yazar. */
  const record = (before: Doc) => {
    if (doc.text === before.text) return
    past = remember(past, before)
    future = []
    changesInPart++
  }

  /** Bir değişikliği geri alır; geri alınacak bir şey yoksa false döner. */
  const undoOnce = () => {
    const previous = past.at(-1)
    if (!previous) return false
    future = [...future, doc]
    doc = previous
    past = past.slice(0, -1)
    if (changesInPart > 0) changesInPart--
    return true
  }

  /** Geri alınan bir değişikliği yineler; yinelenecek bir şey yoksa false döner. */
  const redoOnce = () => {
    const next = future.at(-1)
    if (!next) return false
    past = remember(past, doc)
    future = future.slice(0, -1)
    doc = next
    // Yinelenen değişiklik, bu parçada daha önce yapılanlarla birleştirilmez.
    changesInPart = 0
    return true
  }

  for (const part of parts) {
    if (voice && paused && !(part.type === 'command' && part.command.type === 'resume-listening')) continue
    if (part.type === 'text') {
      const before = doc
      const result = insertText(doc, part.text)
      if (result) {
        doc = result.doc
        lastDictation = result.inserted
        record(before)
      }
      continue
    }

    let partDetail: FeedbackDetail | null
    const { command } = part

    if (command.type === 'undo') {
      const count = repeat(command.count ?? 1, undoOnce)
      partDetail = count > 0 ? { type: 'undone', count } : { type: 'nothing-to-undo' }
      lastDictation = null
    } else if (command.type === 'redo') {
      const count = repeat(command.count ?? 1, redoOnce)
      partDetail = count > 0 ? { type: 'redone', count } : { type: 'nothing-to-redo' }
      lastDictation = null
    } else if (command.type === 'pause-listening' || command.type === 'resume-listening') {
      paused = command.type === 'pause-listening'
      partDetail = { type: command.type }
    } else if (command.type === 'paste') {
      const before = doc
      const result = clipboard ? insertText(doc, clipboard) : null
      if (result) {
        doc = result.doc
        lastDictation = result.inserted
        record(before)
      }
      partDetail = result ? { type: 'pasted', text: clipboard } : { type: 'missing', what: 'clipboard' }
    } else {
      const before = doc
      const result = applyCommand(doc, command, lastDictation)
      doc = result.doc
      partDetail = result.detail
      record(before)
      if (doc.text !== before.text) lastDictation = null
      if (partDetail?.type === 'cut' || partDetail?.type === 'copy') clipboard = partDetail.text
    }

    detail = partDetail ?? detail
    log = addLogEntry(log, { ...origin, source: part.spoken, detail: partDetail, command })
  }

  // Parçanın değişiklikleri birlikte geri alınsın: geçmişte yalnızca ilkinden önceki hal kalır.
  if (changesInPart > 1) past = past.slice(0, past.length - changesInPart + 1)
  const next: EditorState = { ...state, ...doc, past, future, lastChange: 'voice', lastDictation, log, paused, clipboard }
  return detail ? withFeedback(next, detail) : next
}

/** Adımı en fazla `times` kez, başarısız olana kadar tekrarlar; kaç kez yapıldığını döner. */
function repeat(times: number, step: () => boolean): number {
  let done = 0
  while (done < times && step()) done++
  return done
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
