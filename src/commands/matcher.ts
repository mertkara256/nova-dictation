import type { Ordinal } from '../core/document.ts'
import { allowedErrors, editDistance } from './fuzzy.ts'

/** Komut aranan metindeki bir kelime: noktalaması atılmış hali ve metindeki yeri. */
export interface Word {
  text: string
  start: number
  end: number
}

/** Kalıptaki boşlukların doldurulmuş halleri. */
export interface Slots {
  ordinal?: Ordinal
  count?: number
  text?: string
  text2?: string
}

export interface PatternMatch {
  /** Komutun kaç kelime sürdüğü. */
  wordCount: number
  /** Toplam yazım hatası (harf farkı). */
  errors: number
  slots: Slots
}

type Token =
  | { kind: 'literal'; text: string; optional: boolean }
  | { kind: 'ordinal' }
  | { kind: 'count'; optional: boolean }
  | { kind: 'text'; name: 'text' | 'text2' }

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

const ORDINAL_WORDS: Record<string, Ordinal> = {
  ilk: 1,
  birinci: 1,
  ikinci: 2,
  üçüncü: 3,
  dördüncü: 4,
  beşinci: 5,
  altıncı: 6,
  yedinci: 7,
  sekizinci: 8,
  dokuzuncu: 9,
  onuncu: 10,
  son: 'last',
  sonuncu: 'last',
  önceki: 'last',
}

/**
 * Kalıbı parçalarına ayırır. Kalıp dili:
 * - "cümleyi sil": kelimeler (art arda gelenler birlikte, hataya toleranslı eşleşir)
 * - "[buraya]": isteğe bağlı kelime
 * - "{ordinal}": sıra ("ilk", "ikinci", "3.", "son", "bir önceki")
 * - "{count}" / "{count?}": sayı ("üç", "3"); soru işaretliyse isteğe bağlı
 * - "{text}" / "{text2}": bir ya da daha fazla kelimelik serbest metin
 */
export function compilePattern(pattern: string): Token[] {
  const tokens: Token[] = []
  for (const part of pattern.split(' ')) {
    if (part === '{ordinal}') tokens.push({ kind: 'ordinal' })
    else if (part === '{count}' || part === '{count?}') {
      tokens.push({ kind: 'count', optional: part === '{count?}' })
    } else if (part === '{text}' || part === '{text2}') {
      tokens.push({ kind: 'text', name: part === '{text}' ? 'text' : 'text2' })
    } else if (part.startsWith('[')) {
      tokens.push({ kind: 'literal', text: part.slice(1, -1), optional: true })
    } else {
      const last = tokens.at(-1)
      if (last?.kind === 'literal' && !last.optional) last.text += part
      else tokens.push({ kind: 'literal', text: part, optional: false })
    }
  }
  return tokens
}

/**
 * Kelimelerin başında kalıbı arar. Birden fazla eşleşme varsa en az hatalı
 * olanı, eşitlikte en uzun olanı seçer. Serbest metinler `source` içinden
 * (büyük/küçük harfleri korunarak) alınır.
 */
export function matchPattern(tokens: Token[], words: Word[], source: string): PatternMatch | null {
  let best: PatternMatch | null = null

  const visit = (index: number, position: number, errors: number, slots: Slots) => {
    if (best && errors > best.errors) return
    if (index === tokens.length) {
      if (!best || errors < best.errors || position > best.wordCount) {
        best = { wordCount: position, errors, slots }
      }
      return
    }

    const token = tokens[index]
    switch (token.kind) {
      case 'literal': {
        if (token.optional) visit(index + 1, position, errors, slots)
        const allowed = allowedErrors(token.text)
        let joined = ''
        for (let i = position; i < words.length; i++) {
          joined += words[i].text
          if (joined.length > token.text.length + allowed) break
          const distance = editDistance(joined, token.text)
          if (distance <= allowed) visit(index + 1, i + 1, errors + distance, slots)
        }
        return
      }
      case 'ordinal': {
        const ordinal = readOrdinal(words, position)
        if (ordinal) visit(index + 1, position + ordinal.length, errors, { ...slots, ordinal: ordinal.value })
        return
      }
      case 'count': {
        const count = words[position] && readNumber(words[position].text)
        if (count !== undefined) visit(index + 1, position + 1, errors, { ...slots, count })
        if (token.optional) visit(index + 1, position, errors, slots)
        return
      }
      case 'text': {
        for (let end = position + 1; end <= words.length; end++) {
          const text = cleanText(source.slice(words[position].start, words[end - 1].end))
          if (text) visit(index + 1, end, errors, { ...slots, [token.name]: text })
        }
        return
      }
    }
  }

  visit(0, 0, 0, {})
  return best
}

function readNumber(word: string): number | undefined {
  if (word in NUMBER_WORDS) return NUMBER_WORDS[word]
  return /^\d{1,3}$/.test(word) ? Number.parseInt(word, 10) : undefined
}

function readOrdinal(words: Word[], position: number): { value: Ordinal; length: number } | null {
  const word = words[position]?.text
  if (word === undefined) return null
  if (word === 'bir' && words[position + 1]?.text === 'önceki') return { value: 'last', length: 2 }
  if (word in ORDINAL_WORDS) return { value: ORDINAL_WORDS[word], length: 1 }
  // "3", "3." ya da "3üncü" (kesme işareti atılmış "3'üncü")
  const digits = /^(\d{1,3})(?:inci|ıncı|uncu|üncü|nci|ncı|ncu|ncü)?$/.exec(word)
  if (digits) return { value: Number.parseInt(digits[1], 10), length: 1 }
  // Konuşma tanımanın küçük yazım hataları ("üçüncu")
  for (const [candidate, value] of Object.entries(ORDINAL_WORDS)) {
    if (candidate.length >= 5 && editDistance(word, candidate) <= 1) return { value, length: 1 }
  }
  return null
}

/** Serbest metnin başındaki ve sonundaki tırnakları ve noktalamayı atar. */
function cleanText(text: string) {
  return text.replace(/^[\s"“”'’«»]+|[\s"“”'’«».,!?;:…]+$/g, '')
}
