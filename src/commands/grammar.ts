import type { Slots } from './matcher.ts'
import type { Command } from './types.ts'

export interface CommandRule {
  /** Kalıp dili için bkz. compilePattern. */
  patterns: string[]
  toCommand(slots: Slots): Command
}

const MAX_COUNT = 20

const count = (slots: Slots) => Math.min(Math.max(slots.count ?? 1, 1), MAX_COUNT)
const ordinal = (slots: Slots) => slots.ordinal ?? 'last'

// Whisper "geri al"ı çoğu zaman geçmiş zamanla yazar ("geri aldı", "geri aldım"). Hata payı
// bu ekleri karşılamayınca komut ya tanınmıyor ya da son kelimesi metne düşüyordu
// ("3 kere geri aldım" → "aldım.").
const UNDO_VERBS = ['geri al', 'geri aldı', 'geri aldım']
const REDO_VERBS = ['yinele', 'ileri al', 'ileri aldı', 'ileri aldım']
/** "üç kez geri al" gibi tekrarlı söyleyişler. */
const repeated = (verbs: string[]) =>
  ['kez', 'kere', 'defa', 'adım'].flatMap((unit) => verbs.map((verb) => `{count} ${unit} ${verb}`))
const text = (slots: Slots) => slots.text ?? ''
const text2 = (slots: Slots) => slots.text2 ?? ''

