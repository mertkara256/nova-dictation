/** İki metin arasındaki düzenleme uzaklığı: kaç harf eklenip silinip değiştirilmeli. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
    }
    previous = current
  }
  return previous[b.length]
}

/**
 * Bir ifadenin konuşma tanımadaki küçük yazım hatalarına rağmen eşleşmesi için
 * izin verilen hata sayısı. Kısa ifadelerde tolerans düşük tutulur ki başka
 * kelimeler yanlışlıkla komut sanılmasın.
 */
export function allowedErrors(target: string): number {
  if (target.length >= 10) return 2
  if (target.length >= 5) return 1
  return 0
}
