import { useEffect, useRef } from 'react'
import { browserStorage, readStored, writeStored } from './storage.ts'

const STORAGE_KEY = 'nova-dictation:draft'
// Metin tamamen silindiğinde son hali; geri alma geçmişi sayfa yenilenince kaybolur.
const CLEARED_KEY = 'nova-dictation:cleared-draft'
const SAVE_DELAY_MS = 400

/** Kayıtlı taslağı okur; tarayıcı hafızası kullanılamıyorsa boş döner. */
export function loadDraft(storage = browserStorage()): string {
  return readStored(STORAGE_KEY, storage) ?? ''
}

/** Taslağı kaydeder; metin boşsa kaydı siler ve son halini geri getirmek için saklar. */
export function saveDraft(text: string, storage = browserStorage()) {
  const previous = readStored(STORAGE_KEY, storage)
  if (!text && previous) writeStored(CLEARED_KEY, previous, storage)
  writeStored(STORAGE_KEY, text, storage)
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

  useEffect(() => {
    latest.current = text
    const timer = setTimeout(() => saveDraft(text), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    const saveNow = () => saveDraft(latest.current)
    window.addEventListener('pagehide', saveNow)
    return () => window.removeEventListener('pagehide', saveNow)
  }, [])
}
