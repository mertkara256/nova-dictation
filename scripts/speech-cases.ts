/**
 * Ses taramasının (`npm run scan:speech`) vakaları. Her vaka seslendirilip Whisper'a
 * yazdırılır; Whisper'ın yazdığı metin uygulamanın düzenleyicisinden geçirilir ve
 * sonuç, ifadenin kendisi yazılsaydı varılacak sonuçla karşılaştırılır. İfadenin
 * kendisinin beklenen sonucu verdiği `speech-cases.test.ts` ile denetlenir.
 */
import { COMMAND_HELP } from '../src/commands/help.ts'
import { type ParsedSegment, parseCommandSpeech, parseSegment } from '../src/commands/parse.ts'
import { DEFAULT_WAKE_WORD } from '../src/commands/wakeWord.ts'
import { type EditorState, editorReducer, initialEditorState } from '../src/core/editor.ts'
import { toLowerTr } from '../src/core/text.ts'

export const CATEGORIES = {
  komut: 'Komut listesi',
  sonuc: 'Komutların sonucu',
  zincir: 'Art arda komutlar',
  ara: 'Dikte arasında komut',
  dikte: 'Dikte',
  degil: 'Komut sanılmaması gerekenler',
} as const

export type Category = keyof typeof CATEGORIES

export interface ScanCase {
  category: Category
  /** Seslendirilen metin. */
  say: string
  /** ⌃ basılıyken mi söylenir; değilse dikte gibi. */
  key: boolean
  /** Sonuç dosyasındaki anahtarı; aynı ifade farklı metinlerde denenebilir. */
  id: string
  /** Whisper'ın yazdığından uygulamanın vardığı sonuç. */
  outcome(heard: string): string
  /** Doğru sayılan sonuçlar; ilki ifadenin kendisinden çıkması gereken. */
  accepted: string[]
  /**
   * Sonuç birebir mi (büyük/küçük harf hariç) karşılaştırılır, yoksa yalnızca kelimeler
   * ve satırlar mı? Dikte edilen cümlelerde Whisper'ın noktalaması değişebilir.
   */
  exact: boolean
}

interface TextCase {
  say: string
  key?: boolean
  /** Konuşmadan önce metin alanında yazılı olan; "|" imlecin yeri, yoksa imleç sonda. */
  before?: string
  /** Konuşmadan hemen önce dikte edilmiş olan ("bunu sil", "geri al" için). */
  dictated?: string
  /** Beklenen metin; Whisper'ın yazabileceği başka doğru biçimler de verilebilir. */
  expect: string | string[]
}

