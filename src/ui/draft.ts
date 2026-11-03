import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { currentNote, loadNotes, saveNotes, setCurrentText } from './notes.ts'
import { browserStorage, readStored, writeStored } from './storage.ts'

// Metin tamamen silindiğinde son hali; geri alma geçmişi sayfa yenilenince kaybolur.
const CLEARED_KEY = 'nova-dictation:cleared-draft'
const SAVE_DELAY_MS = 400

/** Açık notun kayıtlı metnini okur; tarayıcı hafızası kullanılamıyorsa boş döner. */
export function loadDraft(storage = browserStorage()): string {
  return currentNote(loadNotes(storage)).text
}

/** Açık notun metnini kaydeder; metin boşalırsa son halini geri getirmek için saklar. */
export function saveDraft(text: string, storage = browserStorage()) {
  const notes = loadNotes(storage)
  const previous = currentNote(notes).text
  // Kurtarma kopyası yazılamazsa son kayıtlı metni silme.
  if (!text && previous && !writeStored(CLEARED_KEY, previous, storage)) return false
  return saveNotes(setCurrentText(notes, text), storage)
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
export function useDraftAutosave(text: string) {
  const latest = useRef(text)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  useLayoutEffect(() => { latest.current = text }, [text])

  const retry = useCallback(() => {
    const value = latest.current
    setResult({ text: value, ok: saveDraft(value) })
  }, [])

  useEffect(() => {
    const timer = setTimeout(retry, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, retry])

  useEffect(() => {
    const saveNow = () => saveDraft(latest.current)
    window.addEventListener('pagehide', saveNow)
    return () => window.removeEventListener('pagehide', saveNow)
  }, [])

  // Son deneme başarısızsa, yeni metin kaydedilene kadar hata gösterilmeye devam eder.
  const status = result?.ok === false ? 'failed' : result?.text !== text ? 'saving' : 'saved'
  return { status, retry } as const
}
