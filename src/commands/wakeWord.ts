import { capitalizeTr, toLowerTr } from '../core/text.ts'
import { allowedErrors, editDistance } from './fuzzy.ts'

/** Komutlardan önce söylenen kelime; kullanıcı ayarlardan değiştirebilir. */
export const DEFAULT_WAKE_WORD = 'Nova'

const MIN_LETTERS = 3
export const MAX_WAKE_WORD_LETTERS = 20

export type WakeWordCheck = { ok: true; word: string } | { ok: false; error: string }

/**
 * Kullanıcının yazdığı komut kelimesini denetler. Tek kelime ve yalnızca harf
 * olmalı; çok kısa kelimeler konuşmada kolayca geçeceği için kabul edilmez.
 * Geçerliyse baş harfi büyük olarak döner (ör. "asistan" → "Asistan").
 */
export function checkWakeWord(input: string): WakeWordCheck {
  const word = input.trim()
  if (!word) return { ok: false, error: 'Bir kelime yaz.' }
  if (!/^\p{L}+$/u.test(word)) {
    return { ok: false, error: 'Yalnızca harflerden oluşan tek bir kelime yaz.' }
  }
  if (word.length < MIN_LETTERS) return { ok: false, error: `En az ${MIN_LETTERS} harf olmalı.` }
  if (word.length > MAX_WAKE_WORD_LETTERS) {
    return { ok: false, error: `En fazla ${MAX_WAKE_WORD_LETTERS} harf olabilir.` }
  }
  return { ok: true, word: capitalizeTr(toLowerTr(word)) }
}

/**
 * Küçük harfe çevrilmiş metinde komut kelimesini bulan ifade. Konuşma tanıma
 * kelimeyi bazen hecelerine böler ("No va"), bu yüzden heceler arasındaki
 * boşluk isteğe bağlıdır. Harf veya rakamla bitişik geçtiğinde (ör. "Nova'ya",
 * "novalar") komut kelimesi sayılmaz.
 */
export function wakeWordPattern(wakeWord: string): RegExp {
  const syllables = splitSyllables(toLowerTr(wakeWord)).map(escapeRegExp)
  return new RegExp(`(?<![\\p{L}\\p{N}])${syllables.join(' ?')}(?![\\p{L}\\p{N}'’])`, 'gu')
}

export interface WakeWordMatch {
  start: number
  end: number
  /** false ise kelime küçük bir yazım farkıyla bulundu (ör. "Jarvis" yerine "Carvis"). */
  exact: boolean
}

// Harf veya rakamla bitişik olmayan, kesme işaretiyle ek almamış kelime.
const STANDALONE_WORD = /(?<![\p{L}\p{N}])\p{L}+(?![\p{L}\p{N}'’])/gu

/**
 * Küçük harfe çevrilmiş metinde komut kelimesinin geçtiği yerleri bulur.
 * Tam eşleşmelerin yanında, konuşma tanımanın uzun kelimelerdeki küçük yazım
 * hatalarını da yakalar (komutlardaki toleransla aynı: 5 harften itibaren 1,
 * 10 harften itibaren 2 harf farkı). Kelimenin ekli halleri ("asistana",
 * "jarvisi") yazım hatası sayılmaz; onlar konuşmanın bir parçasıdır.
 */
export function findWakeWords(lowered: string, wakeWord: string): WakeWordMatch[] {
  const target = toLowerTr(wakeWord)
  const matches: WakeWordMatch[] = [...lowered.matchAll(wakeWordPattern(wakeWord))].map(
    (match) => ({ start: match.index, end: match.index + match[0].length, exact: true }),
  )

  const allowed = allowedErrors(target)
  if (allowed > 0) {
    for (const match of lowered.matchAll(STANDALONE_WORD)) {
      const word = match[0]
      // Tam eşleşme zaten bulundu; kelimeyle başlayan uzun haller ise ektir.
      if (word.startsWith(target)) continue
      if (editDistance(word, target) <= allowed) {
        matches.push({ start: match.index, end: match.index + word.length, exact: false })
      }
    }
  }

  return matches.sort((a, b) => a.start - b.start)
}

const VOWEL = /[aeıioöuüâîû]/

/**
 * Kelimeyi Türkçe hece kuralıyla böler: her ünlü yeni bir hece başlatır ve
 * önündeki tek ünsüz o heceye geçer ("nova" → no-va, "asistan" → a-sis-tan).
 */
export function splitSyllables(word: string): string[] {
  const starts: number[] = []
  let previousVowel = -1
  for (let index = 0; index < word.length; index++) {
    if (!VOWEL.test(word[index])) continue
    if (previousVowel >= 0) {
      const consonantBefore = index - 1 > previousVowel
      starts.push(consonantBefore ? index - 1 : index)
    }
    previousVowel = index
  }
  return [0, ...starts].map((start, i, all) => word.slice(start, all[i + 1]))
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
