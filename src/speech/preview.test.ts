import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWhisperPreview, type PreviewHandlers } from './preview.ts'
import type { WhisperClient } from './whisperClient.ts'

const RATE = 16000

/** Yanıtları elle verilen sahte Whisper istemcisi. */
function fakeClient() {
  const requests: { length: number; resolve(text: string): void }[] = []
  const client: WhisperClient = {
    isUp: async () => true,
    transcribe: (samples) =>
      new Promise((resolve) => {
        requests.push({ length: samples.length, resolve })
      }),
  }
  return { client, requests }
}

/** Konuşmayı taklit eden ses. */
function seconds(value: number) {
  return Float32Array.from({ length: RATE * value }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE))
}

function silence(value: number) {
  return new Float32Array(RATE * value)
}

function createHandlers(): PreviewHandlers {
  return { onText: vi.fn() }
}

describe('createWhisperPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("o ana kadarki sesi aralıklarla Whisper'a gönderir ve sonucu iletir", async () => {
    const { client, requests } = fakeClient()
    const handlers = createHandlers()
    const session = createWhisperPreview({ client }).open(RATE, handlers)

    session.push(seconds(1.5))
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests).toHaveLength(1)
    expect(requests[0].length).toBe(RATE * 1.5)

    requests[0].resolve('Toplantı yarın')
    await vi.advanceTimersByTimeAsync(0)
    expect(handlers.onText).toHaveBeenCalledWith('Toplantı yarın')
  })

  it('bir istek sürerken yenisini göndermez', async () => {
    const { client, requests } = fakeClient()
    const session = createWhisperPreview({ client }).open(RATE, createHandlers())

    session.push(seconds(1.5))
    await vi.advanceTimersByTimeAsync(1000)
    session.push(seconds(1))
    await vi.advanceTimersByTimeAsync(2000)
    expect(requests).toHaveLength(1)

    requests[0].resolve('bir')
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests).toHaveLength(2)
    expect(requests[1].length).toBe(RATE * 2.5)
  })

  it('çok kısa ses için ve yeni ses gelmediyse istek göndermez', async () => {
    const { client, requests } = fakeClient()
    const session = createWhisperPreview({ client }).open(RATE, createHandlers())

    session.push(seconds(0.5))
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests).toHaveLength(0)

    session.push(seconds(1))
    await vi.advanceTimersByTimeAsync(1000)
    requests[0].resolve('bir')
    await vi.advanceTimersByTimeAsync(3000)
    expect(requests).toHaveLength(1)
  })

  it('parça bitince durur ve geç gelen sonucu iletmez', async () => {
    const { client, requests } = fakeClient()
    const handlers = createHandlers()
    const session = createWhisperPreview({ client }).open(RATE, handlers)

    session.push(seconds(1.5))
    await vi.advanceTimersByTimeAsync(1000)
    session.finish()
    requests[0].resolve('geç kaldı')
    session.push(seconds(1))
    await vi.advanceTimersByTimeAsync(3000)

    expect(handlers.onText).not.toHaveBeenCalled()
    expect(requests).toHaveLength(1)
  })

  it('konuşmacı durakladıysa istek göndermez, konuşma sürünce yeniden gönderir', async () => {
    const { client, requests } = fakeClient()
    const session = createWhisperPreview({ client }).open(RATE, createHandlers())

    session.push(seconds(1.5))
    session.push(silence(0.5))
    await vi.advanceTimersByTimeAsync(2000)
    expect(requests).toHaveLength(0)

    session.push(seconds(0.5))
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests).toHaveLength(1)
  })
})
