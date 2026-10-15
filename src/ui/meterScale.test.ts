import { describe, expect, it } from 'vitest'
import { levelToBar } from './meterScale.ts'

describe('levelToBar', () => {
  it('sessizlikte çizgiyi nokta olarak bırakır', () => {
    expect(levelToBar(0)).toBe(0)
    expect(levelToBar(0.001)).toBe(0)
  })

  it('çok yüksek seste çizgiyi neredeyse tam boyuna uzatır', () => {
    expect(levelToBar(0.5)).toBeGreaterThan(0.95)
    expect(levelToBar(1)).toBe(1)
  })

  it('normal konuşmada çizgiyi yarı boya yakın, alçak sesle konuşmada kısa uzatır', () => {
    // -26 dBFS civarı normal, -40 dBFS civarı alçak sesle konuşma
    expect(levelToBar(0.05)).toBeGreaterThan(0.3)
    expect(levelToBar(0.05)).toBeLessThan(0.7)
    expect(levelToBar(0.01)).toBeGreaterThan(0.05)
    expect(levelToBar(0.01)).toBeLessThan(0.3)
  })

  it('ses arttıkça çizgi de uzar', () => {
    expect(levelToBar(0.02)).toBeLessThan(levelToBar(0.04))
    expect(levelToBar(0.1)).toBeLessThan(levelToBar(0.2))
  })
})
