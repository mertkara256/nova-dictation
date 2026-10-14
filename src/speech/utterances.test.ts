import { describe, expect, it, vi } from 'vitest'
import { UtteranceDetector } from './utterances.ts'

const RATE = 16000

function tone(ms: number) {
  return Float32Array.from(
    { length: (RATE * ms) / 1000 },
    (_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE),
  )
}

function silence(ms: number) {
  return new Float32Array((RATE * ms) / 1000)
}

function durationMs(samples: Float32Array) {
  return (samples.length / RATE) * 1000
}

function createDetector() {
  const onUtterance = vi.fn<(samples: Float32Array) => void>()
  return { detector: new UtteranceDetector({ sampleRate: RATE }, onUtterance), onUtterance }
}

describe('UtteranceDetector', () => {
  it('konuşmadan sonra sessiz kalınınca parçayı iletir', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(silence(500))
    detector.push(tone(1000))
    detector.push(silence(800))

    expect(onUtterance).toHaveBeenCalledTimes(1)
    const length = durationMs(onUtterance.mock.calls[0][0])
    // Öncesindeki 300 ms ve sonundaki sessizlik de parçaya dahil.
    expect(length).toBeGreaterThan(1250)
    expect(length).toBeLessThan(2100)
  })

  it('kısa duraklamalarda konuşmayı bölmez', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(tone(800))
    detector.push(silence(300))
    detector.push(tone(800))
    detector.push(silence(800))
    expect(onUtterance).toHaveBeenCalledTimes(1)
  })

  it('uzun duraklamayla ayrılan konuşmaları ayrı parçalar olarak iletir', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(tone(800))
    detector.push(silence(1000))
    detector.push(tone(800))
    detector.push(silence(1000))
    expect(onUtterance).toHaveBeenCalledTimes(2)
  })

  it('çok kısa sesleri yok sayar', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(tone(100))
    detector.push(silence(1000))
    expect(onUtterance).not.toHaveBeenCalled()
  })

  it('çok uzun konuşmayı en fazla 25 saniyelik parçalara böler', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(tone(30_000))
    detector.push(silence(1000))
    expect(onUtterance).toHaveBeenCalledTimes(2)
    expect(durationMs(onUtterance.mock.calls[0][0])).toBeLessThanOrEqual(25_020)
  })

  it('kapanırken süren konuşmayı iletir', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(tone(1000))
    expect(onUtterance).not.toHaveBeenCalled()
    detector.flush()
    expect(onUtterance).toHaveBeenCalledTimes(1)
  })

  it('ses küçük parçalar halinde gelse de aynı sonucu verir', () => {
    const { detector, onUtterance } = createDetector()
    const audio = Float32Array.from([...tone(1000), ...silence(800)])
    for (let i = 0; i < audio.length; i += 128) detector.push(audio.slice(i, i + 128))
    expect(onUtterance).toHaveBeenCalledTimes(1)
  })
})
