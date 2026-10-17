import { useEffect, useLayoutEffect, useRef } from 'react'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

/** Mikrofon kısayolunun ekranda gösterilecek adı. */
export const MIC_SHORTCUT_LABEL = isMac ? '⌥ Boşluk' : 'Alt + Boşluk'
/** Basılı tutulunca söylenenleri komut sayan tuşun adı. */
export const COMMAND_KEY_LABEL = isMac ? '⌃ Control' : 'Ctrl'

/** Komutlar panelinde gösterilen kısayol listesi. */
export const SHORTCUT_HELP = [
  { keys: MIC_SHORTCUT_LABEL, does: 'Mikrofonu açar ya da kapatır' },
  {
    keys: `${COMMAND_KEY_LABEL} (basılı tut)`,
    does: 'Söylediğini “Nova” demeden komut olarak uygular; mikrofon kapalıysa o süre için açar',
  },
  { keys: 'Esc', does: 'Dinlemeyi durdurur ya da açık paneli kapatır' },
]

interface ShortcutHandlers {
  /** Option (Alt) + Boşluk: mikrofonu açar ya da kapatır. */
  toggleMic(): void
  /** Esc: dinlemeyi durdurur ya da açık paneli kapatır. */
  escape(): void
  /** Komut tuşuna (⌃ Control) basıldı; bırakılana kadar söylenenler komuttur. */
  commandKeyDown(): void
  /** Komut tuşu bırakıldı ya da başka bir tuşla kısayol olarak kullanıldı. */
  commandKeyUp(): void
}

/** Uygulama genelindeki klavye kısayolları. Metin alanına yazarken de çalışır. */
export function useShortcuts(handlers: ShortcutHandlers) {
  // Dinleyici bir kez eklenir; her basışta en güncel işleyiciler çağrılır.
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    let commandKeyHeld = false
    const releaseCommandKey = () => {
      if (!commandKeyHeld) return
      commandKeyHeld = false
      latest.current.commandKeyUp()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        const alone = !event.metaKey && !event.altKey && !event.shiftKey
        if (alone && !event.repeat && !commandKeyHeld) {
          commandKeyHeld = true
          latest.current.commandKeyDown()
        }
        return
      }
      // ⌃ ile birlikte başka bir tuşa basıldıysa bu bir kısayoldur (ör. ⌃Tab); komut değil.
      releaseCommandKey()

      const optionSpace =
        event.code === 'Space' && event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey
      if (optionSpace) {
        // Mac'te ⌥ Boşluk metne bölünmez boşluk yazar; bunu engelle.
        event.preventDefault()
        latest.current.toggleMic()
      } else if (event.key === 'Escape') {
        latest.current.escape()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') releaseCommandKey()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    // Tuş başka bir pencerede bırakılırsa buraya haber gelmez.
    window.addEventListener('blur', releaseCommandKey)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseCommandKey)
    }
  }, [])
}
