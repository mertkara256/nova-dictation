import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import { forgetClearedDraft, loadClearedDraft, loadDraft, saveDraft } from './draft.ts'
import { addNote, loadNotes, saveNotes } from './notes.ts'

describe('taslak kaydı', () => {
  it('kaydedilen taslağı geri okur', () => {
    const storage = memoryStorage()
    saveDraft('Toplantı yarın.', 'first', storage)
    expect(loadDraft(storage)).toBe('Toplantı yarın.')
  })

  it('metin tamamen silinince taslağı siler, son halini geri getirmek için saklar', () => {
    const storage = memoryStorage()
    saveDraft('Bir şey', 'first', storage)
    saveDraft('', 'first', storage)
    expect(loadDraft(storage)).toBe('')
    expect(loadClearedDraft(storage)).toBe('Bir şey')
    // Boş metin yeniden kaydedilince saklanan silinmez.
    saveDraft('', 'first', storage)
    expect(loadClearedDraft(storage)).toBe('Bir şey')
    forgetClearedDraft(storage)
    expect(loadClearedDraft(storage)).toBe('')
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
    expect(() => saveDraft('metin', 'first', broken)).not.toThrow()
    expect(loadDraft(null)).toBe('')
    expect(saveDraft('metin', 'first', null)).toBe(false)
    expect(saveDraft('metin', 'first', broken)).toBe(false)
  })

  it('kayıttaki açık not başka bir sekmede değişse de bu sekmenin notuna yazar', () => {
    const storage = memoryStorage()
    saveDraft('Birinci sekmenin notu.', 'first', storage)
    // İkinci sekme yeni bir not açtı; kayıttaki açık not artık o.
    saveNotes(addNote(loadNotes(storage)), storage)
    const other = loadNotes(storage).current
    saveDraft('İkinci sekmenin notu.', other, storage)

    saveDraft('Birinci sekmede devam.', 'first', storage)
    const notes = loadNotes(storage)
    expect(notes.list.find((note) => note.id === 'first')?.text).toBe('Birinci sekmede devam.')
    expect(notes.list.find((note) => note.id === other)?.text).toBe('İkinci sekmenin notu.')
  })

  it('kurtarma kopyası yazılamazsa önceki taslağı silmez', () => {
    const storage = memoryStorage()
    expect(saveDraft('Son kayıt.', 'first', storage)).toBe(true)
    storage.setItem = () => { throw new Error('dolu') }
    expect(saveDraft('', 'first', storage)).toBe(false)
    expect(loadDraft(storage)).toBe('Son kayıt.')
  })
})