/** Komut kelimesinden ("Nova") sonra söylenebilecek bütün komutlar. Yeni komut buraya eklenir. */
export const RULES: CommandRule[] = [
  // ---------------------------------------------------------------- Silme
  {
    patterns: ['{ordinal} cümleyi sil', '{ordinal} cümleyi kaldır'],
    toCommand: (slots) => ({ type: 'delete-sentence', which: ordinal(slots) }),
  },
  {
    patterns: ['{ordinal} paragrafı sil', '{ordinal} paragrafı kaldır'],
    toCommand: (slots) => ({ type: 'delete-paragraph', which: ordinal(slots) }),
  },
  {
    patterns: ['{ordinal} satırı sil', '{ordinal} satırı kaldır'],
    toCommand: (slots) => ({ type: 'delete-line', which: ordinal(slots) }),
  },
  {
    patterns: ['son {count?} kelimeyi sil', 'son {count?} kelimeyi kaldır'],
    toCommand: (slots) => ({ type: 'delete-words', count: count(slots) }),
  },
  {
    patterns: ['{text} kelimesini sil', '{text} kelimelerini sil', '{text} ifadesini sil'],
    toCommand: (slots) => ({ type: 'delete-phrase', phrase: text(slots) }),
  },
  {
    patterns: ['bunu sil', 'bunu kaldır'],
    toCommand: () => ({ type: 'delete-that' }),
  },
  {
    patterns: ['seçili metni sil', 'seçili kısmı sil', 'seçimi sil'],
    toCommand: () => ({ type: 'delete-selection' }),
  },
  {
    patterns: ['her şeyi sil', 'hepsini sil', 'tümünü sil', 'tüm metni sil', 'metni temizle'],
    toCommand: () => ({ type: 'delete-all' }),
  },

  // ---------------------------------------------------------------- Düzeltme ve biçim
  {
    patterns: ['{text} yerine {text2} yaz'],
    toCommand: (slots) => ({ type: 'replace', from: text(slots), to: text2(slots) }),
  },
  {
    patterns: ['yeni satır', 'alt satıra geç'],
    toCommand: () => ({ type: 'insert-break', kind: 'line' }),
  },
  {
    patterns: ['yeni paragraf'],
    toCommand: () => ({ type: 'insert-break', kind: 'paragraph' }),
  },
  { patterns: ['nokta [koy]'], toCommand: () => ({ type: 'insert-mark', mark: '.' }) },
  { patterns: ['virgül [koy]'], toCommand: () => ({ type: 'insert-mark', mark: ',' }) },
  { patterns: ['soru işareti [koy]'], toCommand: () => ({ type: 'insert-mark', mark: '?' }) },
  { patterns: ['ünlem [işareti] [koy]'], toCommand: () => ({ type: 'insert-mark', mark: '!' }) },
  { patterns: ['iki nokta [koy]'], toCommand: () => ({ type: 'insert-mark', mark: ':' }) },
  { patterns: ['noktalı virgül [koy]'], toCommand: () => ({ type: 'insert-mark', mark: ';' }) },
  { patterns: ['tire [koy]', 'kısa çizgi [koy]'], toCommand: () => ({ type: 'insert-mark', mark: '-' }) },
  { patterns: ['tırnak aç'], toCommand: () => ({ type: 'insert-mark', mark: '“' }) },
  { patterns: ['tırnak kapat'], toCommand: () => ({ type: 'insert-mark', mark: '”' }) },
  { patterns: ['parantez aç'], toCommand: () => ({ type: 'insert-mark', mark: '(' }) },
  { patterns: ['parantez kapat'], toCommand: () => ({ type: 'insert-mark', mark: ')' }) },
  {
    patterns: [
      '{text} kelimesini büyük harfle yaz',
      '{text} kelimelerini büyük harfle yaz',
      '{text} ifadesini büyük harfle yaz',
      '{text} kelimesini büyük harflerle yaz',
      '{text} kelimelerini büyük harflerle yaz',
      '{text} ifadesini büyük harflerle yaz',
    ],
    toCommand: (slots) => ({ type: 'set-case', phrase: text(slots), to: 'upper' }),
  },
  {
    patterns: [
      '{text} kelimesini küçük harfle yaz',
      '{text} kelimelerini küçük harfle yaz',
      '{text} ifadesini küçük harfle yaz',
      '{text} kelimesini küçük harflerle yaz',
      '{text} kelimelerini küçük harflerle yaz',
      '{text} ifadesini küçük harflerle yaz',
    ],
    toCommand: (slots) => ({ type: 'set-case', phrase: text(slots), to: 'lower' }),
  },
  {
    patterns: ['bunu büyük harfle yaz', 'bunu büyük harflerle yaz'],
    toCommand: () => ({ type: 'set-case', phrase: null, to: 'upper' }),
  },
  {
    patterns: ['bunu küçük harfle yaz', 'bunu küçük harflerle yaz'],
    toCommand: () => ({ type: 'set-case', phrase: null, to: 'lower' }),
  },
  {
    patterns: [
      '{text} kelimesini tırnak içine al',
      '{text} kelimelerini tırnak içine al',
      '{text} ifadesini tırnak içine al',
    ],
    toCommand: (slots) => ({ type: 'wrap', phrase: text(slots), marks: 'quotes' }),
  },
  {
    patterns: [
      '{text} kelimesini parantez içine al',
      '{text} kelimelerini parantez içine al',
      '{text} ifadesini parantez içine al',
    ],
    toCommand: (slots) => ({ type: 'wrap', phrase: text(slots), marks: 'parentheses' }),
  },
  {
    patterns: ['bunu tırnak içine al'],
    toCommand: () => ({ type: 'wrap', phrase: null, marks: 'quotes' }),
  },
  {
    patterns: ['bunu parantez içine al'],
    toCommand: () => ({ type: 'wrap', phrase: null, marks: 'parentheses' }),
  },
  {
    patterns: [
      '[buraya] {count?} [tane] boş madde ekle',
      '[buraya] {count?} [tane] madde ekle',
      '[buraya] {count?} [tane] boş maddeler ekle',
      '[buraya] {count?} [tane] maddeler ekle',
    ],
    toCommand: (slots) => ({ type: 'add-bullets', count: count(slots) }),
  },

  // ---------------------------------------------------------------- Gezinme
  {
    patterns: ['{ordinal} satıra git', '{ordinal} satıra geç'],
    toCommand: (slots) => ({ type: 'go-to-line', line: ordinal(slots) }),
  },
  {
    patterns: ['{ordinal} paragrafa git', '{ordinal} paragrafa geç'],
    toCommand: (slots) => ({ type: 'go-to-paragraph', paragraph: ordinal(slots) }),
  },
  {
    patterns: ['cümlenin başına git', 'cümle başına git'],
    toCommand: () => ({ type: 'go-to-sentence-edge', edge: 'start' }),
  },
  {
    patterns: ['cümlenin sonuna git', 'cümle sonuna git'],
    toCommand: () => ({ type: 'go-to-sentence-edge', edge: 'end' }),
  },
  {
    patterns: ['[en] başa git', 'metnin başına git'],
    toCommand: () => ({ type: 'go-to-edge', edge: 'start' }),
  },
  {
    patterns: ['[en] sona git', 'metnin sonuna git'],
    toCommand: () => ({ type: 'go-to-edge', edge: 'end' }),
  },
  {
    patterns: ['sonraki maddeye geç', 'sonraki maddeye git', 'sonraki madde'],
    toCommand: () => ({ type: 'go-to-bullet', direction: 'next' }),
  },
  {
    patterns: ['önceki maddeye geç', 'önceki maddeye git', 'önceki madde'],
    toCommand: () => ({ type: 'go-to-bullet', direction: 'previous' }),
  },
  {
    patterns: ['{text} kelimesinden sonra yaz', '{text} kelimesinden sonrasına yaz'],
    toCommand: (slots) => ({ type: 'go-to-phrase', phrase: text(slots), side: 'after' }),
  },
  {
    patterns: ['{text} kelimesinden önce yaz', '{text} kelimesinden öncesine yaz'],
    toCommand: (slots) => ({ type: 'go-to-phrase', phrase: text(slots), side: 'before' }),
  },

  // ---------------------------------------------------------------- Seçme
  {
    patterns: ['{ordinal} cümleyi seç'],
    toCommand: (slots) => ({ type: 'select-sentence', which: ordinal(slots) }),
  },
  {
    patterns: ['{ordinal} paragrafı seç'],
    toCommand: (slots) => ({ type: 'select-paragraph', which: ordinal(slots) }),
  },
  {
    patterns: ['{text} kelimesinden {text2} kelimesine kadar seç'],
    toCommand: (slots) => ({ type: 'select-between', from: text(slots), to: text2(slots) }),
  },
  {
    patterns: ['{text} kelimesini seç', '{text} kelimelerini seç', '{text} ifadesini seç'],
    toCommand: (slots) => ({ type: 'select-phrase', phrase: text(slots) }),
  },
  {
    patterns: ['son {count?} kelimeyi seç'],
    toCommand: (slots) => ({ type: 'select-words', count: count(slots) }),
  },
  { patterns: ['bunu seç'], toCommand: () => ({ type: 'select-that' }) },
  {
    patterns: ['her şeyi seç', 'hepsini seç', 'tümünü seç', 'tüm metni seç'],
    toCommand: () => ({ type: 'select-all' }),
  },
  {
    patterns: ['seçimi kaldır', 'seçimi iptal et', 'seçimi bırak'],
    toCommand: () => ({ type: 'clear-selection' }),
  },

  // ---------------------------------------------------------------- Genel
  { patterns: [...UNDO_VERBS, 'geri alın'], toCommand: () => ({ type: 'undo' }) },
  { patterns: REDO_VERBS, toCommand: () => ({ type: 'redo' }) },
  { patterns: repeated(UNDO_VERBS), toCommand: (slots) => ({ type: 'undo', count: count(slots) }) },
  { patterns: repeated(REDO_VERBS), toCommand: (slots) => ({ type: 'redo', count: count(slots) }) },
  {
    patterns: ['dinlemeyi durdur', 'dinlemeyi bitir', 'mikrofonu kapat'],
    toCommand: () => ({ type: 'stop-listening' }),
  },
  {
    patterns: ['duraklat', 'dinlemeyi duraklat', 'bekle'],
    toCommand: () => ({ type: 'pause-listening' }),
  },
  {
    patterns: ['devam et', 'devam', 'dinlemeye devam et'],
    toCommand: () => ({ type: 'resume-listening' }),
  },
  {
    patterns: ['metni kopyala', 'hepsini kopyala', 'tüm metni kopyala'],
    toCommand: () => ({ type: 'copy', target: 'all' }),
  },
  {
    patterns: ['kopyala', 'bunu kopyala', 'seçili metni kopyala'],
    toCommand: () => ({ type: 'copy', target: 'selection' }),
  },
  {
    patterns: ['komutları göster', 'yardım'],
    toCommand: () => ({ type: 'show-help' }),
  },
]
