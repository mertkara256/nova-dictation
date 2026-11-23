import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { currentNote, loadNotes, saveNotes, setNoteText } from './notes.ts'
import { browserStorage, readStored, writeStored } from './storage.ts'

// Metin tamamen silindiğinde son hali ve ait olduğu not; geri alma geçmişi sayfa yenilenince
// kaybolur. Eskiden yalnızca metin saklanıyordu; o kopyaların notu bilinmez.
const CLEARED_KEY = 'nova-dictation:cleared-draft'
const SAVE_DELAY_MS = 400

/** Açık notun kayıtlı metnini okur; tarayıcı hafızası kullanılamıyorsa boş döner. */
export function loadDraft(storage = browserStorage()): string {
  return currentNote(loadNotes(storage)).text
}

export interface ClearedDraft {
  text: string
  /** Metnin silindiği not; eski biçimdeki kopyalarda bilinmez. */
  noteId?: string
}

/**
 * Bu sekmede açık notun metnini kaydeder. Metin boşalırsa, silinmeden hemen önce ekranda
 * görünen metin (`shown`) notun kimliğiyle birlikte geri getirmek için saklanır. Not,
 * kayıttaki açık nota göre değil kimliğiyle bulunur: başka bir sekme başka bir not açmış olabilir.
 */
export function saveDraft(text: string, noteId: string, shown = '', storage = browserStorage()) {
  const notes = loadNotes(storage)
  // Kurtarma kopyası yazılamazsa son kayıtlı metni silme.
  const copy = JSON.stringify({ text: shown, noteId } satisfies ClearedDraft)
  if (!text && shown && !writeStored(CLEARED_KEY, copy, storage)) return false
  return saveNotes(setNoteText(notes, noteId, text), storage)
}

/** Tamamen silinmiş son metni okur; yoksa null döner. */
export function loadClearedDraft(storage = browserStorage()): ClearedDraft | null {
  const stored = readStored(CLEARED_KEY, storage)
  if (!stored) return null
  try {
    const { text, noteId } = JSON.parse(stored) as Partial<ClearedDraft>
    if (typeof text === 'string' && typeof noteId === 'string') return { text, noteId }
  } catch {
    // Eski biçim: yalnızca metin.
  }
  return { text: stored }
}

/** Saklanan silinmiş metni unutur (ör. geri getirildikten sonra). */
export function forgetClearedDraft(storage = browserStorage()) {
  writeStored(CLEARED_KEY, '', storage)
}

/**
 * Metni yazıldıkça `save` ile kaydeder. Her tuşta değil, yazma kısa bir süre durunca
 * kaydeder; sayfa kapanırken de son hali kaydedilir.
 */
export function useDraftAutosave(text: string, save: (text: string) => boolean) {
  const latest = useRef({ text, save })
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  useLayoutEffect(() => { latest.current = { text, save } }, [text, save])

  const retry = useCallback(() => {
    const { text, save } = latest.current
    setResult({ text, ok: save(text) })
  }, [])

  useEffect(() => {
    const timer = setTimeout(retry, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, retry])

  useEffect(() => {
    const saveNow = () => latest.current.save(latest.current.text)
    window.addEventListener('pagehide', saveNow)
    return () => window.removeEventListener('pagehide', saveNow)
  }, [])

  // Son deneme başarısızsa, yeni metin kaydedilene kadar hata gösterilmeye devam eder.
  const status = result?.ok === false ? 'failed' : result?.text !== text ? 'saving' : 'saved'
  return { status, retry } as const
}