const RESULTS: TextCase[] = [
  { before: 'Toplantı yarın. Saat onda başlıyor.', say: 'Nova, son cümleyi sil.', expect: 'Toplantı yarın.' },
  { before: 'Toplantı yarın. Saat onda başlıyor.', say: 'son cümleyi sil', key: true, expect: 'Toplantı yarın.' },
  { before: 'Bir. İki. Üç.', say: 'Nova, ikinci cümleyi sil.', expect: 'Bir. Üç.' },
  { before: 'Bir. İki. Üç.', say: 'ilk cümleyi sil', key: true, expect: 'İki. Üç.' },
  { before: 'Bugün hava çok güzel', say: 'Nova, son iki kelimeyi sil.', expect: 'Bugün hava' },
  { before: 'Bir iki üç dört', say: 'son kelimeyi sil', key: true, expect: 'Bir iki üç' },
  { before: 'Kırmızı elma ve armut.', say: 'Nova, elma kelimesini sil.', expect: 'Kırmızı ve armut.' },
  { before: 'Bir.\nİki.\nÜç.', say: 'Nova, ikinci satırı sil.', expect: 'Bir.\nÜç.' },
  { before: 'Bir\nİki', say: 'son satırı sil', key: true, expect: 'Bir' },
  { before: 'İlk paragraf.\n\nİkinci paragraf.', say: 'Nova, son paragrafı sil.', expect: 'İlk paragraf.' },
  { before: 'Görüşürüz. Selamlar.', say: 'her şeyi sil', key: true, expect: '' },
  { before: 'İlk cümle.', dictated: 'Gereksiz bir cümle.', say: 'Nova, bunu sil.', expect: 'İlk cümle.' },
  { before: 'İlk cümle.', dictated: 'Gereksiz bir cümle.', say: 'bunu sil', key: true, expect: 'İlk cümle.' },
  { before: 'İlk cümle.', dictated: 'Yeni cümle.', say: 'Nova, geri al.', expect: 'İlk cümle.' },
  { before: 'İlk cümle.', dictated: 'Yeni cümle.', say: 'geri al', key: true, expect: 'İlk cümle.' },
  { before: 'Toplantı yarın saat onda.', say: 'Nova, yarın yerine perşembe yaz.', expect: 'Toplantı perşembe saat onda.' },
  { before: 'Toplantı yarın saat onda.', say: 'yarın yerine cuma yaz', key: true, expect: 'Toplantı cuma saat onda.' },
  { before: 'Toplantı yarın', say: 'Nova, virgül.', expect: 'Toplantı yarın,' },
  { before: 'Toplantı yarın', say: 'nokta', key: true, expect: 'Toplantı yarın.' },
  { before: 'Geliyor musun', say: 'soru işareti', key: true, expect: 'Geliyor musun?' },
  { before: 'Harika', say: 'Nova, ünlem.', expect: 'Harika!' },
  { before: 'Alışveriş listesi', say: 'Nova, yeni satır.', expect: 'Alışveriş listesi\n' },
  { before: 'Birinci paragraf.', say: 'yeni paragraf', key: true, expect: 'Birinci paragraf.\n\n' },
  { before: 'Adı', say: 'Nova, tırnak aç.', expect: 'Adı “' },
  { before: 'Toplantı ankara ofisinde.', say: 'Nova, ankara kelimesini büyük harfle yaz.', expect: 'Toplantı Ankara ofisinde.' },
  { before: 'Bu çok önemli.', say: 'Nova, önemli kelimesini tırnak içine al.', expect: 'Bu çok “önemli”.' },
  { before: 'Alışveriş', say: 'Nova, üç boş madde ekle.', expect: 'Alışveriş\n- \n- \n- ' },
  { before: 'Toplantı yarın.', say: 'Nova, başa git. Önemli.', expect: 'Önemli. Toplantı yarın.' },
  { before: 'Toplantı yarın.', say: 'Nova, toplantı kelimesinden sonra yaz. Saat onda', expect: 'Toplantı Saat onda yarın.' },
]

const CHAINS: TextCase[] = [
  { before: 'Toplantı yarın. Saat onda.', say: 'Nova, son cümleyi sil ve yeni satır.', expect: 'Toplantı yarın.\n' },
  { before: 'Toplantı yarın. Saat onda.', say: 'son cümleyi sil ve yeni satır', key: true, expect: 'Toplantı yarın.\n' },
  { before: 'Merhaba', say: 'virgül ve yeni satır', key: true, expect: 'Merhaba,\n' },
  { before: 'Bugün hava güzel değil', say: 'Nova, son kelimeyi sil ve nokta.', expect: 'Bugün hava güzel.' },
  { before: 'Geliyor musun yarın akşam', say: 'son iki kelimeyi sil ve soru işareti', key: true, expect: 'Geliyor musun?' },
  { before: 'Bir. İki. Üç.', say: 'son cümleyi sil, son cümleyi sil', key: true, expect: 'Bir.' },
  { before: 'Tamam', say: 'nokta, yeni satır', key: true, expect: 'Tamam.\n' },
  { before: 'Toplantı yarın', say: 'Nova, yarın yerine cuma yaz ve nokta.', expect: 'Toplantı cuma.' },
  { before: 'Başlık', say: 'yeni satır ve yeni satır', key: true, expect: 'Başlık\n\n' },
  { before: 'İlk cümle.', dictated: 'İkinci cümle.', say: 'geri al ve yinele', key: true, expect: 'İlk cümle. İkinci cümle.' },
]

