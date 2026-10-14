import { splitSentences } from './sentences.ts'
import { appendSegment } from './text.ts'

/** Son cümleyi siler; silinecek cümle yoksa null döner. */
export function deleteLastSentence(text: string): { text: string; removed: string } | null {
  const last = splitSentences(text).at(-1)
  if (!last) return null
  return {
    text: text.slice(0, last.start).replace(/[ \t]+$/, ''),
    removed: text.slice(last.start, last.end).trim(),
  }
}

/** Metnin sonuna, her biri ayrı satırda boş liste maddeleri ekler. */
export function addBullets(text: string, count: number): string {
  const base = text.replace(/[ \t]+$/, '')
  const separator = base === '' || base.endsWith('\n') ? '' : '\n'
  return base + separator + Array.from({ length: count }, () => '- ').join('\n')
}

/**
 * Dikteyle gelen metni ekler. Metnin sonunda doldurulmamış liste maddeleri
 * varsa ilkine yazar; böylece "üç boş madde ekle" dedikten sonra her
 * duraklamada bir sonraki madde dolar. Yoksa metnin sonuna ekler.
 */
export function insertDictation(text: string, segment: string): string {
  const trimmed = segment.trim()
  if (trimmed === '') return text

  const lines = text.split('\n')
  const lastContent = lines.findLastIndex((line) => line.trim() !== '' && !isEmptyBullet(line))
  const target = lines.findIndex((line, i) => i > lastContent && isEmptyBullet(line))
  if (target === -1) return appendSegment(text, trimmed)

  lines[target] = `- ${trimmed}`
  return lines.join('\n')
}

function isEmptyBullet(line: string) {
  return /^\s*-\s*$/.test(line)
}
