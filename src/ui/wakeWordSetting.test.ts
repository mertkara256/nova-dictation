import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import { loadWakeWord, saveWakeWord } from './wakeWordSetting.ts'

describe('komut kelimesi ayarı', () => {
  it('kayıt yoksa "Nova" kullanılır', () => {
    expect(loadWakeWord(memoryStorage())).toBe('Nova')
    expect(loadWakeWord(null)).toBe('Nova')
  })

  it('seçilen kelimeyi kaydeder ve geri okur', () => {
    const storage = memoryStorage()
    saveWakeWord('Asistan', storage)
    expect(loadWakeWord(storage)).toBe('Asistan')
  })

  it('varsayılana dönülünce kaydı siler', () => {
    const storage = memoryStorage()
    saveWakeWord('Asistan', storage)
    saveWakeWord('Nova', storage)
    expect(storage.length).toBe(0)
  })

  it('geçersiz bir kayıt bulunursa varsayılanı kullanır', () => {
    const storage = memoryStorage()
    storage.setItem('nova-dictation:wake-word', 'hey nova')
    expect(loadWakeWord(storage)).toBe('Nova')
  })
})