const IN_DICTATION: TextCase[] = [
  { say: 'Toplantı yarın sabah. Nova, yeni satır. Saat onda başlıyor.', expect: 'Toplantı yarın sabah.\nSaat onda başlıyor.' },
  { say: 'Bugün markete gittim. Nova, son cümleyi sil. Yarın markete gideceğim.', expect: 'Yarın markete gideceğim.' },
  { say: 'Sevgili Ali, Nova, yeni paragraf. Toplantı ertelendi.', expect: 'Sevgili Ali\n\nToplantı ertelendi.' },
  { say: 'Merhaba. Nova, yeni satır. Nasılsın?', expect: 'Merhaba.\nNasılsın?' },
  { before: 'Liste:', say: 'Nova, yeni satır. Süt, ekmek ve peynir.', expect: 'Liste:\nSüt, ekmek ve peynir.' },
  { say: 'Raporu bitirdim. Nova, geri al.', expect: '' },
  { say: 'Yarın gelirim. Nova, yarın yerine cuma yaz.', expect: 'cuma gelirim.' },
  { say: 'Fatura geldi. Nova, son cümleyi sil ve yeni satır. Kira ödendi.', expect: '\nKira ödendi.' },
  { before: 'Notlar.', say: 'Süt al. Nova, yeni satır. Ekmek al. Nova, yeni satır. Peynir al.', expect: 'Notlar. Süt al.\nEkmek al.\nPeynir al.' },
  { say: 'Bugün hava çok sıcak. Nova, son kelimeyi sil. Serin.', expect: 'Bugün hava çok Serin.' },
]

const DICTATION: TextCase[] = [
  { say: 'Toplantı yarın sabah başlıyor.', expect: 'Toplantı yarın sabah başlıyor.' },
  { say: 'Saat üçte buluşalım mı?', expect: ['Saat üçte buluşalım mı?', "Saat 3'te buluşalım mı?"] },
  { say: 'Yirmi beş kişi katıldı.', expect: ['Yirmi beş kişi katıldı.', '25 kişi katıldı.'] },
  { say: 'Fiyatı yüz elli lira.', expect: ['Fiyatı yüz elli lira.', 'Fiyatı 150 lira.'] },
  { say: 'Ekim ayının on beşinde görüşürüz.', expect: ['Ekim ayının on beşinde görüşürüz.', "Ekim ayının 15'inde görüşürüz."] },
  { say: 'İki bin yirmi altı yılında taşındık.', expect: ['İki bin yirmi altı yılında taşındık.', '2026 yılında taşındık.'] },
  { say: 'Yüzde on indirim var.', expect: ['Yüzde on indirim var.', 'Yüzde 10 indirim var.', '%10 indirim var.'] },
  { say: "Ankara'dan İstanbul'a trenle gittik.", expect: "Ankara'dan İstanbul'a trenle gittik." },
  { say: "Mehmet Bey'e rapor gönderildi.", expect: "Mehmet Bey'e rapor gönderildi." },
  { say: "Hafta sonu Kapadokya'ya gideceğiz.", expect: "Hafta sonu Kapadokya'ya gideceğiz." },
  { say: "Eşim yarın İzmir'e gidiyor.", expect: "Eşim yarın İzmir'e gidiyor." },
  { say: 'Bugün hava çok güzel, dışarı çıkalım.', expect: 'Bugün hava çok güzel, dışarı çıkalım.' },
  { say: 'Lütfen dosyayı e-posta ile gönder.', expect: ['Lütfen dosyayı e-posta ile gönder.', 'Lütfen dosyayı e-postayla gönder.'] },
  { say: 'Ne zaman geleceksin?', expect: 'Ne zaman geleceksin?' },
  { say: 'Kahvaltıda peynir, zeytin, domates ve salatalık yedik.', expect: 'Kahvaltıda peynir, zeytin, domates ve salatalık yedik.' },
  {
    say: 'Öğleden sonra şirketin yönetim kuruluyla bir araya gelip yeni yılın bütçesini konuşacağız.',
    expect: 'Öğleden sonra şirketin yönetim kuruluyla bir araya gelip yeni yılın bütçesini konuşacağız.',
  },
  { say: 'Şu anda çalışıyorum, sonra ararım.', expect: 'Şu anda çalışıyorum, sonra ararım.' },
  { say: 'Görüşmek üzere, iyi akşamlar.', expect: 'Görüşmek üzere, iyi akşamlar.' },
  { say: 'Çocuklar bahçede oynuyor.', expect: 'Çocuklar bahçede oynuyor.' },
  { say: 'Toplantıyı bir saat erteleyebilir miyiz?', expect: 'Toplantıyı bir saat erteleyebilir miyiz?' },
  { say: 'Kredi kartı ekstresi geldi.', expect: 'Kredi kartı ekstresi geldi.' },
  { say: 'Çarşamba günü öğretmenler toplantısı var.', expect: 'Çarşamba günü öğretmenler toplantısı var.' },
  { say: 'Ağaçların yaprakları sararmaya başladı.', expect: 'Ağaçların yaprakları sararmaya başladı.' },
  { say: 'Sınav sonuçları önümüzdeki hafta açıklanacak.', expect: 'Sınav sonuçları önümüzdeki hafta açıklanacak.' },
  { before: 'Toplantı | saat onda.', say: 'perşembe günü', expect: 'Toplantı perşembe günü saat onda.' },
]

