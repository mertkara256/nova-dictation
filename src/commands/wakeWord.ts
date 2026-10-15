import { capitalizeTr, toLowerTr } from '../core/text.ts'

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
