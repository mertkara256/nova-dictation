import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar.tsx'

function setup(text = 'Bir iki üç') {
  const handlers = {
    onCopy: vi.fn(),
    onDownload: vi.fn(),
    onClear: vi.fn(),
    onTogglePanel: vi.fn(),
  }
  render(<Toolbar text={text} wakeWord="Nova" openPanel={null} {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })

describe('araç satırı', () => {
  it('metin boşken ipucunu gösterir ve metin düğmelerini kapatır', () => {
    setup('  \n')
    expect(screen.getByText('Komutlar “Nova” ile başlar')).toBeTruthy()
    expect(button('Metni kopyala').disabled).toBe(true)
    expect(button('İndir').disabled).toBe(true)
    expect(button('Metni temizle').disabled).toBe(true)
  })

  it('kelimesi olmayan metinde de (emoji, boş madde) metin düğmeleri açıktır', () => {
    setup('🙂\n- ')
    expect(screen.getByText('0 kelime')).toBeTruthy()
    expect(button('Metni kopyala').disabled).toBe(false)
    expect(button('İndir').disabled).toBe(false)
    expect(button('Metni temizle').disabled).toBe(false)
  })

  it('kelime sayısını gösterir ve düğmeleri çalıştırır', async () => {
    const { onCopy, onClear, onTogglePanel, user } = setup('Toplantı yarın sabah saat onda başlıyor.')
    expect(screen.getByText('6 kelime')).toBeTruthy()
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

    it('Esc ile kapanır ve odak İndir düğmesine döner', async () => {
      const { user } = setup()
      await user.click(button('İndir'))
      screen.getByRole('menuitem', { name: 'Markdown (.md)' }).focus()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()
      expect(document.activeElement).toBe(button('İndir'))
    })

    it('klavyeyle açılır, ok tuşlarıyla gezilir; seçimden sonra odak İndir düğmesine döner', async () => {
      const { onDownload, user } = setup()
      button('İndir').focus()
      await user.keyboard('{Enter}')
      const item = (name: string) => screen.getByRole('menuitem', { name })
      expect(document.activeElement).toBe(item('Düz metin (.txt)'))
      await user.keyboard('{ArrowDown}')
      expect(document.activeElement).toBe(item('Markdown (.md)'))
      // Son seçenekten sonra başa döner.
      await user.keyboard('{ArrowDown}')
      expect(document.activeElement).toBe(item('Düz metin (.txt)'))
      await user.keyboard('{ArrowUp}{Enter}')
      expect(onDownload).toHaveBeenCalledWith('md')
      expect(document.activeElement).toBe(button('İndir'))
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
