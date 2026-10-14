import { describe, expect, it } from 'vitest'
import { toLowerTr } from './text.ts'

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
