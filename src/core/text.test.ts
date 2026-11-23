import { describe, expect, it } from 'vitest'
import { capitalizeTr, capitalizeWords, countWords, findLastWithSuffix, findPhrases, toLowerTr } from './text.ts'

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

  it('metinde ayrışmış "İ" (I + U+0307) olsa da kelimeleri doğru konumda bulur', () => {
    const text = 'I\u0307stanbul toplantısı yarın.'
    expect(findPhrases(text, 'yarın')).toEqual([{ start: 21, end: 26 }])
    expect(findPhrases(text, 'İstanbul')).toEqual([{ start: 0, end: 9 }])
    expect(findPhrases(text, 'istanbul')).toEqual([{ start: 0, end: 9 }])
  })

  it('aranan ifade ayrışmış, metin birleşik olduğunda da bulur', () => {
    expect(findPhrases("İstanbul'a gidiyorum.", 'I\u0307stanbul')).toEqual([{ start: 0, end: 8 }])
  })

  it('harfi ardındaki birleşik işaretten ayırarak eşleştirmez', () => {
    expect(findPhrases('cafe\u0301 açık', 'cafe')).toEqual([])
  })
})

describe('findLastWithSuffix', () => {
  const found = (text: string, phrase: string) => {
    const range = findLastWithSuffix(text, phrase)
    return range && text.slice(range.start, range.end)
  }

  it('ifadenin son geçtiği yeri, kesme işaretiyle eklenmiş ekiyle birlikte bulur', () => {
    expect(found('Ankara güzel. Ankara\'ya gidiyorum.', 'ankara')).toBe("Ankara'ya")
  })

  it('birebir yoksa bitişik ek almış halini bulur', () => {
    expect(found('Raporu yarın gönder.', 'rapor')).toBe('Raporu')
    expect(found('Raporlarımızdan biri eksik, raporda da hata var.', 'rapor')).toBe('raporda')
    expect(found('Ayşe Hanımı aradım.', 'ayşe hanım')).toBe('Ayşe Hanımı')
  })

  it('yalnızca gerçek çekim eklerini kabul eder; başka kelimeyi bulmaz', () => {
    expect(found('Güneş doğdu.', 'gün')).toBeNull()
    expect(found('Güneye gittik.', 'gün')).toBeNull()
    expect(found('Raporlarımızdan biri.', 'rapor')).toBe('Raporlarımızdan')
    expect(found('Raporunu yarın gönder.', 'raporu')).toBe('Raporunu')
    expect(found("Rapor'u yarın gönder.", 'rapor')).toBe("Rapor'u")
    expect(found('Günler geçti, güne bak.', 'gün')).toBe('güne')
    expect(found('Kitapta yazıyor.', 'kitap')).toBe('Kitapta')
    expect(found('Arabasından indi.', 'araba')).toBe('Arabasından')
  })

  it('bulunma ekinden sonra gelen "-ki" ekini de kabul eder', () => {
    expect(found('Toplantıdaki karar.', 'toplantı')).toBe('Toplantıdaki')
    expect(found('Raporundaki hata.', 'rapor')).toBe('Raporundaki')
    expect(found('Sepetteki elmalar.', 'sepet')).toBe('Sepetteki')
  })

  it('birebir geçen yeri ek almış halinden önce tercih eder', () => {
    expect(found('Rapor hazır, raporu yarın gönder.', 'rapor')).toBe('Rapor')
  })

  it('kelimenin ortasında ya da üç harften kısa ifadede ek almış hal aramaz', () => {
    expect(found('Kahvaltı hazır.', 'altı')).toBeNull()
    expect(found('Evet, geliyorum.', 'ev')).toBeNull()
  })

  it('metinde ayrışmış "İ" olsa da eki ve konumu doğru bulur', () => {
    expect(found("I\u0307zmir'e gittim. Raporu yarın gönder.", 'rapor')).toBe('Raporu')
    expect(found("Toplantı I\u0307zmir'de.", 'izmir')).toBe("I\u0307zmir'de")
    expect(found('Toplantı I\u0307zmirde.', 'izmir')).toBe('I\u0307zmirde')
  })
})

describe('countWords', () => {
  it('kelimeleri sayar; madde işaretlerini ve noktalamayı saymaz', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('Toplantı yarın saat 10’da.')).toBe(4)
    expect(countWords("Gündem:\n- Bütçe\n- Ahmet'in raporu\n- ")).toBe(4)
  })
})
