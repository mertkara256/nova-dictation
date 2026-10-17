import { describe, expect, it, vi } from 'vitest'
import { withFallback } from './fallback.ts'
import type { Transcriber, TranscriberError, TranscriberHandlers } from './transcriber.ts'

/** Testte olayları elle tetiklenebilen sahte servis. */
function fakeTranscriber() {
  let handlers: TranscriberHandlers | null = null
  const transcriber: Transcriber = {
    start: vi.fn((h: TranscriberHandlers) => {
      handlers = h
    }),
    stop: vi.fn(),
    setCommandMode: vi.fn(),
  }
  return {
    transcriber,
    final: (text: string) => handlers?.onFinal(text),
    command: (text: string) => handlers?.onCommand?.(text),
    error: (error: TranscriberError) => handlers?.onError(error),
    end: () => handlers?.onEnd(),
    level: (level: number) => handlers?.onLevel?.(level),
  }
}

function createHandlers(): TranscriberHandlers {
  return {
    onPartial: vi.fn(),
    onFinal: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
    onFallback: vi.fn(),
    onLevel: vi.fn(),
  }
}

describe('withFallback', () => {
  it('komut modunu çalışan servise iletir ve komutları geri bildirir', () => {
    const primary = fakeTranscriber()
    const handlers = { ...createHandlers(), onCommand: vi.fn() }
    const transcriber = withFallback(primary.transcriber, fakeTranscriber().transcriber)

    transcriber.start(handlers)
    transcriber.setCommandMode?.(true)
    primary.command('son cümleyi sil')

    expect(primary.transcriber.setCommandMode).toHaveBeenCalledWith(true)
    expect(handlers.onCommand).toHaveBeenCalledWith('son cümleyi sil')
  })

  it('ana servis kullanılamazsa yedek servise geçer', () => {
    const primary = fakeTranscriber()
    const backup = fakeTranscriber()
    const handlers = createHandlers()
    const transcriber = withFallback(primary.transcriber, backup.transcriber)

    transcriber.start(handlers)
    primary.error('unavailable')
    primary.end()
    backup.final('yedekten gelen metin')

    expect(handlers.onFallback).toHaveBeenCalledTimes(1)
    expect(handlers.onError).not.toHaveBeenCalled()
    expect(handlers.onEnd).not.toHaveBeenCalled()
    expect(handlers.onFinal).toHaveBeenCalledWith('yedekten gelen metin')
  })

  it('geçişten sonra durdurma isteğini yedek servise iletir', () => {
    const primary = fakeTranscriber()
    const backup = fakeTranscriber()
    const transcriber = withFallback(primary.transcriber, backup.transcriber)

    transcriber.start(createHandlers())
    primary.error('unavailable')
    transcriber.stop()

    expect(backup.transcriber.stop).toHaveBeenCalled()
    expect(primary.transcriber.stop).not.toHaveBeenCalled()
  })

  it('mikrofon izni hatasında yedeğe geçmez', () => {
    const primary = fakeTranscriber()
    const backup = fakeTranscriber()
    const handlers = createHandlers()
    withFallback(primary.transcriber, backup.transcriber).start(handlers)

    primary.error('permission')

    expect(handlers.onError).toHaveBeenCalledWith('permission')
    expect(backup.transcriber.start).not.toHaveBeenCalled()
  })

  it('yedek servis yoksa ana servisi olduğu gibi döndürür', () => {
    const primary = fakeTranscriber()
    expect(withFallback(primary.transcriber, null)).toBe(primary.transcriber)
  })

  it('ana servisin bildirdiği ses seviyesini iletir', () => {
    const primary = fakeTranscriber()
    const handlers = createHandlers()
    withFallback(primary.transcriber, fakeTranscriber().transcriber).start(handlers)
    primary.level(0.2)
    expect(handlers.onLevel).toHaveBeenCalledWith(0.2)
  })
})
