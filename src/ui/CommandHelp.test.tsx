import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CommandHelp } from './CommandHelp.tsx'

function renderHelp() {
  render(<CommandHelp wakeWord="Nova" commandKey onChangeWakeWord={vi.fn()} onClose={vi.fn()} />)
  return {
    user: userEvent.setup(),
    search: screen.getByRole<HTMLInputElement>('searchbox', { name: 'Komut ara' }),
  }
}

describe('CommandHelp', () => {
  it('aranan kelimenin geçtiği komutları gösterir, diğerlerini ve boş grupları gizler', async () => {
    const { user, search } = renderHelp()
    await user.type(search, 'paragraf')

    expect(screen.getByText('son paragrafı sil')).toBeTruthy()
    expect(screen.getByText('ikinci paragrafa git')).toBeTruthy()
    expect(screen.queryByText('bunu sil')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Klavye kısayolları' })).toBeNull()
  })

  it('büyük/küçük harf ve Türkçe karakter farkını gözetmez', async () => {
    const { user, search } = renderHelp()
    await user.type(search, 'SECIMI kaldir')

    expect(screen.getByText('seçimi kaldır')).toBeTruthy()
    expect(screen.queryByText('bunu seç')).toBeNull()
  })

  it('klavye kısayollarında da arar', async () => {
    const { user, search } = renderHelp()
    await user.type(search, 'paneli kapatır')

    expect(screen.getByRole('heading', { name: 'Klavye kısayolları' })).toBeTruthy()
    expect(screen.getByText('Esc')).toBeTruthy()
  })

  it('eşleşen komut yoksa söyler', async () => {
    const { user, search } = renderHelp()
    await user.type(search, 'zzz')

    expect(screen.getByText('“zzz” ile eşleşen komut yok.')).toBeTruthy()
  })

  it('Esc önce aramayı temizler; arama boşken paneli kapatan kısayola ulaşır', async () => {
    const { user, search } = renderHelp()
    const escapes = vi.fn()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') escapes()
    }
    window.addEventListener('keydown', onKeyDown)
    try {
      await user.type(search, 'sil')
      await user.keyboard('{Escape}')
      expect(search.value).toBe('')
      expect(escapes).not.toHaveBeenCalled()

      await user.keyboard('{Escape}')
      expect(escapes).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', onKeyDown)
    }
  })
})
