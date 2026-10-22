import { useEffect, useRef, useState } from 'react'
import { rms } from '../speech/audio.ts'
import { type Microphone, openMicrophone, toMicrophoneError } from '../speech/microphone.ts'

interface CheckSession {
  microphone?: Microphone
  timer?: ReturnType<typeof setTimeout>
  heard: boolean
}

type CheckState = 'idle' | 'requesting' | 'listening' | 'hearing' | 'ready' | 'quiet' | 'permission' | 'no-microphone' | 'unavailable'
const messages: Record<CheckState, string> = {
  idle: 'Beş saniyelik deneme yalnızca ses seviyesini kontrol eder; ses kaydedilmez veya bir servise gönderilmez.',
  requesting: 'Tarayıcıdaki mikrofon iznini bekliyoruz…',
  listening: 'Mikrofon açık. Kısa bir cümle söyle.',
  hearing: 'Ses algılanıyor. Deneme birazdan bitecek…',
  ready: 'Mikrofon hazır. Ses algılandı ve mikrofon kapatıldı.',
  quiet: 'Mikrofon açıldı ama ses algılanmadı. Sessize alma ve giriş ayarlarını kontrol edip yeniden dene.',
  permission: 'Mikrofon izni verilmedi. Adres çubuğundan izin verip yeniden dene.',
  'no-microphone': 'Mikrofon bulunamadı. Bir mikrofon bağlayıp yeniden dene.',
  unavailable: 'Mikrofon açılamadı. Tarayıcının mikrofon ve ses ayarlarını kontrol et.',
}

/** İzin gecikse veya panel kapansa bile deneme mikrofonunu kapatır. */
export function MicrophoneCheck() {
  const [state, setState] = useState<CheckState>('idle')
  const session = useRef<CheckSession | null>(null)
  const active = state === 'requesting' || state === 'listening' || state === 'hearing'

  function dispose() {
    const current = session.current
    session.current = null
    if (!current) return
    clearTimeout(current.timer)
    void current.microphone?.close().catch(() => {})
  }

  useEffect(() => dispose, [])

  async function start() {
    if (session.current) return
    const current: CheckSession = { heard: false }
    session.current = current
    setState('requesting')
    try {
      const microphone = await openMicrophone((samples) => {
        if (session.current !== current || current.heard || rms(samples) < 0.01) return
        current.heard = true
        setState('hearing')
      })
      if (session.current !== current) {
        await microphone.close()
        return
      }
      current.microphone = microphone
      setState(current.heard ? 'hearing' : 'listening')
      current.timer = setTimeout(() => {
        const result = current.heard ? 'ready' : 'quiet'
        dispose()
        setState(result)
      }, 5000)
    } catch (error) {
      if (session.current !== current) return
      dispose()
      const reason = toMicrophoneError(error)
      setState(reason === 'permission' || reason === 'no-microphone' ? reason : 'unavailable')
    }
  }

  return (
    <div>
      <p className="setting-help" role="status">{messages[state]}</p>
      <button type="button" className="button setup-action" onClick={() => {
        if (active) { dispose(); setState('idle') }
        else void start()
      }}>
        {active ? 'Mikrofon denemesini durdur' : 'Mikrofonu dene'}
      </button>
    </div>
  )
}
