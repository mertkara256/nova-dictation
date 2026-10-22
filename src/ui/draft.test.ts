import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import { forgetClearedDraft, loadClearedDraft, loadDraft, saveDraft } from './draft.ts'

describe('taslak kaydı', () => {
  it('kaydedilen taslağı geri okur', () => {
    const storage = memoryStorage()
    saveDraft('Toplantı yarın.', storage)
    expect(loadDraft(storage)).toBe('Toplantı yarın.')
  })

  it('metin tamamen silinince taslağı siler, son halini geri getirmek için saklar', () => {
    const storage = memoryStorage()
    saveDraft('Bir şey', storage)
    saveDraft('', storage)
    expect(loadDraft(storage)).toBe('')
    expect(loadClearedDraft(storage)).toBe('Bir şey')
    // Boş metin yeniden kaydedilince saklanan silinmez.
    saveDraft('', storage)
    expect(loadClearedDraft(storage)).toBe('Bir şey')
    forgetClearedDraft(storage)
    expect(storage.length).toBe(0)
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
    expect(saveDraft('metin', null)).toBe(false)
    expect(saveDraft('metin', broken)).toBe(false)
  })

  it('kurtarma kopyası yazılamazsa önceki taslağı silmez', () => {
    const storage = memoryStorage()
    expect(saveDraft('Son kayıt.', storage)).toBe(true)
    storage.setItem = () => { throw new Error('dolu') }
    expect(saveDraft('', storage)).toBe(false)
    expect(loadDraft(storage)).toBe('Son kayıt.')
  })
})
