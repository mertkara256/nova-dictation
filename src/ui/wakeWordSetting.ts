import { useState } from 'react'
import { DEFAULT_WAKE_WORD, checkWakeWord } from '../commands/wakeWord.ts'
import { browserStorage, readStored, writeStored } from './storage.ts'

const STORAGE_KEY = 'nova-dictation:wake-word'

/** Kayıtlı komut kelimesini okur; kayıt yoksa ya da geçersizse varsayılanı döner. */
export function loadWakeWord(storage = browserStorage()): string {
  const check = checkWakeWord(readStored(STORAGE_KEY, storage) ?? '')
  return check.ok ? check.word : DEFAULT_WAKE_WORD
}

/** Komut kelimesini kaydeder; varsayılana dönülünce kaydı siler. */
export function saveWakeWord(word: string, storage = browserStorage()) {
  writeStored(STORAGE_KEY, word === DEFAULT_WAKE_WORD ? '' : word, storage)
}

/** Kullanıcının seçtiği komut kelimesi ve onu değiştirip kaydeden fonksiyon. */
export function useWakeWord() {
  const [wakeWord, setWakeWord] = useState(() => loadWakeWord())

  function changeWakeWord(word: string) {
    setWakeWord(word)
    saveWakeWord(word)
  }

  return [wakeWord, changeWakeWord] as const
}
