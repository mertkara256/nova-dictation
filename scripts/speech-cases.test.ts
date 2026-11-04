import { describe, expect, it } from 'vitest'
import { CATEGORIES, SCAN_CASES, isAccepted } from './speech-cases.ts'

describe('ses taraması vakaları', () => {
  for (const category of Object.keys(CATEGORIES)) {
    describe(CATEGORIES[category as keyof typeof CATEGORIES], () => {
      for (const scanCase of SCAN_CASES.filter((c) => c.category === category)) {
        it(`${scanCase.key ? '⌃ ' : ''}${scanCase.id}`, () => {
          // İfadenin kendisi yazılsaydı varılacak sonuç beklenen olmalı; yoksa vaka ya da uygulama yanlış.
          const outcome = scanCase.outcome(scanCase.say)
          if (scanCase.exact) expect(outcome).toBe(scanCase.accepted[0])
          else expect(isAccepted(scanCase, outcome)).toBe(true)
          // Komut listesindeki her ifade en az bir komut olarak anlaşılmalı.
          if (scanCase.category === 'komut') expect(outcome).not.toBe('')
        })
      }
    })
  }

  it('her vakanın anahtarı tek', () => {
    const ids = SCAN_CASES.map((c) => `${c.category} ${c.key} ${c.id}`)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