/** Komut sanılmaması gerekenler: dikte edilince ya da ⌃ basılıyken söylenince hiçbir komut uygulanmamalı. */
const NOT_COMMANDS: { say: string; key?: boolean }[] = [
  { say: 'Tahtadaki yazıyı sildim.' },
  { say: 'Son cümleyi silmeyi unutma.' },
  { say: 'Parayı geri aldım.' },
  { say: 'Bu kelimeyi seçtim çünkü daha anlamlı.' },
  { say: 'Dosyaya yeni satır ekledim.' },
  { say: 'Her şeyi silip baştan yazdım.' },
  { say: 'Nova yıldızı gece parlıyordu.' },
  { say: 'Nova, bugün çok yorgunum.' },
  { say: "Nova'nın kurucusu konuştu." },
  { say: 'Nova adlı bir uygulama kullanıyorum.' },
  { say: 'Bossa nova müziğini severim.' },
  { say: 'bugün hava güzel', key: true },
  { say: 'yarın görüşürüz', key: true },
  // Komutun olumsuzu
  { say: 'Nova, her şeyi silme.' },
  { say: 'Nova, son cümleyi silme.' },
  { say: 'Nova, parantez kapatma.' },
  { say: 'Nova, geri alma.' },
  { say: 'son cümleyi silme', key: true },
  { say: 'bunu silme', key: true },
]

const TEXT_CASES: Partial<Record<Category, TextCase[]>> = {
  sonuc: RESULTS,
  zincir: CHAINS,
  ara: IN_DICTATION,
  dikte: DICTATION,
}

// Dikte edilen cümlelerin karşılaştırması gevşektir; komut sonuçlarınınki birebir.
const LOOSE: Category[] = ['ara', 'dikte']

export const SCAN_CASES: ScanCase[] = [
  ...commandListCases(),
  ...Object.entries(TEXT_CASES).flatMap(([category, cases]) =>
    cases.map((textCase) => fromTextCase(category as Category, textCase)),
  ),
  ...NOT_COMMANDS.map(notCommandCase),
]

