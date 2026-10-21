/**
 * Metni Türkçe kurallarına göre küçük harfe çevirir.
 *
 * Varsayılan `toLowerCase()` Türkçe'yi bilmez: "İ" harfini "i̇" (i + ayrı nokta),
 * "I" harfini ise "ı" yerine "i" yapar. Komut eşleştirmede bu fonksiyon kullanılmalı.
 */
export function toLowerTr(text: string): string {
  return text.toLocaleLowerCase('tr-TR')
}

/** İlk harfi Türkçe kurallarına göre büyük yapar ("istanbul" → "İstanbul"). */
export function capitalizeTr(text: string): string {
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1)
}

/** Her kelimenin ilk harfini büyütür ("ayşe hanım'a" → "Ayşe Hanım'a"). */
export function capitalizeWords(text: string): string {
  return text.replace(/(?<![\p{L}\p{N}'’])\p{L}/gu, (letter) => letter.toLocaleUpperCase('tr-TR'))
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u

/**
 * Bir ifadenin metinde tam kelime olarak geçtiği yerleri bulur (büyük/küçük
 * harf farkı gözetmeden). "yarın" araması "yarınki" içinde eşleşmez.
 */
export function findPhrases(text: string, phrase: string): { start: number; end: number }[] {
  const haystack = toLowerTr(text)
  const needle = toLowerTr(phrase.trim())
  // Küçük harfe çevirme konumları kaydırırsa güvenli arama yapılamaz.
  if (!needle || haystack.length !== text.length) return []

  const found: { start: number; end: number }[] = []
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    const end = index + needle.length
    const before = haystack.charAt(index - 1)
    const after = haystack.charAt(end)
    if (!WORD_CHARACTER.test(before) && !WORD_CHARACTER.test(after)) found.push({ start: index, end })
  }
  return found
}

/** Kelime sayısı; madde işaretleri ve tek başına duran noktalama sayılmaz. */
export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0
}
