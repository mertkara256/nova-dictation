import { useCallback, useEffect, useRef, useState } from 'react'
import type { Transcriber, TranscriberError } from '../speech/transcriber.ts'

interface DictationCallbacks {
  /** Kesinleşmiş dikte metni. */
  onFinal(text: string): void
  /** Komut tuşu basılıyken söylenen, kesinleşmiş metin. */
  onCommand(text: string): void
}

/** Mikrofonun açık/kapalı durumunu, ara metni, hatayı ve ses seviyesini arayüze taşır. */
export function useDictation(transcriber: Transcriber | null) {
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [commandPartial, setCommandPartial] = useState('')
  const [error, setError] = useState<TranscriberError | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  // Ses seviyesi saniyede yüzlerce kez gelir; yeniden çizime yol açmasın diye
  // durum yerine ref'te tutulur ve animasyon okudukça sıfırlanır.
  const peakLevel = useRef(0)

  useEffect(() => () => transcriber?.stop(), [transcriber])

  function start({ onFinal, onCommand }: DictationCallbacks) {
    if (!transcriber) return
    setError(null)
    setUsingFallback(false)
    setListening(true)
    peakLevel.current = 0
    transcriber.start({
      onPartial: setPartial,
      onFinal: (text) => {
        setPartial('')
        onFinal(text)
      },
      onCommand,
      onCommandPartial: setCommandPartial,
      onError: setError,
      onEnd: () => setListening(false),
      onFallback: () => setUsingFallback(true),
      onLevel: (level) => {
        if (level > peakLevel.current) peakLevel.current = level
      },
    })
  }

  function stop() {
    transcriber?.stop()
  }

  /** Açıkken söylenenler metne yazılmaz, komut olarak iletilir. */
  function setCommandMode(active: boolean) {
    transcriber?.setCommandMode?.(active)
  }

  /** Son okumadan bu yana ulaşılan en yüksek ses seviyesini verir ve sıfırlar. */
  const readLevel = useCallback(() => {
    const level = peakLevel.current
    peakLevel.current = 0
    return level
  }, [])

  return {
    listening,
    partial,
    commandPartial,
    error,
    usingFallback,
    supportsCommandMode: Boolean(transcriber?.setCommandMode),
    start,
    stop,
    setCommandMode,
    readLevel,
  }
}
