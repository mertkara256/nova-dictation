import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GettingStarted } from './GettingStarted.tsx'
import { memoryStorage } from '../test/memoryStorage.ts'
import { markSetupSeen, shouldShowSetup } from './setupSetting.ts'

const props = {
  wakeWord: 'Asistan', serviceName: 'Whisper', localModel: true,
  status: 'ready' as const, onRecheck: vi.fn(), onClose: vi.fn(),
}

describe('ilk kullanım rehberi', () => {
  it('üç komutu bağımsız deneme metnine uygular', async () => {
    const user = userEvent.setup()
    render(<GettingStarted {...props} />)
    const demo = screen.getByLabelText('Deneme metni')
    const initial = demo.textContent
    await user.click(screen.getByRole('button', { name: /Asistan, son cümleyi sil/ }))
    expect(demo.textContent).toBe('Bugün bir deneme yapıyorum.')
    await user.click(screen.getByRole('button', { name: /Asistan, geri al/ }))
    expect(demo.textContent).toBe(initial)
    await user.click(screen.getByRole('button', { name: /Asistan, yeni paragraf/ }))
    expect(demo.textContent).toBe(initial + '\n\n')
  })

  it('yüklenen modeli hazır saymaz; yeniden denetleme sunar', async () => {
    const user = userEvent.setup()
    render(<GettingStarted {...props} status="loading" />)
    expect(screen.getByText(/Model: yüklenmesi bekleniyor/)).toBeTruthy()
    expect(screen.queryByText(/Model: yüklendi/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Durumu yeniden denetle' }))
    expect(props.onRecheck).toHaveBeenCalled()
  })

  it('rehber kapatılınca hatırlar; mevcut taslaklara kendiliğinden açılmaz', () => {
    const storage = memoryStorage()
    expect(shouldShowSetup(false, storage)).toBe(true)
    expect(shouldShowSetup(true, storage)).toBe(false)
    markSetupSeen(storage)
    expect(shouldShowSetup(false, storage)).toBe(false)
  })
})
