import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { currentNote, loadNotes, saveNotes, setNoteText } from './notes.ts'
import { browserStorage, readStored, writeStored } from './storage.ts'

// Metin tamamen silindiğinde son hali; geri alma geçmişi sayfa yenilenince kaybolur.
const CLEARED_KEY = 'nova-dictation:cleared-draft'
const SAVE_DELAY_MS = 400

/** Açık notun kayıtlı metnini okur; tarayıcı hafızası kullanılamıyorsa boş döner. */
export function loadDraft(storage = browserStorage()): string {
  return currentNote(loadNotes(storage)).text
}

/**
 * Bu sekmede açık notun metnini kaydeder; metin boşalırsa son halini geri getirmek için
 * saklar. Not, kayıttaki açık nota göre değil kimliğiyle bulunur: başka bir sekme başka
 * bir not açmış olabilir.
 */
export function saveDraft(text: string, noteId: string, storage = browserStorage()) {
  const notes = loadNotes(storage)
  const previous = notes.list.find((note) => note.id === noteId)?.text ?? ''
  // Kurtarma kopyası yazılamazsa son kayıtlı metni silme.
  if (!text && previous && !writeStored(CLEARED_KEY, previous, storage)) return false
  return saveNotes(setNoteText(notes, noteId, text), storage)
}

/** Tamamen silinmiş son metni okur; yoksa boş döner. */
export function loadClearedDraft(storage = browserStorage()): string {
  return readStored(CLEARED_KEY, storage) ?? ''
}

/** Saklanan silinmiş metni unutur (ör. geri getirildikten sonra). */
export function forgetClearedDraft(storage = browserStorage()) {
  writeStored(CLEARED_KEY, '', storage)
}

/**
 * Metni yazıldıkça tarayıcının hafızasına kaydeder. Her tuşta değil, yazma
 * kısa bir süre durunca kaydeder; sayfa kapanırken de son hali kaydedilir.
 */
export function useDraftAutosave(text: string, noteId: string) {
  const latest = useRef({ text, noteId })
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  useLayoutEffect(() => { latest.current = { text, noteId } }, [text, noteId])

  const retry = useCallback(() => {
    const { text, noteId } = latest.current
    setResult({ text, ok: saveDraft(text, noteId) })
  }, [])

  useEffect(() => {
    const timer = setTimeout(retry, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, retry])

  useEffect(() => {
    const saveNow = () => saveDraft(latest.current.text, latest.current.noteId)
    window.addEventListener('pagehide', saveNow)
    return () => window.removeEventListener('pagehide', saveNow)
  }, [])

  // Son deneme başarısızsa, yeni metin kaydedilene kadar hata gösterilmeye devam eder.
  const status = result?.ok === false ? 'failed' : result?.text !== text ? 'saving' : 'saved'
  return { status, retry } as const
}
