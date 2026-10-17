import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useShortcuts } from './shortcuts.ts'

function setup() {
  const handlers = {
    toggleMic: vi.fn(),
    escape: vi.fn(),
    commandKeyDown: vi.fn(),
    commandKeyUp: vi.fn(),
  }
  function Page() {
    useShortcuts(handlers)
    return <textarea aria-label="Metin" />
  }
  render(<Page />)
  return { ...handlers, user: userEvent.setup() }
}

describe('klavye kısayolları', () => {
  it('⌥ Boşluk mikrofonu açıp kapatır', async () => {
    const { toggleMic, user } = setup()
    await user.click(screen.getByRole('textbox', { name: 'Metin' }))
    await user.keyboard('{Alt>} {/Alt}')
    expect(toggleMic).toHaveBeenCalledTimes(1)
  })

  it('⌥ Boşluk tuşunun metne bölünmez boşluk yazmasını engeller', () => {
    setup()
    // fireEvent, olayın varsayılan davranışı engellendiyse false döner.
    const allowed = fireEvent.keyDown(screen.getByRole('textbox', { name: 'Metin' }), {
      key: ' ',
      code: 'Space',
      altKey: true,
    })
    expect(allowed).toBe(false)
  })

  it('Esc tuşunu bildirir', async () => {
    const { escape, user } = setup()
    await user.keyboard('{Escape}')
    expect(escape).toHaveBeenCalledTimes(1)
  })

  it('başka tuşlarla birlikte basılan Boşluk mikrofonu açmaz', async () => {
    const { toggleMic, user } = setup()
    await user.keyboard('{Meta>}{Alt>} {/Alt}{/Meta}')
    await user.keyboard(' ')
    expect(toggleMic).not.toHaveBeenCalled()
  })

  describe('komut tuşu', () => {
    it('⌃ basılı tutulunca bildirir, bırakılınca bitirir', async () => {
      const { commandKeyDown, commandKeyUp, user } = setup()
      await user.keyboard('{Control>}')
      expect(commandKeyDown).toHaveBeenCalledTimes(1)
      expect(commandKeyUp).not.toHaveBeenCalled()
      await user.keyboard('{/Control}')
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
    })

    it('⌃ başka bir tuşla kısayol olarak kullanılırsa komut modunu hemen bitirir', async () => {
      const { commandKeyDown, commandKeyUp, user } = setup()
      await user.keyboard('{Control>}{Tab}')
      expect(commandKeyDown).toHaveBeenCalledTimes(1)
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
      await user.keyboard('{/Control}')
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
    })

    it('pencere odağı kaybolursa komut modunu bitirir', async () => {
      const { commandKeyUp, user } = setup()
      await user.keyboard('{Control>}')
      fireEvent.blur(window)
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
    })
  })
})
