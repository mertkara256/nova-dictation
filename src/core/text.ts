/**
 * Metni Türkçe kurallarına göre küçük harfe çevirir.
 *
 * Varsayılan `toLowerCase()` Türkçe'yi bilmez: "İ" harfini "i̇" (i + ayrı nokta),
 * "I" harfini ise "ı" yerine "i" yapar. Komut eşleştirmede bu fonksiyon kullanılmalı.
 */
export function toLowerTr(text: string): string {
  return text.toLocaleLowerCase('tr-TR')
}
