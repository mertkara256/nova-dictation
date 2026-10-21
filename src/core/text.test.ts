import { describe, expect, it } from 'vitest'
import { capitalizeTr, capitalizeWords, countWords, findPhrases, toLowerTr } from './text.ts'

describe('toLowerTr', () => {
  it('"İ" harfini noktalı "i" yapar', () => {
    expect(toLowerTr('İngilizceye çevir')).toBe('ingilizceye çevir')
  })

  it('"I" harfini noktasız "ı" yapar', () => {
    expect(toLowerTr('IŞIK')).toBe('ışık')
  })

  it('büyük harfli komutu eşleştirilebilir hale getirir', () => {
    expect(toLowerTr('SON CÜMLEYİ SİL')).toBe('son cümleyi sil')
  })

  it('zaten küçük olan metni değiştirmez', () => {
    expect(toLowerTr('ışık ve iğne')).toBe('ışık ve iğne')
  })
})

describe('capitalizeTr', () => {
  it('ilk harfi Türkçe kurallarına göre büyütür', () => {
    expect(capitalizeTr('istanbul')).toBe('İstanbul')
    expect(capitalizeTr('ışık')).toBe('Işık')
  })
})

describe('capitalizeWords', () => {
  it('her kelimenin ilk harfini büyütür; ekleri ve parantezi doğru ele alır', () => {
    expect(capitalizeWords("ayşe hanım'a ışık (istanbul)")).toBe("Ayşe Hanım'a Işık (İstanbul)")
  })
})

describe('findPhrases', () => {
  it('ifadenin geçtiği her yeri büyük/küçük harf gözetmeden bulur', () => {
    expect(findPhrases('Yarın toplantı var, yarın gel.', 'yarın')).toEqual([
      { start: 0, end: 5 },
      { start: 20, end: 25 },
    ])
  })

  it('yalnızca tam kelimeleri eşleştirir', () => {
    expect(findPhrases('yarınki toplantı', 'yarın')).toEqual([])
  })

  it('birden fazla kelimelik ifadeleri ve Türkçe büyük harfleri bulur', () => {
    expect(findPhrases('İstanbul Boğazı', 'istanbul boğazı')).toEqual([{ start: 0, end: 15 }])
  })
})

describe('countWords', () => {
  it('kelimeleri sayar; madde işaretlerini ve noktalamayı saymaz', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('Toplantı yarın saat 10’da.')).toBe(4)
    expect(countWords("Gündem:\n- Bütçe\n- Ahmet'in raporu\n- ")).toBe(4)
  })
})
