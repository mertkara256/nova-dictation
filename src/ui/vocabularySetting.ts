import { useState } from 'react'
import { toLowerTr } from '../core/text.ts'
import { browserStorage, readStored, writeStored } from './storage.ts'

const STORAGE_KEY = 'nova-dictation:vocabulary'
/** Whisper'ın ipucu metni kısa tutulur; uzun listeler hem sığmaz hem etkisini yitirir. */
export const MAX_VOCABULARY_ENTRIES = 50

export type VocabularyCheck = { ok: true; words: string[] } | { ok: false; error: string }

/**
 * Kullanıcının yazdığı listeyi ayırır: virgülle ya da alt alta yazılmış
 * kelime ve ifadeler, fazla boşlukları atılmış ve büyük/küçük harf farkı
 * gözetmeden tekrarları çıkarılmış olarak döner.
 */
export function checkVocabulary(input: string): VocabularyCheck {
  const words: string[] = []
  const seen = new Set<string>()
  for (const part of input.split(/[,\n]/)) {
    const word = part.trim().replace(/\s+/g, ' ')
    if (!word || seen.has(toLowerTr(word))) continue
    seen.add(toLowerTr(word))
    words.push(word)
  }
  if (words.length > MAX_VOCABULARY_ENTRIES) {
    return { ok: false, error: `En fazla ${MAX_VOCABULARY_ENTRIES} kelime ya da ifade yazılabilir.` }
  }
  return { ok: true, words }
}

/** Kayıtlı özel kelimeleri okur. */
export function loadVocabulary(storage = browserStorage()): string[] {
  const check = checkVocabulary(readStored(STORAGE_KEY, storage) ?? '')
  return check.ok ? check.words : []
}

/** Özel kelimeleri kaydeder; liste boşsa kaydı siler. */
export function saveVocabulary(words: string[], storage = browserStorage()) {
  writeStored(STORAGE_KEY, words.join('\n'), storage)
}

/** Kullanıcının özel kelimeleri ve onları değiştirip kaydeden fonksiyon. */
export function useVocabulary() {
  const [vocabulary, setVocabulary] = useState(() => loadVocabulary())

  function changeVocabulary(words: string[]) {
    setVocabulary(words)
    saveVocabulary(words)
  }

  return [vocabulary, changeVocabulary] as const
}
