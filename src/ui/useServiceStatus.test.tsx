import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
})
