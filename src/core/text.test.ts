import { describe, expect, it } from 'vitest'
import { appendSegment, toLowerTr } from './text.ts'

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

describe('appendSegment', () => {
  it('boş metne parçayı olduğu gibi ekler', () => {
    expect(appendSegment('', 'merhaba')).toBe('merhaba')
  })

  it('iki parçanın arasına boşluk koyar', () => {
    expect(appendSegment('merhaba', 'dünya')).toBe('merhaba dünya')
  })

  it('metin boşluk veya satır sonuyla bitiyorsa ikinci boşluk eklemez', () => {
    expect(appendSegment('merhaba ', 'dünya')).toBe('merhaba dünya')
    expect(appendSegment('Gündem:\n', 'bütçe')).toBe('Gündem:\nbütçe')
  })

  it('parçanın başındaki ve sonundaki boşlukları atar', () => {
    expect(appendSegment('merhaba', ' dünya ')).toBe('merhaba dünya')
  })

  it('noktalama işaretinden önce boşluk koymaz', () => {
    expect(appendSegment('merhaba', '.')).toBe('merhaba.')
    expect(appendSegment('evet', ', tamam')).toBe('evet, tamam')
  })

  it('boş parçayı yok sayar', () => {
    expect(appendSegment('merhaba', '   ')).toBe('merhaba')
  })
})
