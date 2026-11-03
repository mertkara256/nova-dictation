import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Range } from '../core/document.ts'
import type { PendingRecording } from './RecordingReview.tsx'
import { speech } from './speechService.ts'

/**
 * Ölçüm kaydı (yalnızca geliştirmede): açıkken her mikrofon kullanımı ses olarak
 * kaydedilir. Mikrofon kapanınca biten kayıt; mikrofonun açıldığı andaki metin,
 * komut kelimesi ve özel kelimelerle birlikte gözden geçirilmeyi bekler.
 */
export function useMeasurementRecording(settings: { wakeWord: string; vocabulary: string[] }) {
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState<PendingRecording | null>(null)
  const start = useRef<{ text: string; selection: Range | null }>({ text: '', selection: null })
  const latestSettings = useRef(settings)
  useLayoutEffect(() => {
    latestSettings.current = settings
  })

  useEffect(() => {
    const { recorder } = speech
    if (!recorder) return
    recorder.onRecording = (recording) =>
      setPending({
        id: Date.now(),
        recording,
        initialText: start.current.text,
        initialSelection: start.current.selection,
        wakeWord: latestSettings.current.wakeWord,
        vocabulary: latestSettings.current.vocabulary,
      })
    return () => {
      recorder.onRecording = null
    }
  }, [])

  return {
    enabled,
    pending,
    setEnabled(value: boolean) {
      if (speech.recorder) speech.recorder.enabled = value
      setEnabled(value)
    },
    /** Mikrofon açılırken çağrılır; kaydın başladığı andaki metni saklar. */
    markStart(text: string, selection: Range | null) {
      start.current = { text, selection }
    },
    dismiss() {
      setPending(null)
    },
  }
}
