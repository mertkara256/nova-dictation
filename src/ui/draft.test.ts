import { describe, expect, it } from 'vitest'
import { loadDraft, saveDraft } from './draft.ts'

/** Tarayıcı hafızasının bellekte çalışan sahtesi. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

describe('taslak kaydı', () => {
  it('kaydedilen taslağı geri okur', () => {
    const storage = memoryStorage()
    saveDraft('Toplantı yarın.', storage)
    expect(loadDraft(storage)).toBe('Toplantı yarın.')
  })

  it('boş metin kaydedilince kaydı siler', () => {
    const storage = memoryStorage()
    saveDraft('Bir şey', storage)
    saveDraft('', storage)
    expect(storage.length).toBe(0)
    expect(loadDraft(storage)).toBe('')
  })

  it('hafıza kullanılamıyorsa hata vermez', () => {
    const broken = {
      getItem: () => {
        throw new Error('erişim yok')
      },
      setItem: () => {
        throw new Error('dolu')
      },
    } as unknown as Storage
    expect(loadDraft(broken)).toBe('')
    expect(() => saveDraft('metin', broken)).not.toThrow()
    expect(loadDraft(null)).toBe('')
  })
})
