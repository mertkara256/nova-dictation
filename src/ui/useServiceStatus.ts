import { useCallback, useEffect, useRef, useState } from 'react'
import type { WhisperStatus } from '../speech/whisperClient.ts'

export type ServiceStatus = 'checking' | WhisperStatus
const CHECK_INTERVAL_MS = 30_000
/** Model yüklenirken ya da servis kapalıyken (ör. `npm start` sonrası) daha sık denetlenir. */
const QUICK_CHECK_INTERVAL_MS = 2_000
/** Servis kapalıysa bu kadar denemeden sonra yeniden seyrek denetime dönülür. */
const QUICK_OFFLINE_CHECKS = 5

/**
 * Açılışta, pencereye dönünce ve kullanıcı isteyince servis/model durumunu denetler.
 * Sekme görünürken düzenli denetler; hazır değilken aralık kısalır.
 */
export function useServiceStatus(isAvailable: () => Promise<boolean>, getStatus?: () => Promise<WhisperStatus>) {
  const [status, setStatus] = useState<ServiceStatus>('checking')
  const [interval, setCheckInterval] = useState(CHECK_INTERVAL_MS)
  const requests = useRef({ generation: 0, offlineChecks: 0 })
  const check = useCallback(async () => {
    const id = ++requests.current.generation
    let next: WhisperStatus
    try {
      next = getStatus ? await getStatus() : await isAvailable() ? 'ready' : 'offline'
    } catch {
      next = 'offline'
    }
    if (id !== requests.current.generation) return
    requests.current.offlineChecks = next === 'offline' ? requests.current.offlineChecks + 1 : 0
    const quick = next === 'loading' || (next === 'offline' && requests.current.offlineChecks < QUICK_OFFLINE_CHECKS)
    setStatus(next)
    setCheckInterval(quick ? QUICK_CHECK_INTERVAL_MS : CHECK_INTERVAL_MS)
  }, [isAvailable, getStatus])

  const refresh = useCallback(() => {
    setStatus('checking')
    return check()
  }, [check])

  useEffect(() => {
    const current = requests.current
    void check()
    const checkIfVisible = () => { if (!document.hidden) void check() }
    window.addEventListener('focus', checkIfVisible)
    return () => {
      current.generation++
      window.removeEventListener('focus', checkIfVisible)
    }
  }, [check])

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void check() }, interval)
    return () => clearInterval(timer)
  }, [check, interval])

  return { status, refresh }
}
