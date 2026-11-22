import { beforeEach, describe, expect, it, vi } from 'vitest'
import { describeTranscriberContract } from '../testing/transcriberContract.ts'
import type { TranscriberHandlers } from '../transcriber.ts'
import {
  createWebSpeechTranscriber,
  punctuateAtPauses,
  type RecognitionResultEvent,
  type SpeechRecognitionLike,
  toSentence,
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
  abortCount = 0

  constructor() {
    FakeRecognition.last = this
  }

  start() {
    this.startCount++
  }

  stop() {
    this.onend?.()
  }

  /** Tarayıcı gibi hemen bitmez; testin sonradan `onend` çağırması gerekir. */
  abort() {
    this.abortCount++
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

describe('cancel', () => {
  it('bekleyen sesi atar: iptalden sonra gelen sonuçları yazmaz, oturum onend ile kapanır', () => {
    const handlers = createHandlers()
    const transcriber = createWebSpeechTranscriber(FakeRecognition)
    transcriber.start(handlers)
    const rec = FakeRecognition.last
    rec.emit(0, [['dinlemeyi', false]])
    transcriber.cancel?.()
    rec.emit(0, [['dinlemeyi durdur', true]])
    rec.onerror?.({ error: 'aborted' })
    expect(handlers.onEnd).not.toHaveBeenCalled()
    rec.onend?.()

    expect(rec.abortCount).toBe(1)
    expect(rec.startCount).toBe(1)
    expect(handlers.onFinal).not.toHaveBeenCalled()
    expect(handlers.onError).not.toHaveBeenCalled()
    expect(handlers.onPartial).toHaveBeenLastCalledWith('')
    expect(handlers.onEnd).toHaveBeenCalledTimes(1)
  })

  it('iptalden sonra yeniden başlatılınca sonuçları yine yazar', () => {
    const handlers = createHandlers()
    const transcriber = createWebSpeechTranscriber(FakeRecognition)
    transcriber.start(handlers)
    transcriber.cancel?.()
    FakeRecognition.last.onend?.()
    transcriber.start(handlers)
    FakeRecognition.last.emit(0, [['merhaba', true]])
    expect(handlers.onFinal).toHaveBeenCalledWith('merhaba')
  })
})

describeTranscriberContract('Web Speech', () => {
  const transcriber = createWebSpeechTranscriber(FakeRecognition)
  return {
    transcriber,
    speak: async (text) => FakeRecognition.last.emit(0, [[text, true]]),
    settle: async () => {},
  }
})

describe('punctuateAtPauses', () => {
  it('her kesin parçayı büyük harfle başlayıp noktayla biten bir cümle yapar, ara metne dokunmaz', () => {
    const handlers = createHandlers()
    punctuateAtPauses(createWebSpeechTranscriber(FakeRecognition)).start(handlers)
    FakeRecognition.last.emit(0, [
      [' istanbul toplantısı yarın', true],
      ['saat üç', false],
    ])
    expect(handlers.onFinal).toHaveBeenCalledWith('İstanbul toplantısı yarın.')
    expect(handlers.onPartial).toHaveBeenLastCalledWith('saat üç')
  })
})

describe('toSentence', () => {
  it('noktalaması olan parçaya nokta eklemez', () => {
    expect(toSentence('Nasılsın?')).toBe('Nasılsın?')
    expect(toSentence('Bugün hava güzel.')).toBe('Bugün hava güzel.')
  })

  it('boş parçayı olduğu gibi bırakır', () => {
    expect(toSentence(' ')).toBe(' ')
  })
})
