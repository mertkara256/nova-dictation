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
  return { detector: new UtteranceDetector({ sampleRate: RATE }, { onUtterance }), onUtterance }
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

  it('çok uzun konuşmayı kelime ortasından değil, son iki saniyedeki en sessiz anda böler', () => {
    const onUtterance = vi.fn<(samples: Float32Array) => void>()
    const onSpeechStart = vi.fn<(samples: Float32Array) => void>()
    const detector = new UtteranceDetector({ sampleRate: RATE }, { onUtterance, onSpeechStart })
    detector.push(tone(24_000))
    detector.push(silence(120)) // nefes arası: parçayı bitirecek kadar uzun değil
    detector.push(tone(6_000))
    detector.push(silence(1000))

    expect(onUtterance).toHaveBeenCalledTimes(2)
    const first = durationMs(onUtterance.mock.calls[0][0])
    expect(first).toBeGreaterThan(24_000)
    expect(first).toBeLessThan(24_150)
    // Bölünen yerin arkası yeni bir parçanın başı olarak bildirilir.
    expect(onSpeechStart).toHaveBeenCalledTimes(2)
  })

  it('kapanırken süren konuşmayı iletir', () => {
    const { detector, onUtterance } = createDetector()
    detector.push(tone(1000))
    expect(onUtterance).not.toHaveBeenCalled()
    detector.flush()
    expect(onUtterance).toHaveBeenCalledTimes(1)
  })

  it('konuşmanın başını, devamını ve bitişini sırayla bildirir', () => {
    const events = {
      onUtterance: vi.fn<(samples: Float32Array) => void>(),
      onSpeechStart: vi.fn<(samples: Float32Array) => void>(),
      onSpeech: vi.fn<(samples: Float32Array) => void>(),
      onDiscard: vi.fn(),
    }
    const detector = new UtteranceDetector({ sampleRate: RATE }, events)
    detector.push(silence(500))
    detector.push(tone(600))
    detector.push(silence(800))

    expect(events.onSpeechStart).toHaveBeenCalledTimes(1)
    expect(events.onUtterance).toHaveBeenCalledTimes(1)
    expect(events.onDiscard).not.toHaveBeenCalled()
    // Başlangıç bloğu ile sonraki bloklar birlikte, iletilen parçanın tamamını oluşturur.
    const streamed =
      events.onSpeechStart.mock.calls[0][0].length +
      events.onSpeech.mock.calls.reduce((total, [samples]) => total + samples.length, 0)
    expect(streamed).toBe(events.onUtterance.mock.calls[0][0].length)
  })

  it('çok kısa sesi attığını bildirir', () => {
    const onUtterance = vi.fn()
    const onDiscard = vi.fn()
    const detector = new UtteranceDetector({ sampleRate: RATE }, { onUtterance, onDiscard })
    detector.push(tone(100))
    detector.push(silence(1000))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onUtterance).not.toHaveBeenCalled()
  })

  it('ses küçük parçalar halinde gelse de aynı sonucu verir', () => {
    const { detector, onUtterance } = createDetector()
    const audio = Float32Array.from([...tone(1000), ...silence(800)])
    for (let i = 0; i < audio.length; i += 128) detector.push(audio.slice(i, i + 128))
    expect(onUtterance).toHaveBeenCalledTimes(1)
  })
})
