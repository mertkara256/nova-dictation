import { toLowerTr } from '../core/text.ts'
import { RULES } from './grammar.ts'
import { type PatternMatch, type Word, compilePattern, matchPattern } from './matcher.ts'
import type { Command } from './types.ts'
import { DEFAULT_WAKE_WORD, wakeWordPattern } from './wakeWord.ts'

export type { Command } from './types.ts'

export type SegmentPart =
  | { type: 'text'; text: string }
  | { type: 'command'; command: Command; spoken: string }

export interface ParsedSegment {
  parts: SegmentPart[]
  /** Komut kelimesiyle başlayıp tanınmayan ifadeler; metin olarak bırakılır. */
  unrecognized: string[]
}

// Bir komut en fazla bu kadar kelimeden oluşur.
const MAX_COMMAND_WORDS = 16

const COMPILED_RULES = RULES.map((rule) => ({
  rule,
  patterns: rule.patterns.map(compilePattern),
}))

/**
 * Kesinleşmiş bir konuşma parçasını metin ve komutlara ayırır. Komutlar komut
 * kelimesiyle (varsayılan "Nova") başlar; komuttan önce ve sonra söylenenler
 * metin olarak kalır. Konuşma tanımanın küçük yazım hataları ("son cümle isi")
 * tolere edilir. Komut kelimesinden sonra tanınan bir komut gelmezse ifade
 * olduğu gibi metinde kalır.
 */
export function parseSegment(segment: string, wakeWord = DEFAULT_WAKE_WORD): ParsedSegment {
  const lowered = toLowerTr(segment)
  // Küçük harfe çevirme konumları kaydırırsa komut aranmaz.
  if (lowered.length !== segment.length) return { parts: textPart(segment), unrecognized: [] }

  const parts: SegmentPart[] = []
  const unrecognized: string[] = []
  let textStart = 0

  for (const wake of lowered.matchAll(wakeWordPattern(wakeWord))) {
    const wakeStart = wake.index
    if (wakeStart < textStart) continue

    const afterWake = wakeStart + wake[0].length
    const found = matchCommand(lowered.slice(afterWake), segment.slice(afterWake))
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

/**
 * Komut kelimesinden sonra gelen metnin başında bir komut arar. En az hatalı eşleşmeyi,
 * eşitlikte en uzun olanı, o da eşitse listede önce geleni seçer.
 */
function matchCommand(lowered: string, source: string): { command: Command; length: number } | null {
  const words = splitWords(lowered)
  let best: { match: PatternMatch; command: Command } | null = null

  for (const { rule, patterns } of COMPILED_RULES) {
    for (const pattern of patterns) {
      const match = matchPattern(pattern, words, source)
      if (!match || match.wordCount === 0) continue
      const better =
        !best ||
        match.errors < best.match.errors ||
        (match.errors === best.match.errors && match.wordCount > best.match.wordCount)
      if (better) best = { match, command: rule.toCommand(match.slots) }
    }
  }
  return best ? { command: best.command, length: words[best.match.wordCount - 1].end } : null
}

/** Komut aramak için metni kelimelere böler; ilk cümle sonunda durur. */
function splitWords(text: string): Word[] {
  const words: Word[] = []
  for (const match of text.matchAll(/\S+/g)) {
    const raw = match[0]
    const clean = raw.replace(/[.,!?;:…"“”'’()«»-]/g, '')
    if (clean) {
      words.push({
        text: clean,
        start: match.index + (raw.length - raw.replace(/^[^\p{L}\p{N}]+/u, '').length),
        end: match.index + raw.replace(/[^\p{L}\p{N}]+$/u, '').length,
      })
    }
    // "3." sıra sayısıdır, cümle sonu değil.
    const sentenceEnd = /[.!?…]$/.test(raw) && !/^\d+\.$/.test(raw)
    if (sentenceEnd || words.length >= MAX_COMMAND_WORDS) break
  }
  return words
}

/** Komut kelimesi parçanın başında ya da bir cümle bittikten sonra mı geliyor? */
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