/** Sonuç doğru sayılan sonuçlardan biri mi? */
export function isAccepted(scanCase: ScanCase, outcome: string): boolean {
  const normalize = scanCase.exact ? toLowerTr : words
  return scanCase.accepted.some((accepted) => normalize(accepted) === normalize(outcome))
}

/** Komut listesindeki her ifade, komut kelimesiyle ve ⌃ basılıyken söylenir gibi. */
function commandListCases(): ScanCase[] {
  const phrases = COMMAND_HELP.flatMap((group) => group.commands.flatMap(({ say }) => say.split(' · ')))
  const variants = [
    { key: false, spoken: (phrase: string) => `${DEFAULT_WAKE_WORD}, ${phrase}.`, parse: parseSegment },
    { key: true, spoken: (phrase: string) => phrase, parse: parseCommandSpeech },
  ]
  return phrases.flatMap((phrase) =>
    variants.map(({ key, spoken, parse }) => {
      const say = spoken(phrase)
      const outcome = (heard: string) => commandsOf(parse(heard))
      return { category: 'komut' as const, say, key, id: say, outcome, accepted: [outcome(say)], exact: true }
    }),
  )
}

function fromTextCase(category: Category, { say, key = false, before = '', dictated, expect }: TextCase): ScanCase {
  return {
    category,
    say,
    key,
    id: [before, dictated, say].filter(Boolean).join(' ▸ ').replaceAll('\n', '↵'),
    outcome: (heard) => edit(before, dictated, heard, key),
    accepted: typeof expect === 'string' ? [expect] : expect,
    exact: !LOOSE.includes(category),
  }
}

/** Whisper sözü yanlış yazsa da olur; yalnızca bir komut uygulanıp uygulanmadığına bakılır. */
function notCommandCase({ say, key = false }: { say: string; key?: boolean }): ScanCase {
  const parse = key ? parseCommandSpeech : parseSegment
  const outcome = (heard: string) => {
    const commands = parse(heard).parts.flatMap((part) => (part.type === 'command' ? [part.command] : []))
    return commands.length > 0 ? JSON.stringify(commands) : ''
  }
  return { category: 'degil', say, key, id: say, outcome, accepted: [''], exact: true }
}

/** Söyleneni, uygulamadaki gibi düzenleyiciye kesinleşmiş bir parça olarak verir. */
function edit(before: string, dictated: string | undefined, segment: string, key: boolean): string {
  const caret = before.indexOf('|')
  let state: EditorState = {
    ...initialEditorState,
    text: before.replace('|', ''),
    selection: caret >= 0 ? { start: caret, end: caret } : null,
  }
  const spoken = { wakeWord: DEFAULT_WAKE_WORD, at: 0 }
  if (dictated) state = editorReducer(state, { type: 'dictate', segment: dictated, ...spoken })
  state = editorReducer(state, { type: key ? 'command-speech' : 'dictate', segment, ...spoken })
  return state.text
}

/** Ayrıştırılan komutlar, karşılaştırılabilir halde; metin ya da tanınmayan ifade kalırsa boş. */
function commandsOf(parsed: ParsedSegment): string {
  if (parsed.unrecognized.length > 0) return ''
  if (parsed.parts.some((part) => part.type === 'text' && part.text.trim())) return ''
  const commands = parsed.parts.flatMap((part) => (part.type === 'command' ? [part.command] : []))
  // Komuttaki kelimeler ("yarın kelimesini sil") Whisper'da büyük harfle başlayabilir.
  return commands.length > 0 ? toLowerTr(JSON.stringify(commands)) : ''
}

/** Gevşek karşılaştırma için: küçük harf, noktalamasız; kesme işareti atılır, satırlar korunur. */
function words(text: string): string {
  return toLowerTr(text)
    .replace(/['’]/g, '')
    .split('\n')
    .map((line) => line.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).join(' '))
    .join('\n')
    .trim()
}
