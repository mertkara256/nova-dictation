import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WhisperStatus } from '../speech/whisperClient.ts'
import { useServiceStatus } from './useServiceStatus.ts'

describe('servis durumu', () => {
  it('modelin yüklenmesini gösterir ve elle yeniden denetler', async () => {
    const available = vi.fn(async () => false)
    const status = vi.fn(async (): Promise<WhisperStatus> => 'loading')
    const { result } = renderHook(() => useServiceStatus(available, status))
    await waitFor(() => expect(result.current.status).toBe('loading'))
    status.mockResolvedValue('ready')
    await act(() => result.current.refresh())
    expect(result.current.status).toBe('ready')
    expect(available).not.toHaveBeenCalled()
  })

  it('geç gelen eski yanıtın yeni durumu ezmesine izin vermez', async () => {
    let resolve!: (status: WhisperStatus) => void
    const status = vi.fn(() => new Promise<WhisperStatus>((done) => { resolve = done }))
    const available = async () => true
    const { result } = renderHook(() => useServiceStatus(available, status))
    status.mockResolvedValueOnce('ready')
    await act(() => result.current.refresh())
    await act(async () => { resolve('offline') })
    expect(result.current.status).toBe('ready')
  })

  it('servis kontrolü hata atarsa çevrimdışı gösterir', async () => {
    const available = vi.fn(async () => { throw new Error('bağlantı') })
    const { result } = renderHook(() => useServiceStatus(available))
    await waitFor(() => expect(result.current.status).toBe('offline'))
  })

  describe('düzenli denetim', () => {
    afterEach(() => { vi.useRealTimers() })

    // Kancaya her çizimde aynı işlev verilmeli; yoksa her çizim yeni bir denetim başlatır.
    const unused = async () => false

    /** Bekleyen zamanlayıcıları ve sözleri çalıştırarak sahte saati ilerletir. */
    const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

    it('model yüklenirken sık denetler; hazır olunca birkaç saniye içinde fark eder', async () => {
      vi.useFakeTimers()
      const status = vi.fn(async (): Promise<WhisperStatus> => 'loading')
      const { result } = renderHook(() => useServiceStatus(unused, status))
      await advance(0)
      expect(result.current.status).toBe('loading')
      status.mockResolvedValue('ready')
      await advance(2_000)
      expect(result.current.status).toBe('ready')
    })

    it('hazırken 30 saniyede bir denetler', async () => {
      vi.useFakeTimers()
      const status = vi.fn(async (): Promise<WhisperStatus> => 'ready')
      renderHook(() => useServiceStatus(unused, status))
      await advance(0)
      expect(status).toHaveBeenCalledTimes(1)
      await advance(29_000)
      expect(status).toHaveBeenCalledTimes(1)
      await advance(1_000)
      expect(status).toHaveBeenCalledTimes(2)
    })

    it('servis kapalıysa birkaç sık denemeden sonra 30 saniyeye döner', async () => {
      vi.useFakeTimers()
      const status = vi.fn(async (): Promise<WhisperStatus> => 'offline')
      renderHook(() => useServiceStatus(unused, status))
      await advance(0)
      await advance(10_000)
      const quickChecks = status.mock.calls.length
      expect(quickChecks).toBeGreaterThan(2)
      await advance(29_000)
      expect(status).toHaveBeenCalledTimes(quickChecks)
      await advance(1_000)
      expect(status).toHaveBeenCalledTimes(quickChecks + 1)
    })

    it('sekme gizliyken denetlemez', async () => {
      vi.useFakeTimers()
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      const status = vi.fn(async (): Promise<WhisperStatus> => 'loading')
      renderHook(() => useServiceStatus(unused, status))
      await advance(0)
      await advance(10_000)
      expect(status).toHaveBeenCalledTimes(1)
      hidden.mockRestore()
    })
  })
})
