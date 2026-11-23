import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import { forgetClearedDraft, loadClearedDraft, loadDraft, saveDraft } from './draft.ts'
import { addNote, loadNotes, saveNotes } from './notes.ts'

describe('taslak kaydı', () => {
  it('kaydedilen taslağı geri okur', () => {
    const storage = memoryStorage()
    saveDraft('Toplantı yarın.', 'first', '', storage)
    expect(loadDraft(storage)).toBe('Toplantı yarın.')
  })

  it('metin tamamen silinince taslağı siler; ekranda görünen son halini notun kimliğiyle saklar', () => {
    const storage = memoryStorage()
    saveDraft('Bir şey', 'first', '', storage)
    // Silinmeden önce ekranda daha yeni bir metin vardı; henüz kaydedilmemişti.
    saveDraft('', 'first', 'Bir şey daha', storage)
    expect(loadDraft(storage)).toBe('')
    expect(loadClearedDraft(storage)).toEqual({ text: 'Bir şey daha', noteId: 'first' })
    // Görünen metin olmadan boş metin yeniden kaydedilince saklanan silinmez.
    saveDraft('', 'first', '', storage)
    expect(loadClearedDraft(storage)).toEqual({ text: 'Bir şey daha', noteId: 'first' })
    forgetClearedDraft(storage)
    expect(loadClearedDraft(storage)).toBeNull()
  })

  it('notu bilinmeyen eski biçimdeki kopyayı da okur', () => {
    const storage = memoryStorage()
    storage.setItem('nova-dictation:cleared-draft', 'Eski kopya.')
    expect(loadClearedDraft(storage)).toEqual({ text: 'Eski kopya.' })
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
    expect(() => saveDraft('metin', 'first', '', broken)).not.toThrow()
    expect(loadDraft(null)).toBe('')
    expect(saveDraft('metin', 'first', '', null)).toBe(false)
    expect(saveDraft('metin', 'first', '', broken)).toBe(false)
  })

  it('kayıttaki açık not başka bir sekmede değişse de bu sekmenin notuna yazar', () => {
    const storage = memoryStorage()
    saveDraft('Birinci sekmenin notu.', 'first', '', storage)
    // İkinci sekme yeni bir not açtı; kayıttaki açık not artık o.
    saveNotes(addNote(loadNotes(storage)), storage)
    const other = loadNotes(storage).current
    saveDraft('İkinci sekmenin notu.', other, '', storage)

    saveDraft('Birinci sekmede devam.', 'first', '', storage)
    const notes = loadNotes(storage)
    expect(notes.list.find((note) => note.id === 'first')?.text).toBe('Birinci sekmede devam.')
    expect(notes.list.find((note) => note.id === other)?.text).toBe('İkinci sekmenin notu.')
  })

  it('kurtarma kopyası yazılamazsa önceki taslağı silmez', () => {
    const storage = memoryStorage()
    expect(saveDraft('Son kayıt.', 'first', '', storage)).toBe(true)
    storage.setItem = () => { throw new Error('dolu') }
    expect(saveDraft('', 'first', 'Son kayıt.', storage)).toBe(false)
    expect(loadDraft(storage)).toBe('Son kayıt.')
  })
})
