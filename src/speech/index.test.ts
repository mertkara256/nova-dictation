import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeechService } from './index.ts'
import type { TranscriberHandlers } from './transcriber.ts'

/** Tarayıcının tanıması yerine geçen sahte sınıf; kaç kez başlatıldığını sayar. */
const recognition = { starts: 0 }
class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult = null
  onerror = null
  onend: (() => void) | null = null
  start() { recognition.starts++ }
  stop() { this.onend?.() }
  abort() { this.onend?.() }
}

function createHandlers(): TranscriberHandlers {
  return {
    onPartial: vi.fn(),
    onFinal: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
    onFallback: vi.fn(),
  }
}

beforeEach(() => {
  recognition.starts = 0
  vi.stubGlobal('SpeechRecognition', FakeRecognition)
  // Whisper sunucusu kapalı.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('createSpeechService', () => {
  it('Whisper kapalıyken izin verilmeden tarayıcının tanımasını başlatmaz', async () => {
    const service = createSpeechService('whisper')
    const handlers = createHandlers()

    service.transcriber?.start(handlers)

    await vi.waitFor(() => expect(handlers.onEnd).toHaveBeenCalled())
    expect(handlers.onError).toHaveBeenCalledWith('unavailable')
    expect(handlers.onFallback).not.toHaveBeenCalled()
    expect(recognition.starts).toBe(0)
  })

  it('izin verilince tarayıcının tanımasına geçer; izin servis yaşadıkça hatırlanır', async () => {
    const service = createSpeechService('whisper')
    service.allowFallback?.()

    for (let i = 1; i <= 2; i++) {
      const handlers = createHandlers()
      service.transcriber?.start(handlers)
      await vi.waitFor(() => expect(handlers.onFallback).toHaveBeenCalled())
      expect(handlers.onError).not.toHaveBeenCalled()
      expect(recognition.starts).toBe(i)
      service.transcriber?.stop()
    }
  })

  it('her sayfa açılışında izin yeniden sorulur; önceki servisin izni yenisine geçmez', async () => {
    createSpeechService('whisper').allowFallback?.()
    const service = createSpeechService('whisper')
    const handlers = createHandlers()

    service.transcriber?.start(handlers)

    await vi.waitFor(() => expect(handlers.onError).toHaveBeenCalledWith('unavailable'))
    expect(recognition.starts).toBe(0)
  })

  it('deneme sürümü doğrudan tarayıcının tanımasını kullanır ve izin sormaz', () => {
    vi.stubEnv('MODE', 'demo')
    const service = createSpeechService()
    const handlers = createHandlers()

    service.transcriber?.start(handlers)

    expect(service.name).toBe('Tarayıcı tanıması')
    expect(service.allowFallback).toBeUndefined()
    expect(recognition.starts).toBe(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('tarayıcının tanıması bilerek seçildiyse izin sormaz', () => {
    const service = createSpeechService('webspeech')
    expect(service.allowFallback).toBeUndefined()
  })

  it('tarayıcı konuşma tanımayı desteklemiyorsa izin önerilmez', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    expect(createSpeechService('whisper').allowFallback).toBeUndefined()
  })
})
