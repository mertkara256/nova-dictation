import { describe, expect, it } from 'vitest'
import { allowedErrors, editDistance } from './fuzzy.ts'

describe('editDistance', () => {
  it('eş metinlerde sıfırdır', () => {
    expect(editDistance('sil', 'sil')).toBe(0)
  })

  it('eklenen, silinen ve değişen harfleri sayar', () => {
    expect(editDistance('soncümleisi', 'soncümleyisil')).toBe(2)
    expect(editDistance('magda', 'madde')).toBe(2)
    expect(editDistance('', 'abc')).toBe(3)
  })
})

describe('allowedErrors', () => {
  it('uzun ifadelerde daha çok hataya izin verir', () => {
    expect(allowedErrors('soncümleyisil')).toBe(2)
    expect(allowedErrors('gerial')).toBe(1)
    expect(allowedErrors('sil')).toBe(0)
  })
})
