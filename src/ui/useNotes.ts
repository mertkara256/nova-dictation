import { type Dispatch, useRef, useState } from 'react'
import { type EditorAction, type EditorState, initialEditorState } from '../core/editor.ts'
import { saveDraft } from './draft.ts'
import { type Notes, addNote, currentNote, deleteNote, loadNotes, openNote, saveNotes } from './notes.ts'

/**
 * Notlar arasında geçiş. Açık notun son hali geçişten önce kaydedilir. Her not bu
 * oturumda kendi geri alma geçmişini korur: başka bir nottan dönünce "geri al" yine
 * o notta çalışır, bir notta yapılanı başka bir nota taşımaz.
 */
export function useNotes(editor: EditorState, dispatch: Dispatch<EditorAction>) {
  // Paneldeki liste için son okunan hal; değişiklikler her seferinde kayıttan okunarak yapılır.
  const [notes, setNotes] = useState(loadNotes)
  // Bu sekmede açık olan not. Kayıttaki açık not, başka bir sekmede başka bir not açılınca
  // değişir; bu sekme yine kendi notuna yazar.
  const [openId, setOpenId] = useState(notes.current)
  // Bu oturumda açılıp bırakılan notların editör durumu.
  const sessions = useRef(new Map<string, EditorState>())

  function change(update: (notes: Notes) => Notes) {
    // Açık notun son hali kaydedilemezse geçiş yapılmaz; yazılanlar kaybolmasın.
    if (!saveDraft(editor.text, openId)) return
    const before = { ...loadNotes(), current: openId }
    const after = update(before)
    if (!saveNotes(after)) return

    if (after.current !== openId) sessions.current.set(openId, editor)
    for (const id of sessions.current.keys()) {
      if (!after.list.some((note) => note.id === id)) sessions.current.delete(id)
    }
    if (after.current !== openId) {
      const note = currentNote(after)
      dispatch({ type: 'load', state: sessions.current.get(note.id) ?? { ...initialEditorState, text: note.text } })
    }
    setOpenId(after.current)
    setNotes(after)
  }

  // İçine hiç yazılmamış boş not, başka bir nota geçilince listeden çıkar.
  const untouched = !editor.text && editor.past.length === 0

  return {
    /** Açık not, bu sekmede açık olandır. */
    notes: { ...notes, current: openId },
    openId,
    /** Listeyi kayıttan yeniden okur (ör. panel açılırken). */
    refresh: () => setNotes(loadNotes()),
    open: (id: string) => change((current) => openNote(current, id, untouched)),
    create: () => change(addNote),
    remove: (id: string) => change((current) => deleteNote(current, id)),
  }
}
