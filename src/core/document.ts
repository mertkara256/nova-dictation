export interface Range {
  start: number
  end: number
}

/** Cümle, paragraf veya satır sırası: 1'den başlayan numara ya da "son". */
export type Ordinal = number | 'last'

/**
 * Metin ve imleç. selection null ise imleç metnin sonundadır; metin büyüdükçe
 * de sonda kalır. start ile end eşitse imleç, farklıysa seçim vardır.
 */
export interface Doc {
  text: string
  selection: Range | null
}

/** İmlecin (seçim varsa seçimin sonunun) konumu. */
export function caretOf(doc: Doc): number {
  return doc.selection?.end ?? doc.text.length
}

export function hasSelection(doc: Doc): boolean {
  return doc.selection !== null && doc.selection.start !== doc.selection.end
}

/** Seçimi metnin sınırlarına sığdırır; metnin sonundaki imleci null olarak saklar. */
export function normalizeSelection(text: string, selection: Range | null): Range | null {
  if (!selection) return null
  const clamp = (position: number) => Math.min(Math.max(position, 0), text.length)
  const start = clamp(Math.min(selection.start, selection.end))
  const end = clamp(Math.max(selection.start, selection.end))
  if (start === end && end === text.length) return null
  return { start, end }
}

/** İmleci verilen konuma taşır. */
export function withCaret(doc: Doc, position: number): Doc {
  return { text: doc.text, selection: normalizeSelection(doc.text, { start: position, end: position }) }
}

/** [start, end) aralığını verilen metinle değiştirir; imleci ve seçimi buna göre kaydırır. */
export function replaceRange(doc: Doc, start: number, end: number, insert: string): Doc {
  const text = doc.text.slice(0, start) + insert + doc.text.slice(end)
  const shift = insert.length - (end - start)
  const map = (position: number) => {
    if (position <= start) return position
    if (position >= end) return position + shift
    return start + insert.length
  }
  const selection = doc.selection && { start: map(doc.selection.start), end: map(doc.selection.end) }
  return { text, selection: normalizeSelection(text, selection) }
}

export function sameDoc(a: Doc, b: Doc): boolean {
  return (
    a.text === b.text &&
    a.selection?.start === b.selection?.start &&
    a.selection?.end === b.selection?.end
  )
}
