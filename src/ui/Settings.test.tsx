import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Settings } from './Settings.tsx'

function setup(wakeWord = 'Nova') {
  const onWakeWordChange = vi.fn()
  render(<Settings wakeWord={wakeWord} onWakeWordChange={onWakeWordChange} onClose={vi.fn()} />)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Komut kelimesi' })
  return { onWakeWordChange, input, user: userEvent.setup() }
}

describe('ayarlar', () => {
  it('yeni komut kelimesini düzeltip kaydeder ve nasıl kullanılacağını söyler', async () => {
    const { onWakeWordChange, input, user } = setup()
    await user.clear(input)
    await user.type(input, 'asistan{Enter}')
    expect(onWakeWordChange).toHaveBeenCalledWith('Asistan')
    expect(screen.getByText('Kaydedildi. Artık “Asistan, son cümleyi sil” diyebilirsin.')).toBeTruthy()
  })

  it('geçersiz kelimede uyarır ve kaydetmez', async () => {
    const { onWakeWordChange, input, user } = setup()
    await user.clear(input)
    await user.type(input, 'hey nova{Enter}')
    expect(onWakeWordChange).not.toHaveBeenCalled()
    expect(screen.getByText('Yalnızca harflerden oluşan tek bir kelime yaz.')).toBeTruthy()
  })

  it('kelime değişmeden Kaydet düğmesi kapalıdır', () => {
    setup()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Kaydet' }).disabled).toBe(true)
  })

  it('varsayılana dönme bağlantısını yalnızca kelime değiştirilmişse gösterir', async () => {
    expect(screen.queryByRole('button', { name: /Varsayılana dön/ })).toBeNull()
    const { onWakeWordChange, user } = setup('Asistan')
    await user.click(screen.getByRole('button', { name: /Varsayılana dön/ }))
    expect(onWakeWordChange).toHaveBeenCalledWith('Nova')
  })
})
