import {
  type Doc,
  type Ordinal,
  type Range,
  caretOf,
  normalizeSelection,
  replaceRange,
  withCaret,
} from './document.ts'
import { lineAt, splitLines, splitParagraphs, splitSentences, trimRange } from './sentences.ts'
import { capitalizeTr, findLastWithSuffix, findPhrases, withSuffix } from './text.ts'

/** Silme işlemlerinin sonucu: yeni belge, silinen metin ve silindiği yer. */
export interface Removal {
  doc: Doc
  removed: string
  at: number
}

const STARTS_WITH_PUNCTUATION = /^[.,!?;:…)]/
const WORD_CHARACTER = /[\p{L}\p{N}]/u
/** Arkasından aynı cümle devam ediyor: küçük harf, rakam ya da noktalama. */
const CONTINUES_SENTENCE = /^[ \t]*[\p{Ll}\p{N}\p{P}]/u
/** Arkasından boşluk bırakılmadan yazılan işaretler: açılan tırnak ve parantez, kelimeye bitişik tire. */
const OPENS_WORD = /(?:[“(]|\p{L}-)$/u
const OPENING_MARKS = ['“', '(']
/** Konuşma tanımanın her duraklamada cümlenin sonuna koyduğu nokta (üç nokta değil). */
const PAUSE_PERIOD = /(?<!\.)\.$/
/** Duraklamada cümlenin sonuna konan nokta, soru ya da ünlem işareti ("..." ya da "?!" değil). */
const PAUSE_MARK = /(?<![.?!])[.?!]$/

// ---------------------------------------------------------------- Yazma

/**
 * Dikte edilen metni imlecin olduğu yere yazar; seçim varsa onun yerine.
 * Gerekirse araya boşluk koyar. Yazılan satır bir liste maddesiyse ve altında
 * boş bir madde varsa imleç oraya geçer; böylece maddeler sırayla dolar.
 */
export function insertText(doc: Doc, segment: string): { doc: Doc; inserted: Range } | null {
  const start = doc.selection?.start ?? doc.text.length
  const end = doc.selection?.end ?? doc.text.length
  const before = doc.text.slice(0, start)
  const after = doc.text.slice(end)
  // Arkasından aynı cümle devam ediyorsa duraklamada konan nokta atılır
  // ("Toplantı Perşembe. saat onda" olmasın).
  const spoken = segment.trim()
  const content = CONTINUES_SENTENCE.test(after) ? spoken.replace(PAUSE_PERIOD, '') : spoken
  if (!content) return null

  const lead =
    before && !/\s$/.test(before) && !OPENS_WORD.test(before) && !STARTS_WITH_PUNCTUATION.test(content)
      ? ' '
      : ''
  const trail = WORD_CHARACTER.test(after.charAt(0)) ? ' ' : ''

  const text = before + lead + content + trail + after
  const inserted = { start: start + lead.length, end: start + lead.length + content.length }
  return { doc: withCaret({ text, selection: null }, nextEmptyBullet(text, inserted.end)), inserted }
}

/** İmlecin olduğu yere satır sonu ya da paragraf boşluğu ekler. */
export function insertBreak(doc: Doc, kind: 'line' | 'paragraph'): Doc {
  return insertAtCaret(doc, kind === 'line' ? '\n' : '\n\n', true)
}

/**
 * İmlecin olduğu yere noktalama işareti koyar; önündeki boşluğu kaldırır.
 * Hemen önünde duraklamada konan nokta, soru ya da ünlem işareti varsa işaret
 * onun yerine geçer ("Merhaba." + virgül → "Merhaba,", "Nasılsın?" + soru
 * işareti → "Nasılsın?"). Açılan tırnak ve parantez ise önceki kelimeden
 * boşlukla ayrılır, arkasından söylenen kelimeye bitişir.
 */
export function insertMark(doc: Doc, mark: string): Doc {
  if (OPENING_MARKS.includes(mark)) {
    const start = doc.selection?.start ?? doc.text.length
    const end = doc.selection?.end ?? doc.text.length
    const lead = /\S$/.test(doc.text.slice(0, start)) ? ' ' : ''
    return withCaret(replaceRange(doc, start, end, lead + mark), start + lead.length + mark.length)
  }
  const marked = insertAtCaret(doc, mark, false)
  const at = caretOf(marked) - mark.length
  return PAUSE_MARK.test(marked.text.slice(0, at)) ? replaceRange(marked, at - 1, at, '') : marked
}

/** İmlecin bulunduğu satırın altına boş liste maddeleri ekler ve imleci ilkine taşır. */
export function addBullets(doc: Doc, count: number): Doc {
  const line = lineAt(doc.text, caretOf(doc))
  const head = doc.text.slice(0, line.end).replace(/[ \t]+$/, '')
  const separator = head === '' || head.endsWith('\n') ? '' : '\n'
  const bullets = Array.from({ length: count }, () => '- ').join('\n')
  const next = replaceRange(doc, head.length, line.end, separator + bullets)
  return withCaret(next, head.length + separator.length + 2)
}

/**
 * Aralıktaki metni verilen dönüşümle yeniden yazar (ör. büyük harfe çevirme,
 * tırnak içine alma); eski ve yeni metni de döner.
 */
export function rewriteRange(
  doc: Doc,
  range: Range,
  rewrite: (text: string) => string,
): { doc: Doc; from: string; to: string } {
  const from = doc.text.slice(range.start, range.end)
  const to = rewrite(from)
  return { doc: replaceRange(doc, range.start, range.end, to), from, to }
}

/**
 * İfadenin metindeki son geçtiği yeri yenisiyle değiştirir; büyük harfle başlıyorsa korur.
 * Kesme işaretiyle eklenmiş ek yerinde kalır ("Ankara'ya" → "İzmir'ya"); ek atılırsa
 * cümlenin anlamı kaybolur.
 */
export function replacePhrase(
  doc: Doc,
  from: string,
  to: string,
): { doc: Doc; from: string; to: string } | null {
  const range = findPhrases(doc.text, from).at(-1)
  const replacement = to.trim()
  if (!range || !replacement) return null
  const original = doc.text.slice(range.start, range.end)
  const text = /^\p{Lu}/u.test(original) ? capitalizeTr(replacement) : replacement
  return { doc: replaceRange(doc, range.start, range.end, text), from: original, to: text }
}

// ---------------------------------------------------------------- Silme

/** Sıradaki ya da imlecin önündeki son cümleyi siler. */
export function deleteSentence(doc: Doc, which: Ordinal): Removal | null {
  const range = pick(splitSentences(doc.text), which, caretOf(doc))
  return range ? remove(doc, range) : null
}

/** Paragrafı, öncesindeki ya da sonrasındaki boş satırlarla birlikte siler. */
export function deleteParagraph(doc: Doc, which: Ordinal): Removal | null {
  const paragraphs = splitParagraphs(doc.text)
  const target = pick(paragraphs, which, caretOf(doc))
  if (!target) return null
  const index = paragraphs.indexOf(target)
  const start = index > 0 ? paragraphs[index - 1].end : target.start
  const end = index > 0 ? target.end : (paragraphs[index + 1]?.start ?? doc.text.length)
  return {
    doc: replaceRange(doc, start, end, ''),
    removed: doc.text.slice(target.start, target.end),
    at: start,
  }
}

/**
 * Satırı, satır sonuyla birlikte siler. Satırlar "satıra git"teki gibi boş
 * olanlar dahil sayılır; "son" ise imlecin önündeki son dolu satırdır.
 */
export function deleteLine(doc: Doc, which: Ordinal): Removal | null {
  const lines = splitLines(doc.text)
  const filled = lines.filter((line) => /\S/.test(doc.text.slice(line.start, line.end)))
  const target = which === 'last' ? pick(filled, 'last', caretOf(doc)) : lines[which - 1]
  return target ? remove(doc, target) : null
}

/** İmlecin önündeki son kelimeleri siler. */
export function deleteWords(doc: Doc, count: number): Removal | null {
  const range = lastWords(doc, count)
  return range ? remove(doc, range) : null
}

/** İfadenin metindeki son geçtiği yeri, kesme işaretiyle eklenmiş ekiyle birlikte siler. */
export function deletePhrase(doc: Doc, phrase: string): Removal | null {
  const range = findLastWithSuffix(doc.text, phrase)
  return range ? remove(doc, range) : null
}

/** Verilen aralığı siler (ör. seçim ya da son dikte edilen parça). */
export function deleteRange(doc: Doc, range: Range): Removal | null {
  if (range.start >= range.end || range.end > doc.text.length) return null
  return remove(doc, range)
}

export function deleteAll(doc: Doc): Removal | null {
  if (!doc.text.trim()) return null
  return { doc: { text: '', selection: null }, removed: doc.text.trim(), at: 0 }
}

// ---------------------------------------------------------------- Gezinme

/** İmleci satırın sonuna taşır. */
export function moveToLine(doc: Doc, line: Ordinal): Doc | null {
  const lines = splitLines(doc.text)
  const target = line === 'last' ? lines.at(-1) : lines[line - 1]
  return target ? withCaret(doc, target.end) : null
}

/** İmleci paragrafın sonuna taşır. */
export function moveToParagraph(doc: Doc, paragraph: Ordinal): Doc | null {
  const paragraphs = splitParagraphs(doc.text)
  const target = paragraph === 'last' ? paragraphs.at(-1) : paragraphs[paragraph - 1]
  return target ? withCaret(doc, target.end) : null
}

/**
 * İmleci bulunduğu cümlenin başına ya da sonuna taşır. İmleç iki cümlenin
 * arasındaki boşluktaysa önceki cümle sayılır.
 */
export function moveToSentenceEdge(doc: Doc, edge: 'start' | 'end'): Doc | null {
  const caret = caretOf(doc)
  const sentences = splitSentences(doc.text)
  const target =
    sentences.find((range) => range.start <= caret && caret <= range.end) ??
    pick(sentences, 'last', caret)
  return target ? withCaret(doc, edge === 'start' ? target.start : target.end) : null
}

export function moveToEdge(doc: Doc, edge: 'start' | 'end'): Doc {
  return edge === 'start' ? withCaret(doc, 0) : { text: doc.text, selection: null }
}

/** İmleci sonraki ya da önceki liste maddesinin sonuna taşır. */
export function moveToBullet(doc: Doc, direction: 'next' | 'previous'): Doc | null {
  const current = lineAt(doc.text, caretOf(doc))
  const bullets = splitLines(doc.text).filter((line) => isBullet(doc.text.slice(line.start, line.end)))
  const target =
    direction === 'next'
      ? bullets.find((line) => line.start > current.start)
      : bullets.filter((line) => line.start < current.start).at(-1)
  return target ? withCaret(doc, target.end) : null
}

/** İmleci ifadenin son geçtiği yerin önüne ya da (ekiyle birlikte) arkasına taşır. */
export function moveToPhrase(doc: Doc, phrase: string, side: 'before' | 'after'): Doc | null {
  const range = findLastWithSuffix(doc.text, phrase)
  return range ? withCaret(doc, side === 'after' ? range.end : range.start) : null
}

// ---------------------------------------------------------------- Seçme

export function selectSentence(doc: Doc, which: Ordinal): Doc | null {
  const range = pick(splitSentences(doc.text), which, caretOf(doc))
  return range ? select(doc, range) : null
}

export function selectParagraph(doc: Doc, which: Ordinal): Doc | null {
  const range = pick(splitParagraphs(doc.text), which, caretOf(doc))
  return range ? select(doc, range) : null
}

/** İlk ifadenin son geçtiği yerden, ondan sonra gelen ikinci ifadeye kadar seçer. */
export function selectBetween(doc: Doc, from: string, to: string): Doc | null {
  const ends = findPhrases(doc.text, to).map((range) => withSuffix(doc.text, range))
  for (const start of findPhrases(doc.text, from).reverse()) {
    const end = ends.find((range) => range.start >= start.end)
    if (end) return select(doc, { start: start.start, end: end.end })
  }
  return null
}

/** İfadenin metindeki son geçtiği yeri, ekiyle birlikte seçer. */
export function selectPhrase(doc: Doc, phrase: string): Doc | null {
  const range = findLastWithSuffix(doc.text, phrase)
  return range ? select(doc, range) : null
}

/** İmlecin önündeki son kelimeleri seçer. */
export function selectWords(doc: Doc, count: number): Doc | null {
  const range = lastWords(doc, count)
  return range ? select(doc, range) : null
}

/** Verilen aralığı seçer (ör. son dikte edilen parça). */
export function selectRange(doc: Doc, range: Range): Doc | null {
  if (range.start >= range.end || range.end > doc.text.length) return null
  return select(doc, range)
}

export function selectAll(doc: Doc): Doc | null {
  return doc.text.trim() ? select(doc, { start: 0, end: doc.text.length }) : null
}

/** Seçimi kaldırır; imleç seçimin sonunda kalır. */
export function clearSelection(doc: Doc): Doc {
  return withCaret(doc, caretOf(doc))
}

// ---------------------------------------------------------------- Yardımcılar

/** Sıra numarasına göre aralık seçer; "son", imlecin önündeki son aralıktır. */
function pick(ranges: Range[], which: Ordinal, caret: number): Range | null {
  if (which === 'last') return ranges.filter((range) => range.start < caret).at(-1) ?? null
  return ranges[which - 1] ?? null
}

/** İmlecin önündeki son `count` kelimenin aralığı. */
function lastWords(doc: Doc, count: number): Range | null {
  const words = Array.from(doc.text.slice(0, caretOf(doc)).matchAll(/\S+/g))
  if (words.length === 0) return null
  const first = words[Math.max(words.length - count, 0)]
  const last = words[words.length - 1]
  return { start: first.index, end: last.index + last[0].length }
}

function select(doc: Doc, range: Range): Doc {
  return { text: doc.text, selection: normalizeSelection(doc.text, range) }
}

/**
 * Aralığı siler ve kalan boşlukları düzenler: iki kelime arasında çift boşluk,
 * satır başında boşluk kalmaz; bütün bir satır silinirse satır da kalkar.
 */
function remove(doc: Doc, range: Range): Removal {
  const { text } = doc
  const content = trimRange(text, range)
  let { start, end } = content
  const atLineStart = start === 0 || text[start - 1] === '\n'
  const atLineEnd = end === text.length || text[end] === '\n'

  if (atLineStart && atLineEnd) {
    if (end < text.length) end++
    else if (start > 0) start--
  } else if (atLineStart) {
    while (end < text.length && /[ \t]/.test(text[end])) end++
  } else {
    while (start > 0 && /[ \t]/.test(text[start - 1])) start--
  }

  return {
    doc: replaceRange(doc, start, end, ''),
    removed: text.slice(content.start, content.end),
    at: start,
  }
}

function insertAtCaret(doc: Doc, insert: string, trimAfter: boolean): Doc {
  let start = doc.selection?.start ?? doc.text.length
  let end = doc.selection?.end ?? doc.text.length
  while (start > 0 && /[ \t]/.test(doc.text[start - 1])) start--
  if (trimAfter) while (end < doc.text.length && /[ \t]/.test(doc.text[end])) end++
  return withCaret(replaceRange(doc, start, end, insert), start + insert.length)
}

/** Az önce doldurulan satır bir maddeyse ve altında boş madde varsa imleci oraya taşır. */
function nextEmptyBullet(text: string, caret: number): number {
  const lines = splitLines(text)
  const index = lines.findIndex((line) => caret <= line.end)
  const current = lines[index]
  const next = lines[index + 1]
  if (!current || !next) return caret
  const currentText = text.slice(current.start, current.end)
  const nextText = text.slice(next.start, next.end)
  return isBullet(currentText) && isEmptyBullet(nextText) ? next.end : caret
}

function isBullet(line: string) {
  return /^\s*-(\s|$)/.test(line)
}

function isEmptyBullet(line: string) {
  return /^\s*-\s*$/.test(line)
}
