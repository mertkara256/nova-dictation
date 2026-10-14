import { toLowerTr } from './text.ts'

export interface Range {
  start: number
  end: number
}

// Tarayıcının cümle bölücüsü bu kısaltmalardan sonra yanlışlıkla cümle bitirir.
const ABBREVIATIONS = new Set(['dr', 'prof', 'doç', 'av', 'sn', 'yrd', 'öğr', 'uzm', 'op', 'müh', 'ecz'])

const segmenter = new Intl.Segmenter('tr', { granularity: 'sentence' })

/**
 * Metni cümlelere böler. Satır sonları da cümle sınırı sayılır, böylece her
 * liste maddesi ayrı bir cümledir. Yalnızca boşluktan oluşan parçalar atlanır.
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
  return ranges.filter((range) => text.slice(range.start, range.end).trim() !== '')
}

function endsWithAbbreviation(sentence: string) {
  const match = /(?:^|\s)(\p{L}+)\.\s*$/u.exec(sentence)
  return match !== null && ABBREVIATIONS.has(toLowerTr(match[1]))
}
