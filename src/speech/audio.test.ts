import { describe, expect, it } from 'vitest'
import { createResampler, decodeWav, encodeWav, resample } from './audio.ts'

describe('createResampler', () => {
  it('parça parça gelen sesi, tek seferde gelmiş gibi dönüştürür', () => {
    const input = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 10))
    const whole = resample(input, 48000, 16000)

    const resampleChunk = createResampler(48000, 16000)
    const chunks: number[] = []
    for (let i = 0; i < input.length; i += 128) chunks.push(...resampleChunk(input.slice(i, i + 128)))

    expect(chunks).toHaveLength(whole.length)
    chunks.forEach((value, i) => expect(value).toBeCloseTo(whole[i], 6))
  })

  it('tam bölünmeyen hızlarda da örnek kaybetmez', () => {
    const resampleChunk = createResampler(44100, 16000)
    let total = 0
    for (let i = 0; i < 100; i++) total += resampleChunk(new Float32Array(441)).length
    // 44100 örnek = 1 saniye = 16000 örnek (en fazla bir örnek eksik kalabilir).
    expect(total).toBeGreaterThanOrEqual(15999)
    expect(total).toBeLessThanOrEqual(16000)
  })

  it('örnekleme hızını artırmayı reddeder', () => {
    expect(() => createResampler(16000, 48000)).toThrow()
  })
})

describe('resample', () => {
  it('örnekleme hızını düşürür ve ortalamasını alır', () => {
    const input = Float32Array.from([0, 0.3, 0.6, 0.3, 0.6, 0.9])
    expect(Array.from(resample(input, 48000, 16000))).toEqual([
      expect.closeTo(0.3),
      expect.closeTo(0.6),
    ])
  })

  it('hız aynıysa girişi olduğu gibi döndürür', () => {
    const input = Float32Array.from([0.1, 0.2])
    expect(resample(input, 16000, 16000)).toBe(input)
  })

  it('8 kHz sesi komşu örnekler arasında doğrusal ara değerlemeyle 16 kHz\'e yükseltir', () => {
    const input = Float32Array.from([0, 0.4, -0.4, 0.2])
    expect(Array.from(resample(input, 8000, 16000))).toEqual([
      0,
      expect.closeTo(0.2),
      expect.closeTo(0.4),
      expect.closeTo(0),
      expect.closeTo(-0.4),
      expect.closeTo(-0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.2),
    ])
  })

  it('tam katı olmayan düşük hızlarda süreyi korur', () => {
    // 11025 örnek = 1 saniye = 16000 örnek.
    expect(resample(new Float32Array(11025), 11025, 16000)).toHaveLength(16000)
    expect(resample(new Float32Array(0), 8000, 16000)).toHaveLength(0)
  })

  it('8 kHz sesten 16 kHz WAV üretir', () => {
    const input = Float32Array.from({ length: 8000 }, (_, i) => Math.sin(i / 10) / 2)
    const decoded = decodeWav(new Uint8Array(encodeWav(resample(input, 8000, 16000), 16000)))
    expect(decoded.sampleRate).toBe(16000)
    expect(decoded.samples).toHaveLength(16000)
    expect(decoded.samples[2]).toBeCloseTo(input[1], 3)
    expect(decoded.samples[3]).toBeCloseTo((input[1] + input[2]) / 2, 3)
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

describe('decodeWav', () => {
  it('encodeWav ile yazılan sesi geri okur', () => {
    const samples = Float32Array.from([0, 0.5, -0.5])
    const decoded = decodeWav(new Uint8Array(encodeWav(samples, 16000)))
    expect(decoded.sampleRate).toBe(16000)
    decoded.samples.forEach((value, i) => expect(value).toBeCloseTo(samples[i], 3))
  })

  it('tanımadığı bölümleri atlar ve iki kanallı sesin ortalamasını alır', () => {
    const view = new DataView(new ArrayBuffer(64))
    const writeText = (offset: number, text: string) =>
      [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
    writeText(0, 'RIFF')
    view.setUint32(4, 56, true)
    writeText(8, 'WAVE')
    writeText(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 2, true) // iki kanal
    view.setUint32(24, 48000, true)
    view.setUint16(34, 16, true)
    writeText(36, 'FLLR') // macOS'un say komutunun eklediği dolgu bölümü
    view.setUint32(40, 4, true)
    writeText(48, 'data')
    view.setUint32(52, 8, true)
    view.setInt16(56, 16384, true) // 1. örnek: 0,5 ve 0
    view.setInt16(60, -16384, true) // 2. örnek: -0,5 ve -0,5
    view.setInt16(62, -16384, true)

    const decoded = decodeWav(new Uint8Array(view.buffer))
    expect(decoded.sampleRate).toBe(48000)
    expect(Array.from(decoded.samples)).toEqual([0.25, -0.5])
  })

  it('WAV olmayan veriyi reddeder', () => {
    expect(() => decodeWav(new Uint8Array(12))).toThrow('WAV dosyası değil.')
  })
})
