import { useRef, useState } from 'react'

interface CommandKeyOptions {
  /** Şu an komut tuşu yok sayılır (ör. ilk kullanım rehberi açıkken ya da bekleyen ses varken). */
  blocked: boolean
  /** Komut modunu yalnızca Whisper sunucusu bilir; tarayıcının tanıması söyleneni metne yazardı. */
  supported: boolean
  listening: boolean
  startListening(): void
  stopListening(): void
  setCommandMode(active: boolean): void
}

/**
 * Komut tuşu (⌃) basılıyken söylenenler komuttur. Mikrofon kapalıyken basıldıysa
 * yalnızca tuş basılı kaldığı süre için açılır.
 */
export function useCommandKey(options: CommandKeyOptions) {
  const [state, setState] = useState<'up' | 'held' | 'unavailable'>('up')
  const micOpenedForCommand = useRef(false)

  function press() {
    if (options.blocked) return
    if (!options.supported) {
      setState('unavailable')
      return
    }
    if (!options.listening) {
      micOpenedForCommand.current = true
      options.startListening()
    }
    options.setCommandMode(true)
    setState('held')
  }

  function release() {
    setState('up')
    options.setCommandMode(false)
    if (micOpenedForCommand.current) {
      micOpenedForCommand.current = false
      options.stopListening()
    }
  }

  return { state, press, release }
}
