import { describe, expect, it } from 'vitest'
import { downsample, encodeWav } from './audio.ts'

describe('downsample', () => {
  it('örnekleme hızını düşürür ve ortalamasını alır', () => {
    const input = Float32Array.from([0, 0.3, 0.6, 0.3, 0.6, 0.9])
    expect(Array.from(downsample(input, 48000, 16000))).toEqual([
      expect.closeTo(0.3),
      expect.closeTo(0.6),
    ])
  })

  it('hız aynıysa girişi olduğu gibi döndürür', () => {
    const input = Float32Array.from([0.1, 0.2])
    expect(downsample(input, 16000, 16000)).toBe(input)
  })

  it('örnekleme hızını artırmayı reddeder', () => {
    expect(() => downsample(new Float32Array(4), 16000, 48000)).toThrow()
  })
})

describe('encodeWav', () => {
  it('geçerli bir WAV başlığı yazar', () => {
    const view = new DataView(encodeWav(new Float32Array(10), 16000))
    const text = (offset: number) =>
      String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(offset + i)))

    expect(text(0)).toBe('RIFF')
    expect(text(8)).toBe('WAVE')
    expect(text(36)).toBe('data')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(40, true)).toBe(20)
    expect(view.byteLength).toBe(64)
  })

  it('örnekleri 16 bit tam sayıya çevirir ve taşanları kırpar', () => {
    const view = new DataView(encodeWav(Float32Array.from([1, -1, 2, 0]), 16000))
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32768)
    expect(view.getInt16(48, true)).toBe(32767)
    expect(view.getInt16(50, true)).toBe(0)
  })
})
