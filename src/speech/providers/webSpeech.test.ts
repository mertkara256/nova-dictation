import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranscriberHandlers } from './transcriber.ts'
import {
  createWebSpeechTranscriber,
  type RecognitionResultEvent,
  type SpeechRecognitionLike,
} from './webSpeech.ts'

class FakeRecognition implements SpeechRecognitionLike {
  static last: FakeRecognition
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: RecognitionResultEvent) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  startCount = 0

  constructor() {
    FakeRecognition.last = this
  }

  start() {
    this.startCount++
  }

  stop() {
    this.onend?.()
  }

  emit(resultIndex: number, results: [transcript: string, isFinal: boolean][]) {
    this.onresult?.({
      resultIndex,
      results: results.map(([transcript, isFinal]) =>
        Object.assign([{ transcript }], { isFinal }),
      ),
    })
  }
}

function createHandlers(): TranscriberHandlers {
  return { onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() }
}

describe('createWebSpeechTranscriber', () => {
  let handlers: TranscriberHandlers

  beforeEach(() => {
    handlers = createHandlers()
    createWebSpeechTranscriber(FakeRecognition).start(handlers)
  })

  it('Türkçe, sürekli ve ara sonuçlu dinlemeyi başlatır', () => {
    const rec = FakeRecognition.last
    expect(rec.lang).toBe('tr-TR')
    expect(rec.continuous).toBe(true)
    expect(rec.interimResults).toBe(true)
    expect(rec.startCount).toBe(1)
  })

  it('kesinleşen ve kesinleşmeyen metni ayrı iletir', () => {
    FakeRecognition.last.emit(0, [
      ['merhaba dünya', true],
      ['nasıl', false],
    ])
    expect(handlers.onFinal).toHaveBeenCalledWith('merhaba dünya')
    expect(handlers.onPartial).toHaveBeenLastCalledWith('nasıl')
  })

  it('daha önce iletilen sonuçları tekrar iletmez', () => {
    FakeRecognition.last.emit(1, [
      ['merhaba dünya', true],
      ['nasılsın', true],
    ])
    expect(handlers.onFinal).toHaveBeenCalledTimes(1)
    expect(handlers.onFinal).toHaveBeenCalledWith('nasılsın')
  })

  it('tarayıcı dinlemeyi kendiliğinden bitirirse yeniden başlatır', () => {
    FakeRecognition.last.onend?.()
    expect(FakeRecognition.last.startCount).toBe(2)
    expect(handlers.onEnd).not.toHaveBeenCalled()
  })

  it('sessizlik hatasını yok sayar ve dinlemeye devam eder', () => {
    FakeRecognition.last.onerror?.({ error: 'no-speech' })
    FakeRecognition.last.onend?.()
    expect(handlers.onError).not.toHaveBeenCalled()
    expect(FakeRecognition.last.startCount).toBe(2)
  })

  it('mikrofon izni verilmezse hatayı iletir ve yeniden başlatmaz', () => {
    FakeRecognition.last.onerror?.({ error: 'not-allowed' })
    FakeRecognition.last.onend?.()
    expect(handlers.onError).toHaveBeenCalledWith('permission')
    expect(FakeRecognition.last.startCount).toBe(1)
    expect(handlers.onEnd).toHaveBeenCalled()
  })
})

describe('stop', () => {
  it('dinlemeyi bitirir ve ara metni temizler', () => {
    const handlers = createHandlers()
    const transcriber = createWebSpeechTranscriber(FakeRecognition)
    transcriber.start(handlers)
    transcriber.stop()
    expect(FakeRecognition.last.startCount).toBe(1)
    expect(handlers.onPartial).toHaveBeenLastCalledWith('')
    expect(handlers.onEnd).toHaveBeenCalled()
  })
})
