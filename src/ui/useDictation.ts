import { useEffect, useState } from 'react'
import type { Transcriber, TranscriberError } from '../speech/transcriber.ts'

/** Mikrofonun açık/kapalı durumunu, ara metni ve hatayı arayüze taşır. */
export function useDictation(transcriber: Transcriber | null) {
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<TranscriberError | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => () => transcriber?.stop(), [transcriber])

  function start(onFinal: (text: string) => void) {
    if (!transcriber) return
    setError(null)
    setUsingFallback(false)
    setListening(true)
    transcriber.start({
      onPartial: setPartial,
      onFinal: (text) => {
        setPartial('')
        onFinal(text)
      },
      onError: setError,
      onEnd: () => setListening(false),
      onFallback: () => setUsingFallback(true),
    })
  }

  function stop() {
    transcriber?.stop()
  }

  return { listening, partial, error, usingFallback, start, stop }
}
