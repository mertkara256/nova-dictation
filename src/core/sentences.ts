import type { Range } from './document.ts'
import { toLowerTr } from './text.ts'

// Tarayıcının cümle bölücüsü bu kısaltmalardan sonra yanlışlıkla cümle bitirir.
const ABBREVIATIONS = new Set(['dr', 'prof', 'doç', 'av', 'sn', 'yrd', 'öğr', 'uzm', 'op', 'müh', 'ecz'])

const segmenter = new Intl.Segmenter('tr', { granularity: 'sentence' })

/**
 * Metni cümlelere böler. Satır sonları da cümle sınırı sayılır, böylece her
 * liste maddesi ayrı bir cümledir. Aralıklar baştaki ve sondaki boşluklar
 * atılmış olarak döner; yalnızca boşluktan oluşan parçalar atlanır.
 */
export function splitSentences(text: string): Range[] {
  const ranges: Range[] = []
  for (const { index, segment } of segmenter.segment(text)) {
    const previous = ranges.at(-1)
    if (previous && endsWithAbbreviation(text.slice(previous.start, previous.end))) {
      previous.end = index + segment.length
    } else {
      ranges.push({ start: index, end: index + segment.length })
    }
  }
  return ranges.map((range) => trimRange(text, range)).filter((range) => range.start < range.end)
}

/** Boş satırlarla ayrılmış paragrafları bulur. */
export function splitParagraphs(text: string): Range[] {
  return Array.from(text.matchAll(/[^\n]*\S[^\n]*(?:\n[^\n]*\S[^\n]*)*/g), (match) =>
    trimRange(text, { start: match.index, end: match.index + match[0].length }),
  )
}

/** Enter ile ayrılan satırları bulur; boş satırlar da dahil. */
export function splitLines(text: string): Range[] {
  const lines: Range[] = []
  let start = 0
  for (const line of text.split('\n')) {
    lines.push({ start, end: start + line.length })
    start += line.length + 1
  }
  return lines
}

/** Verilen konumun bulunduğu satır. */
export function lineAt(text: string, position: number): Range {
  const lines = splitLines(text)
  return lines.find((line) => position <= line.end) ?? lines[lines.length - 1]
}

/** Aralığın başındaki ve sonundaki boşlukları atar. */
export function trimRange(text: string, range: Range): Range {
  let { start, end } = range
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  return { start, end }
}

function endsWithAbbreviation(sentence: string) {
  const match = /(?:^|\s)(\p{L}+)\.\s*$/u.exec(sentence)
  return match !== null && ABBREVIATIONS.has(toLowerTr(match[1]))
}
