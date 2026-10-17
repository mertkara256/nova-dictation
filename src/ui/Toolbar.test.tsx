import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar.tsx'

function setup(wordCount = 3) {
  const handlers = {
    onCopy: vi.fn(),
    onDownload: vi.fn(),
    onClear: vi.fn(),
    onTogglePanel: vi.fn(),
  }
  render(<Toolbar wordCount={wordCount} wakeWord="Nova" openPanel={null} {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })

describe('araç satırı', () => {
  it('metin boşken ipucunu gösterir ve metin düğmelerini kapatır', () => {
    setup(0)
    expect(screen.getByText('Komutlar “Nova” ile başlar')).toBeTruthy()
    expect(button('Metni kopyala').disabled).toBe(true)
    expect(button('İndir').disabled).toBe(true)
    expect(button('Metni temizle').disabled).toBe(true)
  })

  it('kelime sayısını gösterir ve düğmeleri çalıştırır', async () => {
    const { onCopy, onClear, onTogglePanel, user } = setup(12)
    expect(screen.getByText('12 kelime')).toBeTruthy()
    await user.click(button('Metni kopyala'))
    await user.click(button('Metni temizle'))
    await user.click(button('Geçmiş'))
    expect(onCopy).toHaveBeenCalled()
    expect(onClear).toHaveBeenCalled()
    expect(onTogglePanel).toHaveBeenCalledWith('history')
  })

  describe('indirme menüsü', () => {
    it('seçilen biçimle indirir ve kapanır', async () => {
      const { onDownload, user } = setup()
      await user.click(button('İndir'))
      await user.click(screen.getByRole('menuitem', { name: 'Markdown (.md)' }))
      expect(onDownload).toHaveBeenCalledWith('md')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('Esc ile kapanır', async () => {
      const { user } = setup()
      await user.click(button('İndir'))
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('dışarı tıklayınca kapanır', async () => {
      const { user } = setup()
      await user.click(button('İndir'))
      expect(screen.getByRole('menu')).toBeTruthy()
      await user.click(document.body)
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })
})
