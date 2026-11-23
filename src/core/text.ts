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
  const { lower: haystack, offsets } = searchable(text)
  const needle = searchable(phrase.trim()).lower
  if (!needle) return []

  const found: { start: number; end: number }[] = []
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    const end = index + needle.length
    const before = haystack.charAt(index - 1)
    const after = haystack.charAt(end)
    if (WORD_CHARACTER.test(before) || WORD_CHARACTER.test(after)) continue
    const start = offsets.get(index)
    const originalEnd = offsets.get(end)
    if (start !== undefined && originalEnd !== undefined) found.push({ start, end: originalEnd })
  }
  return found
}

/**
 * Aramaya hazır metin: her harf, ardındaki birleşik işaretlerle birlikte NFC'ye
 * getirilip Türkçe küçük harfe çevrilir. Böylece ayrışmış "İ" ("I" + U+0307)
 * hem "İ" hem "i" aramasında bulunur. Bu uzunluğu değiştirebildiği için
 * `offsets`, her harf öbeğinin aranacak metindeki başlangıcından asıl metindeki
 * başlangıcına gider; öbeğin ortasına düşen konum bulunmaz.
 */
function searchable(text: string): { lower: string; offsets: Map<number, number> } {
  let lower = ''
  const offsets = new Map<number, number>()
  for (const { 0: cluster, index } of text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
    offsets.set(lower.length, index)
    lower += toLowerTr(cluster.normalize('NFC'))
  }
  offsets.set(lower.length, text.length)
  return { lower, offsets }
}

/**
 * İfadenin metinde son geçtiği yer; arkasına kesme işaretiyle bir ek gelmişse
 * ek de dahil ("ankara" araması "Ankara'ya"nın tamamını verir). Silme, seçme
 * gibi işlerde ek kelimeyle birlikte ele alınır; ortada "'ya" kalmaz.
 * İfade metinde birebir yoksa ek almış hali aranır ("rapor" → "Raporu").
 */
export function findLastWithSuffix(text: string, phrase: string): { start: number; end: number } | null {
  const range = findPhrases(text, phrase).at(-1) ?? findLastInflected(text, phrase)
  return range ? withSuffix(text, range) : null
}

/**
 * İfadenin son kelimesine bitişik ek almış halinin metinde son geçtiği yer, ekiyle
 * birlikte ("rapor" → "raporlarımızdan"). Arkasındaki harfler ünlü uyumuna uyan
 * çekim ekleri olmalıdır; "gün" araması "güneş"i bulmaz. Kısa ifadeler başka
 * kelimelerin başına çok kolay uyduğu için ("ev" → "evet") en az üç harf gerekir.
 */
function findLastInflected(text: string, phrase: string): { start: number; end: number } | null {
  const { lower: haystack, offsets } = searchable(text)
  const needle = searchable(phrase.trim()).lower
  if (needle.length < 3) return null

  let found: { start: number; end: number } | null = null
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    if (WORD_CHARACTER.test(haystack.charAt(index - 1))) continue
    const suffix = /^\p{L}+/u.exec(haystack.slice(index + needle.length))
    if (!suffix || !isInflection(needle, suffix[0])) continue
    const start = offsets.get(index)
    const end = offsets.get(index + needle.length + suffix[0].length)
    if (start !== undefined && end !== undefined) found = { start, end }
  }
  return found
}

/**
 * Bitişik çekim ekleri, kelimeye eklendikleri sırayla: çoğul, iyelik, hâl. Büyük
 * harfler ünlü ve ünsüz uyumuyla değişir: A → a/e, I → ı/i/u/ü, D → d/t. Bulunma ekine
 * gelen "-ki" uyuma girmez ("toplantıdaki", "sepetteki").
 */
const SUFFIX_SLOTS = [
  { afterConsonant: ['lAr'], afterVowel: ['lAr'] },
  {
    afterConsonant: ['Im', 'In', 'I', 'ImIz', 'InIz', 'lArI'],
    afterVowel: ['m', 'n', 'sI', 'mIz', 'nIz', 'lArI'],
  },
  {
    afterConsonant: ['I', 'A', 'DA', 'DAn', 'In', 'lA', 'DAki'],
    afterVowel: ['yI', 'yA', 'DA', 'DAn', 'nIn', 'ylA', 'DAki'],
  },
]
/** Üçüncü kişi iyelik ekinden sonra hâl eki "n" ile bağlanır ("raporunu", "arabasından"). */
const CASE_AFTER_THIRD_PERSON = ['nI', 'nA', 'nDA', 'nDAn', 'nIn', 'ylA', 'nDAki']
const THIRD_PERSON = new Set(['I', 'sI', 'lArI'])
const VOWELS = /[aeıioöuü]/g
const FOUR_WAY_VOWEL: Record<string, string> = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }

/** `suffix`, `word`e eklenmiş bir ya da birkaç çekim ekinden mi oluşuyor (ikisi de küçük harf). */
function isInflection(word: string, suffix: string, slot = 0, afterThirdPerson = false): boolean {
  if (!suffix) return true
  const endsWithVowel = /[aeıioöuü]$/.test(word)
  for (let next = slot; next < SUFFIX_SLOTS.length; next++) {
    const templates =
      next === 2 && afterThirdPerson
        ? CASE_AFTER_THIRD_PERSON
        : SUFFIX_SLOTS[next][endsWithVowel ? 'afterVowel' : 'afterConsonant']
    for (const template of templates) {
      const form = harmonize(word, template)
      if (!form || !suffix.startsWith(form)) continue
      const thirdPerson = next === 1 && THIRD_PERSON.has(template)
      if (isInflection(word + form, suffix.slice(form.length), next + 1, thirdPerson)) return true
    }
  }
  return false
}

/** Ek kalıbını kelimenin son ünlüsüne ve son harfine göre yazar; kelimede ünlü yoksa null. */
function harmonize(word: string, template: string): string | null {
  let result = word
  for (const letter of template) {
    const vowel = result.match(VOWELS)?.at(-1)
    if (letter === 'D') result += /[fstkçşhp]$/.test(result) ? 't' : 'd'
    else if (letter !== 'A' && letter !== 'I') result += letter
    else if (!vowel) return null
    else if (letter === 'A') result += /[aıou]/.test(vowel) ? 'a' : 'e'
    else result += FOUR_WAY_VOWEL[vowel]
  }
  return result.slice(word.length)
}

/** Aralığın arkasına kesme işaretiyle eklenmiş eki de aralığa katar. */
export function withSuffix(text: string, range: { start: number; end: number }) {
  const suffix = /^['’][\p{L}\p{N}]+/u.exec(text.slice(range.end))
  return suffix ? { start: range.start, end: range.end + suffix[0].length } : range
}

/** Kelime sayısı; madde işaretleri ve tek başına duran noktalama sayılmaz. */
export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0
}
