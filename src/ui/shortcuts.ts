import { useEffect, useLayoutEffect, useRef } from 'react'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

/**
 * Mikrofon kısayolunun ekranda gösterilecek adı. Windows'ta Alt + Boşluk pencere
 * menüsünü açtığı için orada (ve Linux'ta) Alt + M kullanılır.
 */
export const MIC_SHORTCUT_LABEL = isMac ? '⌥ Boşluk' : 'Alt + M'
/** Basılı tutulunca söylenenleri komut sayan tuşun adı. */
export const COMMAND_KEY_LABEL = isMac ? '⌃ Control' : 'Ctrl'
/**
 * Komut tuşu bu kadar süre tek başına basılı kalınca komut modu başlar. Daha
 * kısa basışlar ve kısayollar (ör. ⌃C, ⌃Tab) komut sayılmaz; mikrofon boşuna açılmaz.
 */
export const COMMAND_KEY_HOLD_MS = 250

/** Komutlar panelinde gösterilen kısayol listesi. */
export const SHORTCUT_HELP = [
  { keys: MIC_SHORTCUT_LABEL, does: 'Mikrofonu açar ya da kapatır' },
  {
    keys: `${COMMAND_KEY_LABEL} (basılı tut)`,
    does: 'Söylediğini “Nova” demeden komut olarak uygular; mikrofon kapalıysa o süre için açar',
    commandKey: true,
  },
  { keys: 'Esc', does: 'Dinlemeyi durdurur ya da açık paneli kapatır' },
]

/** Basılan tuş, bu sistemdeki mikrofon kısayolu mu (Mac'te ⌥ Boşluk, diğerlerinde Alt + M)? */
export function isMicShortcut(event: KeyboardEvent, onMac: boolean): boolean {
  if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return false
  return onMac ? event.code === 'Space' : event.key.toLowerCase() === 'm'
}

interface ShortcutHandlers {
  /** Mikrofon kısayolu: mikrofonu açar ya da kapatır. */
  toggleMic(): void
  /** Esc: dinlemeyi durdurur ya da açık paneli kapatır. */
  escape(): void
  /** Komut tuşu (⌃ Control) tek başına basılı tutuluyor; bırakılana kadar söylenenler komuttur. */
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
    let holdTimer: ReturnType<typeof setTimeout> | null = null
    let commandKeyHeld = false
    const releaseCommandKey = () => {
      if (holdTimer) clearTimeout(holdTimer)
      holdTimer = null
      if (!commandKeyHeld) return
      commandKeyHeld = false
      latest.current.commandKeyUp()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        const alone = !event.metaKey && !event.altKey && !event.shiftKey
        if (alone && !event.repeat && !holdTimer && !commandKeyHeld) {
          holdTimer = setTimeout(() => {
            holdTimer = null
            commandKeyHeld = true
            latest.current.commandKeyDown()
          }, COMMAND_KEY_HOLD_MS)
        }
        return
      }
      // ⌃ ile birlikte başka bir tuşa basıldıysa bu bir kısayoldur (ör. ⌃C); komut değil.
      releaseCommandKey()

      if (isMicShortcut(event, isMac)) {
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
      if (holdTimer) clearTimeout(holdTimer)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseCommandKey)
    }
  }, [])
}
