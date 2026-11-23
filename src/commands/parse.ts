import { toLowerTr } from '../core/text.ts'
import { RULES } from './grammar.ts'
import { type PatternMatch, type Word, compilePattern, matchPattern } from './matcher.ts'
import type { Command } from './types.ts'
import { DEFAULT_WAKE_WORD, findWakeWords } from './wakeWord.ts'

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
// Art arda söylenen komutların arasındaki noktalama ve "ve" bağlacı.
const COMMAND_SEPARATOR = /^(?:[\s.,!?;:…]|ve(?![\p{L}\p{N}]))*/u
// Komut kelimesiyle verilen bir komuttan sonra, aynı cümlede "ve" ile bağlanan komut.
const CHAINED_COMMAND = /^[\s,]*ve\s+/u

const COMPILED_RULES = RULES.map((rule) => ({
  rule,
  patterns: rule.patterns.map((pattern) => compilePattern(pattern, rule.verbErrors)),
  // Kalıpların son kelimeleri; çoğu komutun fiilidir ("sil", "geri al", "parantez aç", "nokta koy").
  verbs: rule.patterns
    .map((pattern) => pattern.replace(/[[\]]/g, '').split(' ').at(-1) ?? '')
    .filter((word) => word && !word.startsWith('{')),
}))

const COMMAND_VERBS = [...new Set(COMPILED_RULES.flatMap((rule) => rule.verbs))]
// Fiilin olumsuz eki: "silme", "geri alma", "yazmayın".
const NEGATION = /^m[ae]/

/**
 * Kesinleşmiş bir konuşma parçasını metin ve komutlara ayırır. Komutlar komut
 * kelimesiyle (varsayılan "Nova") başlar; komuttan önce ve sonra söylenenler
 * metin olarak kalır. Konuşma tanımanın küçük yazım hataları ("son cümle isi",
 * "Jarvis" yerine "Carvis") tolere edilir. Komut kelimesinden sonra tanınan bir
 * komut gelmezse ifade olduğu gibi metinde kalır.
 */
export function parseSegment(segment: string, wakeWord = DEFAULT_WAKE_WORD): ParsedSegment {
  const lowered = toLowerTr(segment)
  // Küçük harfe çevirme konumları kaydırırsa komut aranmaz.
  if (lowered.length !== segment.length) return { parts: textPart(segment), unrecognized: [] }

  const parts: SegmentPart[] = []
  const unrecognized: string[] = []
  let textStart = 0

  for (const wake of findWakeWords(lowered, wakeWord)) {
    const wakeStart = wake.start
    if (wakeStart < textStart) continue

    const afterWake = wake.end
    const found = matchCommand(lowered.slice(afterWake), segment.slice(afterWake))
    if (!found) {
      // Yazım farkıyla bulunan bir kelime, arkasından komut gelmiyorsa sıradan bir
      // kelimedir (ör. bir film adı); tanınmayan komut olarak bildirilmez.
      if (wake.exact && isCommandPosition(lowered.slice(0, wakeStart))) {
        unrecognized.push(sentenceFrom(segment, wakeStart))
      }
      continue
    }

    // Whisper komut kelimesini hitap sayıp önüne virgül koyar ("Bugün hava güzel, Nova,
    // yeni satır"); o virgül metne yazılmaz.
    parts.push(...textPart(segment.slice(textStart, wakeStart).replace(/,\s*$/, '')))
    let commandEnd = afterWake + found.length
    parts.push({
      type: 'command',
      command: found.command,
      spoken: segment.slice(wakeStart, commandEnd),
    })
    // "ve" ile bağlanan sonraki komutlar da uygulanır: "Nova, son cümleyi sil ve yeni satır".
    let link = CHAINED_COMMAND.exec(lowered.slice(commandEnd))
    while (link) {
      const start = commandEnd + link[0].length
      const next = matchCommand(lowered.slice(start), segment.slice(start))
      if (!next) break
      commandEnd = start + next.length
      parts.push({ type: 'command', command: next.command, spoken: segment.slice(start, commandEnd) })
      link = CHAINED_COMMAND.exec(lowered.slice(commandEnd))
    }
    const trailing = /^[\s.,!?;:…]*/.exec(lowered.slice(commandEnd))?.[0].length ?? 0
    textStart = commandEnd + trailing
  }

  parts.push(...textPart(segment.slice(textStart)))
  return { parts, unrecognized }
}

/**
 * Parça yalnızca komut kelimesinden mi oluşuyor ("Nova.")? Komut kelimesi
 * söylenip duraklanınca Whisper onu ayrı bir parça olarak yazar; komut bir
 * sonraki parçada gelir.
 */
