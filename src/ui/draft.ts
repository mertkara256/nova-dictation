import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'nova-dictation:draft'
const SAVE_DELAY_MS = 400

/** Kayıtlı taslağı okur; tarayıcı hafızası kullanılamıyorsa boş döner. */
export function loadDraft(storage: Storage | null = browserStorage()): string {
  try {
    return storage?.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Taslağı kaydeder; metin boşsa kaydı siler. */
export function saveDraft(text: string, storage: Storage | null = browserStorage()) {
  try {
    if (text) storage?.setItem(STORAGE_KEY, text)
    else storage?.removeItem(STORAGE_KEY)
  } catch {
    // Hafıza doluysa ya da gizli pencerede kapalıysa taslak kaydedilmez.
  }
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

function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
