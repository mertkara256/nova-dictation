import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  // Kurtarma kopyası yazılamazsa son kayıtlı taslağı silme.
  if (!text && previous && !writeStored(CLEARED_KEY, previous, storage)) return false
  return writeStored(STORAGE_KEY, text, storage)
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

  const status = result?.text !== text ? 'saving' : result.ok ? 'saved' : 'failed'
  return { status, retry } as const
}
