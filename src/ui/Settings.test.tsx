import { cleanup, render, screen } from '@testing-library/react'
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

  it('ölçüm kaydı seçeneğini yalnızca verildiğinde gösterir ve değişikliği bildirir', async () => {
    const { user } = setup()
    expect(screen.queryByRole('checkbox', { name: 'Ölçüm için kaydet' })).toBeNull()
    cleanup()

    const onChange = vi.fn()
    render(
      <Settings
        wakeWord="Nova"
        onWakeWordChange={vi.fn()}
        testRecording={{ enabled: false, onChange }}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Ölçüm için kaydet' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  describe('özel kelimeler', () => {
    function renderVocabulary(words: string[] = []) {
      const onChange = vi.fn()
      render(
        <Settings
          wakeWord="Nova"
          onWakeWordChange={vi.fn()}
          vocabulary={{ words, onChange }}
          onClose={vi.fn()}
        />,
      )
      const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Özel kelimeler' })
      return { onChange, field, user: userEvent.setup() }
    }

    it('yazılan listeyi ayırıp kaydeder ve kaç kelime olduğunu söyler', async () => {
      const { onChange, field, user } = renderVocabulary()
      await user.type(field, 'Ayşe Hanım, Kubernetes{Enter}Kubernetes')
      await user.click(screen.getByRole('button', { name: 'Özel kelimeleri kaydet' }))
      expect(onChange).toHaveBeenCalledWith(['Ayşe Hanım', 'Kubernetes'])
      expect(screen.getByText('Kaydedildi: 2 kelime ya da ifade.')).toBeTruthy()
      expect(field.value).toBe('Ayşe Hanım, Kubernetes')
    })

    it('kayıtlı listeyi gösterir; değişiklik yoksa Kaydet kapalıdır', () => {
      const { field } = renderVocabulary(['Ayşe Hanım', 'Kubernetes'])
      expect(field.value).toBe('Ayşe Hanım, Kubernetes')
      const save = screen.getByRole<HTMLButtonElement>('button', { name: 'Özel kelimeleri kaydet' })
      expect(save.disabled).toBe(true)
    })

    it('verilmediğinde (destekleyen servis yoksa) gösterilmez', () => {
      setup()
      expect(screen.queryByRole('textbox', { name: 'Özel kelimeler' })).toBeNull()
    })
  })
})
