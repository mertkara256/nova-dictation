import { useCallback, useEffect, useRef, useState } from 'react'
import type { WhisperStatus } from '../speech/whisperClient.ts'

export type ServiceStatus = 'checking' | WhisperStatus
const CHECK_INTERVAL_MS = 30_000

/** Açılışta, pencereye dönünce ve kullanıcı isteyince servis/model durumunu denetler. */
export function useServiceStatus(isAvailable: () => Promise<boolean>, getStatus?: () => Promise<WhisperStatus>) {
  const [status, setStatus] = useState<ServiceStatus>('checking')
  const requests = useRef({ generation: 0 })
  const check = useCallback(async () => {
    const id = ++requests.current.generation
    let next: WhisperStatus
    try {
      next = getStatus ? await getStatus() : await isAvailable() ? 'ready' : 'offline'
    } catch {
      next = 'offline'
    }
    if (id === requests.current.generation) setStatus(next)
  }, [isAvailable, getStatus])

  const refresh = useCallback(() => {
    setStatus('checking')
    return check()
  }, [check])

  useEffect(() => {
    const current = requests.current
    void check()
    const checkIfVisible = () => { if (!document.hidden) void check() }
    const timer = setInterval(checkIfVisible, CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkIfVisible)
    return () => {
      current.generation++
      clearInterval(timer)
      window.removeEventListener('focus', checkIfVisible)
    }
  }, [check])

  return { status, refresh }
}
