import { toLowerTr } from '../core/text.ts'
import { allowedErrors, editDistance } from './fuzzy.ts'

export type Command =
  | { type: 'delete-last-sentence' }
  | { type: 'add-bullets'; count: number }
  | { type: 'undo' }

export type SegmentPart =
  | { type: 'text'; text: string }
  | { type: 'command'; command: Command; spoken: string }

export interface ParsedSegment {
  parts: SegmentPart[]
  /** "Nova" ile başlayıp tanınmayan ifadeler; metin olarak bırakılır. */
  unrecognized: string[]
}

// Harf veya rakamla bitişik olmayan "nova" (ör. "Nova'ya", "novalar" sayılmaz).
const WAKE_WORD = /(?<![\p{L}\p{N}])nova(?![\p{L}\p{N}'’])/gu
const NUMBER_WORDS: Record<string, number> = {
  bir: 1,
  iki: 2,
  üç: 3,
  dört: 4,
  beş: 5,
  altı: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
}
const MAX_BULLETS = 20
// Bir komut en fazla bu kadar kelimeden oluşur.
const MAX_COMMAND_WORDS = 8

interface CommandTemplate {
  phrases: string[]
  /** Komutun önünde "buraya", bir sayı ve "tane" gelebilir (ör. "buraya üç tane boş madde ekle"). */
  countable?: boolean
  toCommand(count: number): Command
}

const COMMANDS: CommandTemplate[] = [
  {
    phrases: [
      'son cümleyi sil',
      'son cümleyi kaldır',
      'önceki cümleyi sil',
      'önceki cümleyi kaldır',
      'bir önceki cümleyi sil',
      'bir önceki cümleyi kaldır',
    ],
    toCommand: () => ({ type: 'delete-last-sentence' }),
  },
  {
    phrases: ['boş madde ekle', 'madde ekle', 'boş maddeler ekle', 'maddeler ekle'],
    countable: true,
    toCommand: (count) => ({ type: 'add-bullets', count }),
  },
  {
    phrases: ['geri al', 'geri alın'],
    toCommand: () => ({ type: 'undo' }),
  },
]

interface Word {
  /** Noktalaması atılmış kelime. */
  text: string
  /** Kelimenin (sondaki noktalama hariç) bittiği konum. */
  end: number
}

/**
 * Kesinleşmiş bir konuşma parçasını metin ve komutlara ayırır. Komutlar
 * "Nova" ile başlar; komuttan önce ve sonra söylenenler metin olarak kalır.
 * Konuşma tanımanın küçük yazım hataları ("son cümle isi") tolere edilir.
 * "Nova"dan sonra tanınan bir komut gelmezse ifade olduğu gibi metinde kalır.
 */
export function parseSegment(segment: string): ParsedSegment {
  const lowered = toLowerTr(segment)
  // Küçük harfe çevirme konumları kaydırırsa komut aranmaz.
  if (lowered.length !== segment.length) return { parts: textPart(segment), unrecognized: [] }

  const parts: SegmentPart[] = []
  const unrecognized: string[] = []
  let textStart = 0

  for (const wake of lowered.matchAll(WAKE_WORD)) {
    const wakeStart = wake.index
    if (wakeStart < textStart) continue

    const afterWake = wakeStart + wake[0].length
    const found = matchCommand(lowered.slice(afterWake))
    if (!found) {
      if (isCommandPosition(lowered.slice(0, wakeStart))) {
        unrecognized.push(sentenceFrom(segment, wakeStart))
      }
      continue
    }

    parts.push(...textPart(segment.slice(textStart, wakeStart)))
    const commandEnd = afterWake + found.length
    parts.push({
      type: 'command',
      command: found.command,
      spoken: segment.slice(wakeStart, commandEnd),
    })
    const trailing = /^[\s.,!?;:…]*/.exec(lowered.slice(commandEnd))?.[0].length ?? 0
    textStart = commandEnd + trailing
  }

  parts.push(...textPart(segment.slice(textStart)))
  return { parts, unrecognized }
}

/** "Nova"dan sonra gelen metnin başında bir komut arar; en az hatalı eşleşmeyi seçer. */
function matchCommand(text: string): { command: Command; length: number } | null {
  const words = splitWords(text)
  let best: { command: Command; wordCount: number; errors: number } | null = null

  for (const template of COMMANDS) {
    const match = matchTemplate(template, words)
    if (match && (!best || match.errors < best.errors)) best = match
  }
  return best ? { command: best.command, length: words[best.wordCount - 1].end } : null
}

function matchTemplate(template: CommandTemplate, words: Word[]) {
  let start = 0
  let count = 1
  if (template.countable) {
    if (words[start] && editDistance(words[start].text, 'buraya') <= 1) start++
    const number = words[start] && toNumber(words[start].text)
    if (number !== undefined) {
      count = number
      start++
    }
    if (words[start]?.text === 'tane') start++
  }

  let best: { wordCount: number; errors: number } | null = null
  for (const phrase of template.phrases) {
    const target = phrase.replaceAll(' ', '')
    const allowed = allowedErrors(target)
    let joined = ''
    for (let i = start; i < words.length; i++) {
      joined += words[i].text
      if (joined.length > target.length + allowed) break
      const errors = editDistance(joined, target)
      if (errors <= allowed && (!best || errors < best.errors)) best = { wordCount: i + 1, errors }
    }
  }
  return best ? { command: template.toCommand(count), ...best } : null
}

/** Komut aramak için metni kelimelere böler; ilk cümle sonunda durur. */
function splitWords(text: string): Word[] {
  const words: Word[] = []
  for (const match of text.matchAll(/\S+/g)) {
    const raw = match[0]
    const text = raw.replace(/[.,!?;:…"“”'’()-]/g, '')
    if (text) words.push({ text, end: match.index + raw.replace(/[.,!?;:…]+$/, '').length })
    if (/[.!?…]$/.test(raw) || words.length >= MAX_COMMAND_WORDS) break
  }
  return words
}

function toNumber(word: string) {
  const value = NUMBER_WORDS[word] ?? (/^\d{1,2}$/.test(word) ? Number.parseInt(word, 10) : undefined)
  return value === undefined ? undefined : Math.min(Math.max(value, 1), MAX_BULLETS)
}

/** "Nova" parçanın başında ya da bir cümle bittikten sonra mı geliyor? */
function isCommandPosition(before: string) {
  const trimmed = before.trimEnd()
  return trimmed === '' || /[.!?…:]$/.test(trimmed)
}

function sentenceFrom(segment: string, start: number) {
  const end = /[.!?…]/.exec(segment.slice(start))
  return segment.slice(start, end ? start + end.index + 1 : undefined).trim()
}

function textPart(text: string): SegmentPart[] {
  const trimmed = text.trim()
  return trimmed ? [{ type: 'text', text: trimmed }] : []
}
