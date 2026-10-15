import { describe, expect, it } from 'vitest'
import { caretOf, hasSelection, normalizeSelection, replaceRange } from './document.ts'

describe('normalizeSelection', () => {
  it('metnin sonundaki imleci null olarak saklar', () => {
    expect(normalizeSelection('abc', { start: 3, end: 3 })).toBeNull()
  })

  it('ters verilen seçimi düzeltir ve metne sığdırır', () => {
    expect(normalizeSelection('abc', { start: 5, end: 1 })).toEqual({ start: 1, end: 3 })
  })
})

describe('caretOf ve hasSelection', () => {
  it('imleç yoksa metnin sonunu verir', () => {
    expect(caretOf({ text: 'abc', selection: null })).toBe(3)
    expect(hasSelection({ text: 'abc', selection: { start: 1, end: 1 } })).toBe(false)
    expect(hasSelection({ text: 'abc', selection: { start: 0, end: 2 } })).toBe(true)
  })
})

describe('replaceRange', () => {
  it('değişiklikten sonraki imleci kaydırır', () => {
    const doc = replaceRange({ text: 'bir iki üç', selection: { start: 8, end: 8 } }, 0, 3, 'dört')
    expect(doc).toEqual({ text: 'dört iki üç', selection: { start: 9, end: 9 } })
  })

  it('değişiklikten önceki imlece dokunmaz', () => {
    const doc = replaceRange({ text: 'bir iki', selection: { start: 1, end: 1 } }, 4, 7, 'üç')
    expect(doc.selection).toEqual({ start: 1, end: 1 })
  })

  it('sondaki imleç sonda kalır', () => {
    expect(replaceRange({ text: 'bir', selection: null }, 0, 3, 'dört').selection).toBeNull()
  })
})
