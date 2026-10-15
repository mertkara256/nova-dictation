import { describe, expect, it } from 'vitest'
import { lineAt, splitLines, splitParagraphs, splitSentences } from './sentences.ts'

function sentences(text: string) {
  return splitSentences(text).map(({ start, end }) => text.slice(start, end).trim())
}

describe('splitSentences', () => {
  it('metni noktalama işaretlerinden böler', () => {
    expect(sentences('Toplantı yarın. Gündem hazır mı? Evet!')).toEqual([
      'Toplantı yarın.',
      'Gündem hazır mı?',
      'Evet!',
    ])
  })

  it('sıra sayılarını, ondalıkları ve tarihleri cümle sonu saymaz', () => {
    expect(sentences('Ahmet yarışmayı 3. sırada bitirdi. Fiyat 3.5 TL, tarih 14.10.2026.')).toEqual([
      'Ahmet yarışmayı 3. sırada bitirdi.',
      'Fiyat 3.5 TL, tarih 14.10.2026.',
    ])
  })

  it('unvan kısaltmalarında bölmez', () => {
    expect(sentences('Prof. Dr. Ayşe geldi. Sonra gitti.')).toEqual([
      'Prof. Dr. Ayşe geldi.',
      'Sonra gitti.',
    ])
  })

  it('her satırı ayrı cümle sayar', () => {
    expect(sentences('Gündem:\n- Bütçe\n- Takvim')).toEqual(['Gündem:', '- Bütçe', '- Takvim'])
  })

  it('boş metinde cümle bulmaz', () => {
    expect(splitSentences('')).toEqual([])
    expect(splitSentences('   \n ')).toEqual([])
  })
})

describe('splitParagraphs', () => {
  it('boş satırlarla ayrılmış blokları paragraf sayar', () => {
    const text = 'Birinci paragraf.\nDevamı.\n\nİkinci paragraf.'
    expect(splitParagraphs(text).map(({ start, end }) => text.slice(start, end))).toEqual([
      'Birinci paragraf.\nDevamı.',
      'İkinci paragraf.',
    ])
  })
})

describe('splitLines ve lineAt', () => {
  it('boş satırlar dahil her satırı bulur', () => {
    expect(splitLines('a\n\nbc')).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 5 },
    ])
  })

  it('bir konumun hangi satırda olduğunu bulur', () => {
    expect(lineAt('a\nbc', 3)).toEqual({ start: 2, end: 4 })
    expect(lineAt('a\nbc', 1)).toEqual({ start: 0, end: 1 })
  })
})
