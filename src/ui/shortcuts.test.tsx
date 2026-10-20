import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { COMMAND_KEY_HOLD_MS, isMicShortcut, useShortcuts } from './shortcuts.ts'

/** Komut tuşunun tek başına basılı tutulması gereken süre kadar bekler. */
const waitForHold = () => new Promise((resolve) => setTimeout(resolve, COMMAND_KEY_HOLD_MS + 50))

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

describe('isMicShortcut', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

  it("Mac'te ⌥ Boşluk'u tanır", () => {
    expect(isMicShortcut(key({ key: ' ', code: 'Space', altKey: true }), true)).toBe(true)
    expect(isMicShortcut(key({ key: 'm', code: 'KeyM', altKey: true }), true)).toBe(false)
  })

  it("Windows ve Linux'ta Alt + M'yi tanır; Alt + Boşluk pencere menüsüne kalır", () => {
    expect(isMicShortcut(key({ key: 'm', code: 'KeyM', altKey: true }), false)).toBe(true)
    expect(isMicShortcut(key({ key: 'M', code: 'KeyM', altKey: true }), false)).toBe(true)
    expect(isMicShortcut(key({ key: ' ', code: 'Space', altKey: true }), false)).toBe(false)
  })

  it('başka değiştirici tuşlarla (ör. AltGr = Ctrl + Alt) basılınca tanımaz', () => {
    expect(isMicShortcut(key({ key: 'm', altKey: true, ctrlKey: true }), false)).toBe(false)
    expect(isMicShortcut(key({ key: ' ', code: 'Space', altKey: true, shiftKey: true }), true)).toBe(false)
  })
})

describe('klavye kısayolları', () => {
  // Testlerdeki tarayıcı Mac değil; mikrofon kısayolu Alt + M.
  it('mikrofon kısayolu mikrofonu açıp kapatır ve tuşun metne yazmasını engeller', async () => {
    const { toggleMic, user } = setup()
    await user.click(screen.getByRole('textbox', { name: 'Metin' }))
    await user.keyboard('{Alt>}m{/Alt}')
    expect(toggleMic).toHaveBeenCalledTimes(1)
    // fireEvent, olayın varsayılan davranışı engellendiyse false döner.
    const allowed = fireEvent.keyDown(screen.getByRole('textbox', { name: 'Metin' }), {
      key: 'm',
      code: 'KeyM',
      altKey: true,
    })
    expect(allowed).toBe(false)
  })

  it('Esc tuşunu bildirir', async () => {
    const { escape, user } = setup()
    await user.keyboard('{Escape}')
    expect(escape).toHaveBeenCalledTimes(1)
  })

  it('başka tuşlarla birlikte basılan kısayol mikrofonu açmaz', async () => {
    const { toggleMic, user } = setup()
    await user.keyboard('{Meta>}{Alt>}m{/Alt}{/Meta}')
    await user.keyboard('m')
    expect(toggleMic).not.toHaveBeenCalled()
  })

  describe('komut tuşu', () => {
    it('⌃ tek başına basılı tutulunca bildirir, bırakılınca bitirir', async () => {
      const { commandKeyDown, commandKeyUp, user } = setup()
      await user.keyboard('{Control>}')
      expect(commandKeyDown).not.toHaveBeenCalled()
      await waitForHold()
      expect(commandKeyDown).toHaveBeenCalledTimes(1)
      expect(commandKeyUp).not.toHaveBeenCalled()
      await user.keyboard('{/Control}')
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
    })

    it('⌃C gibi kısayollarda ve kısa basışlarda komut modu hiç başlamaz', async () => {
      const { commandKeyDown, commandKeyUp, user } = setup()
      await user.keyboard('{Control>}c{/Control}')
      await user.keyboard('{Control>}{/Control}')
      await waitForHold()
      expect(commandKeyDown).not.toHaveBeenCalled()
      expect(commandKeyUp).not.toHaveBeenCalled()
    })

    it('komut modundayken başka bir tuşa basılırsa komut modunu bitirir', async () => {
      const { commandKeyUp, user } = setup()
      await user.keyboard('{Control>}')
      await waitForHold()
      await user.keyboard('{Tab}')
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
      await user.keyboard('{/Control}')
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
    })

    it('pencere odağı kaybolursa komut modunu bitirir', async () => {
      const { commandKeyUp, user } = setup()
      await user.keyboard('{Control>}')
      await waitForHold()
      fireEvent.blur(window)
      expect(commandKeyUp).toHaveBeenCalledTimes(1)
    })
  })
})
