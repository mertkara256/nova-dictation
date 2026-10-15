import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import { loadDraft, saveDraft } from './draft.ts'

describe('taslak kaydı', () => {
  it('kaydedilen taslağı geri okur', () => {
    const storage = memoryStorage()
    saveDraft('Toplantı yarın.', storage)
    expect(loadDraft(storage)).toBe('Toplantı yarın.')
  })

  it('boş metin kaydedilince kaydı siler', () => {
    const storage = memoryStorage()
    saveDraft('Bir şey', storage)
    saveDraft('', storage)
    expect(storage.length).toBe(0)
    expect(loadDraft(storage)).toBe('')
  })

  it('hafıza kullanılamıyorsa hata vermez', () => {
    const broken = {
      getItem: () => {
        throw new Error('erişim yok')
      },
      setItem: () => {
        throw new Error('dolu')
      },
    } as unknown as Storage
    expect(loadDraft(broken)).toBe('')
    expect(() => saveDraft('metin', broken)).not.toThrow()
    expect(loadDraft(null)).toBe('')
  })
})
