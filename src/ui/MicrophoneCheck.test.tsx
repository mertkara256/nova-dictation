import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Microphone, openMicrophone } from '../speech/microphone.ts'
import { MicrophoneCheck } from './MicrophoneCheck.tsx'

vi.mock('../speech/microphone.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('../speech/microphone.ts')>(),
  openMicrophone: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(openMicrophone).mockReset()
})
afterEach(() => vi.useRealTimers())

const start = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mikrofonu dene' })) })
}

describe('mikrofon denemesi', () => {
  it('kendiliğinden başlamaz; sesi algılar ve beş saniye sonunda mikrofonu kapatır', async () => {
    let audio: ((samples: Float32Array) => void) | undefined
    const close = vi.fn(async () => {})
    vi.mocked(openMicrophone).mockImplementation(async (callback) => {
      audio = callback
      return { sampleRate: 16000, close }
    })
    render(<MicrophoneCheck />)
    expect(openMicrophone).not.toHaveBeenCalled()
    await start()
    act(() => audio?.(new Float32Array(160).fill(0.2)))
    expect(screen.getByText(/Ses algılanıyor/)).toBeTruthy()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Mikrofon hazır/)).toBeTruthy()
  })

  it('sessiz mikrofonu başarılı saymaz', async () => {
    const close = vi.fn(async () => {})
    vi.mocked(openMicrophone).mockResolvedValue({ sampleRate: 16000, close })
    render(<MicrophoneCheck />)
    await start()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/ses algılanmadı/)).toBeTruthy()
  })

  it('panel kapandıktan sonra izin verilirse geç açılan mikrofonu hemen kapatır', async () => {
    let resolve!: (microphone: Microphone) => void
    vi.mocked(openMicrophone).mockReturnValue(new Promise((done) => { resolve = done }))
    const close = vi.fn(async () => {})
    const view = render(<MicrophoneCheck />)
    await start()
    view.unmount()
    await act(async () => { resolve({ sampleRate: 16000, close }) })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('kullanıcı denemeyi durdurunca mikrofonu kapatır ve zamanlayıcıyı temizler', async () => {
    const close = vi.fn(async () => {})
    vi.mocked(openMicrophone).mockResolvedValue({ sampleRate: 16000, close })
    render(<MicrophoneCheck />)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'Mikrofon denemesini durdur' }))
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Mikrofonu dene' })).toBeTruthy()
    expect(screen.queryByText(/ses algılanmadı/)).toBeNull()
  })

  it('izin reddini açıklar ve yeniden denemeye izin verir', async () => {
    vi.mocked(openMicrophone).mockRejectedValue(new DOMException('', 'NotAllowedError'))
    render(<MicrophoneCheck />)
    await start()
    expect(screen.getByText(/Mikrofon izni verilmedi/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mikrofonu dene' })).toBeTruthy()
  })
})
