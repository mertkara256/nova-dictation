import { afterEach, describe, expect, it, vi } from 'vitest'
import { openMicrophone } from './microphone.ts'

describe('openMicrophone', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ses işleme kurulamazsa mikrofonu kapatıp hatayı iletir', async () => {
    const track = { stop: vi.fn() }
    const closeContext = vi.fn(async () => {})
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) },
    })
    vi.stubGlobal(
      'AudioContext',
      class {
        audioWorklet = {
          addModule: async () => {
            throw new Error('ses işleyici yüklenemedi')
          },
        }
        close = closeContext
      },
    )

    await expect(openMicrophone(() => {})).rejects.toThrow('ses işleyici yüklenemedi')
    expect(track.stop).toHaveBeenCalled()
    expect(closeContext).toHaveBeenCalled()
  })
})
