import { shorten } from './feedbackMessages.ts'
import { browserStorage, readStored, writeStored } from './storage.ts'

export interface Note {
  id: string
  text: string
  /** Metnin son değiştiği an. */
  updatedAt: number
}

export interface Notes {
  /** Açık notun kimliği. */
  current: string
  list: Note[]
}

// Bütün notlar tek kayıtta durur; açık not ve metinler birlikte, yarım kalmadan yazılır.
const NOTES_KEY = 'nova-dictation:notes'
// Notlardan önce tek taslak burada tutuluyordu; ilk açılışta ilk not olur, kendisi silinmez.
const OLD_DRAFT_KEY = 'nova-dictation:draft'
// Henüz kaydedilmemiş ilk notun kimliği; kayıt yazılana kadar her okumada aynı kalsın.
const FIRST_NOTE_ID = 'first'

/** Kayıtlı notları okur. Hiç not yoksa eski taslaktan (o da yoksa boş) bir not açar. */
export function loadNotes(storage = browserStorage()): Notes {
  const stored = parseNotes(readStored(NOTES_KEY, storage))
  if (stored) return stored
  const text = readStored(OLD_DRAFT_KEY, storage) ?? ''
  return { current: FIRST_NOTE_ID, list: [{ id: FIRST_NOTE_ID, text, updatedAt: Date.now() }] }
}

export function saveNotes(notes: Notes, storage = browserStorage()): boolean {
  return writeStored(NOTES_KEY, JSON.stringify(notes), storage)
}

export function currentNote(notes: Notes): Note {
  return notes.list.find((note) => note.id === notes.current) ?? notes.list[0]
}

/** Açık notun metnini değiştirir; metin gerçekten değiştiyse zamanını da günceller. */
export function setCurrentText(notes: Notes, text: string, now = Date.now()): Notes {
  return {
    ...notes,
    list: notes.list.map((note) =>
      note.id === notes.current && note.text !== text ? { ...note, text, updatedAt: now } : note,
    ),
  }
}

/** Başka bir notu açar. `dropCurrent` ise bırakılan not listeden çıkar (ör. hiç yazılmamış boş not). */
export function openNote(notes: Notes, id: string, dropCurrent = false): Notes {
  if (id === notes.current) return notes
  const list = dropCurrent ? notes.list.filter((note) => note.id !== notes.current) : notes.list
  return { current: id, list }
}

/** Yeni, boş bir not açar. */
export function addNote(notes: Notes, now = Date.now()): Notes {
  const note: Note = { id: crypto.randomUUID(), text: '', updatedAt: now }
  return { current: note.id, list: [...notes.list, note] }
}

/** Notu siler. Açık not silinirse en son değişen diğer not açılır; hiç not kalmazsa boş bir not. */
export function deleteNote(notes: Notes, id: string, now = Date.now()): Notes {
  const list = notes.list.filter((note) => note.id !== id)
  if (list.length === 0) return addNote({ current: '', list }, now)
  if (id !== notes.current) return { ...notes, list }
  return { current: byRecent(list)[0].id, list }
}

/** En son değişen önde. */
export function byRecent(list: Note[]): Note[] {
  return list.toSorted((a, b) => b.updatedAt - a.updatedAt)
}

/** Listede görünen ad: notun ilk dolu satırı; not boşsa "Boş not". */
export function noteTitle(text: string): string {
  const line = text.split('\n').map((part) => part.trim()).find(Boolean)
  return line ? shorten(line, 48) : 'Boş not'
}

function parseNotes(json: string | null): Notes | null {
  if (!json) return null
  try {
    const { current, list } = JSON.parse(json) as Partial<Notes>
    const notes = Array.isArray(list) ? list.filter(isNote) : []
    if (notes.length === 0) return null
    const found = notes.find((note) => note.id === current)
    return { current: (found ?? byRecent(notes)[0]).id, list: notes }
  } catch {
    return null
  }
}

function isNote(value: unknown): value is Note {
  const note = value as Note | null
  return typeof note?.id === 'string' && typeof note.text === 'string' && typeof note.updatedAt === 'number'
}