export function isLoneWakeWord(segment: string, wakeWord = DEFAULT_WAKE_WORD): boolean {
  const lowered = toLowerTr(segment.trim())
  const wake = findWakeWords(lowered, wakeWord).find((match) => match.exact && match.start === 0)
  return wake !== undefined && /^[\s.,!?;:…]*$/.test(lowered.slice(wake.end))
}

/**
 * Komut tuşu basılıyken söylenen bir parçayı komutlara ayırır. Komut kelimesi
 * gerekmez (alışkanlıkla söylenirse atlanır) ve art arda birden fazla komut
 * söylenebilir ("son cümleyi sil ve yeni satır"). Komut olarak anlaşılamayan
 * kısım metne eklenmez; `unrecognized` içinde döner.
 */
export function parseCommandSpeech(segment: string, wakeWord = DEFAULT_WAKE_WORD): ParsedSegment {
  const lowered = toLowerTr(segment)
  if (lowered.length !== segment.length) return { parts: [], unrecognized: [segment.trim()] }

  const parts: SegmentPart[] = []
  let position = 0
  while (true) {
    position = skipSeparators(lowered, position)
    const wake = findWakeWords(lowered.slice(position), wakeWord)[0]
    if (wake?.exact && wake.start === 0) position = skipSeparators(lowered, position + wake.end)
    if (position >= lowered.length) break

    const found = matchCommand(lowered.slice(position), segment.slice(position))
    if (!found) return { parts, unrecognized: [segment.slice(position).trim()] }
    const end = position + found.length
    parts.push({ type: 'command', command: found.command, spoken: segment.slice(position, end) })
    position = end
  }
  return { parts, unrecognized: [] }
}

function skipSeparators(lowered: string, position: number) {
  return position + (COMMAND_SEPARATOR.exec(lowered.slice(position))?.[0].length ?? 0)
}

/**
 * Komut kelimesinden sonra gelen metnin başında bir komut arar. En az hatalı eşleşmeyi,
 * eşitlikte en uzun olanı, o da eşitse listede önce geleni seçer.
 */
function matchCommand(lowered: string, source: string): { command: Command; length: number } | null {
  const words = splitWords(lowered)
  let best: { match: PatternMatch; command: Command; verbs: string[] } | null = null

  for (const { rule, patterns, verbs } of COMPILED_RULES) {
    for (const pattern of patterns) {
      const match = matchPattern(pattern, words, source)
      if (!match || match.wordCount === 0) continue
      const better =
        !best ||
        match.errors < best.match.errors ||
        (match.errors === best.match.errors && match.wordCount > best.match.wordCount)
      if (better) best = { match, command: rule.toCommand(match.slots), verbs }
    }
  }
  if (!best) return null
  // Komutun son kelimesi ya da arkasından gelen kelime bir fiilin olumsuzuysa komut
  // uygulanmaz ("her şeyi silme", "nokta koyma"). Hata payıyla eşleşen komutta bütün komut
  // fiillerine bakılır: "parantez kapatma" hata payıyla "parantez aç" sanılmasın. Birebir
  // eşleşende yalnızca kendi fiillerine: "Nova, yeni satır alman gerekenler"deki "alman",
  // "al"ın olumsuzu sayılmasın. Birebir eşleşip kalıbın son kelimesiyle biten komutun
  // arkasındaki kelime dikteye aittir: "Nova, başa git, gitmeden önce bak."
  const { wordCount, errors, endsWithLastWord } = best.match
  const verbs = errors > 0 ? COMMAND_VERBS : best.verbs
  const checked = errors === 0 && endsWithLastWord ? [words[wordCount - 1]] : [words[wordCount - 1], words[wordCount]]
  if (checked.some((word) => word && isNegatedVerb(word.text, verbs))) return null
  // Serbest metin "ve" ile bağlanan ikinci komutu yutmasın: "kırmızı yerine mavi yaz ve yeşil
  // yerine sarı yaz" iki değiştirmedir. "ve"den önceki kısım tek başına tamamlanmış bir komutsa
  // ve arkasından da bir komut geliyorsa komut "ve"den önce biter; sonrakini çağıran ayrı alır.
  // "kırmızı yerine mavi ve yeşil yaz"da "ve"den öncesi komut olmadığından tek komut kalır.
  for (let index = 1; index < wordCount - 1; index++) {
    if (words[index].text !== 've') continue
    const before = words[index].start
    const first = matchCommand(lowered.slice(0, before), source.slice(0, before))
    const after = words[index + 1].start
    if (first?.length === words[index - 1].end && matchCommand(lowered.slice(after), source.slice(after))) {
      return first
    }
  }
  return { command: best.command, length: words[wordCount - 1].end }
}

function isNegatedVerb(word: string, verbs: string[]) {
  return verbs.some((verb) => word.startsWith(verb) && NEGATION.test(word.slice(verb.length)))
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
