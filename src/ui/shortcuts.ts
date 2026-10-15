import { useEffect, useLayoutEffect, useRef } from 'react'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

/** Mikrofon kısayolunun ekranda gösterilecek adı. */
export const MIC_SHORTCUT_LABEL = isMac ? '⌥ Boşluk' : 'Alt + Boşluk'

/** Komutlar panelinde gösterilen kısayol listesi. */
export const SHORTCUT_HELP = [
  { keys: MIC_SHORTCUT_LABEL, does: 'Mikrofonu açar ya da kapatır' },
  { keys: 'Esc', does: 'Dinlemeyi durdurur ya da açık paneli kapatır' },
]

interface ShortcutHandlers {
  /** Option (Alt) + Boşluk: mikrofonu açar ya da kapatır. */
  toggleMic(): void
  /** Esc: dinlemeyi durdurur ya da açık paneli kapatır. */
  escape(): void
}

/** Uygulama genelindeki klavye kısayolları. Metin alanına yazarken de çalışır. */
export function useShortcuts(handlers: ShortcutHandlers) {
  // Dinleyici bir kez eklenir; her basışta en güncel işleyiciler çağrılır.
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
