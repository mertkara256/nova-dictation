import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage.ts'
import { checkVocabulary, loadVocabulary, saveVocabulary } from './vocabularySetting.ts'

describe('checkVocabulary', () => {
  it('virgülle ya da alt alta yazılmış kelimeleri ayırır ve sadeleştirir', () => {
    expect(checkVocabulary('Ayşe Hanım,  Kubernetes\n\n  Nova   Dictation ,')).toEqual({
      ok: true,
      words: ['Ayşe Hanım', 'Kubernetes', 'Nova Dictation'],
    })
  })

  it('büyük/küçük harf farkı gözetmeden tekrarları atar', () => {
    expect(checkVocabulary('İzmir, izmir, IZMIR')).toEqual({ ok: true, words: ['İzmir', 'IZMIR'] })
  })

  it('boş girdiyi boş liste sayar', () => {
    expect(checkVocabulary(' , \n ')).toEqual({ ok: true, words: [] })
  })

  it('çok uzun listeyi reddeder', () => {
    const input = Array.from({ length: 51 }, (_, i) => `kelime${i}`).join(', ')
    expect(checkVocabulary(input)).toMatchObject({ ok: false })
  })
})

describe('özel kelimelerin saklanması', () => {
  it('kaydedilen listeyi geri okur, boş liste kaydı siler', () => {
    const storage = memoryStorage()
    saveVocabulary(['Ayşe Hanım', 'Kubernetes'], storage)
    expect(loadVocabulary(storage)).toEqual(['Ayşe Hanım', 'Kubernetes'])
    saveVocabulary([], storage)
    expect(storage.length).toBe(0)
    expect(loadVocabulary(storage)).toEqual([])
  })
})
