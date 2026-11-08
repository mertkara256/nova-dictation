import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import {
  type Notes,
  addNote,
  byRecent,
  currentNote,
  deleteNote,
  loadNotes,
  noteTitle,
  openNote,
  saveNotes,
  setNoteText,
} from './notes.ts'

const note = (id: string, text: string, updatedAt: number) => ({ id, text, updatedAt })

describe('notlar', () => {
  it('ilk açılışta eski taslağı ilk not yapar; kimliği kaydedilene kadar değişmez', () => {
    const storage = memoryStorage()
    storage.setItem('nova-dictation:draft', 'Eski taslak.')
    const first = loadNotes(storage)
    expect(currentNote(first).text).toBe('Eski taslak.')
    expect(loadNotes(storage).current).toBe(first.current)
  })

  it('kaydedilen notları ve açık notu geri okur', () => {
    const storage = memoryStorage()
    const notes: Notes = { current: 'b', list: [note('a', 'Bir.', 1), note('b', 'İki.', 2)] }
    expect(saveNotes(notes, storage)).toBe(true)
    expect(loadNotes(storage)).toEqual(notes)
  })

  it('bozuk kayıt yerine eski taslakla açılır', () => {
    const storage = memoryStorage()
    storage.setItem('nova-dictation:notes', '{bozuk')
    storage.setItem('nova-dictation:draft', 'Yedek.')
    expect(currentNote(loadNotes(storage)).text).toBe('Yedek.')
  })

  it('notun metnini kimliğiyle değiştirir; metin aynıysa zamanına dokunmaz', () => {
    const notes: Notes = { current: 'a', list: [note('a', 'Bir.', 1), note('b', 'İki.', 2)] }
    expect(setNoteText(notes, 'b', 'İki. Ek.', 5).list).toEqual([note('a', 'Bir.', 1), note('b', 'İki. Ek.', 5)])
    expect(setNoteText(notes, 'a', 'Bir.', 5)).toEqual(notes)
  })

  it('başka sekmede silinen notu, içine yazılınca geri ekler', () => {
    const notes: Notes = { current: 'a', list: [note('a', 'Bir.', 1)] }
    expect(setNoteText(notes, 'b', 'Kaybolmasın.', 5).list).toEqual([note('a', 'Bir.', 1), note('b', 'Kaybolmasın.', 5)])
    expect(setNoteText(notes, 'b', '', 5)).toEqual(notes)
  })

  it('başka bir notu açar; istenirse bırakılan notu listeden çıkarır', () => {
    const notes: Notes = { current: 'a', list: [note('a', '', 1), note('b', 'İki.', 2)] }
    expect(openNote(notes, 'b')).toEqual({ current: 'b', list: notes.list })
    expect(openNote(notes, 'b', true)).toEqual({ current: 'b', list: [note('b', 'İki.', 2)] })
    // Zaten açık olan not açılınca hiçbir şey değişmez, boş olsa bile listeden çıkmaz.
    expect(openNote(notes, 'a', true)).toBe(notes)
  })

  it('yeni not boş açılır', () => {
    const notes = addNote({ current: 'a', list: [note('a', 'Bir.', 1)] }, 9)
    expect(notes.list).toHaveLength(2)
    expect(currentNote(notes)).toMatchObject({ text: '', updatedAt: 9 })
  })

  it('notu siler; açık not silinince en son değişen diğer not, hiç not kalmazsa boş bir not açılır', () => {
    const notes: Notes = { current: 'a', list: [note('a', 'Bir.', 1), note('b', 'İki.', 3), note('c', 'Üç.', 2)] }
    expect(deleteNote(notes, 'c')).toEqual({ current: 'a', list: [note('a', 'Bir.', 1), note('b', 'İki.', 3)] })
    expect(deleteNote(notes, 'a').current).toBe('b')

    const last = deleteNote({ current: 'a', list: [note('a', 'Bir.', 1)] }, 'a', 7)
    expect(last.list).toHaveLength(1)
    expect(currentNote(last)).toMatchObject({ text: '', updatedAt: 7 })
    expect(last.current).not.toBe('a')
  })

  it('notları en son değişen önde sıralar', () => {
    expect(byRecent([note('a', '', 1), note('b', '', 3), note('c', '', 2)]).map((n) => n.id)).toEqual(['b', 'c', 'a'])
  })

  it('notun adını ilk dolu satırdan alır', () => {
    expect(noteTitle('\n  Alışveriş  \nsüt, ekmek')).toBe('Alışveriş')
    expect(noteTitle('')).toBe('Boş not')
    expect(noteTitle('Çok uzun bir başlık '.repeat(5))).toHaveLength(48)
  })
})
