import { useEffect, useState } from 'react'

export type ServiceStatus = 'checking' | 'ready' | 'offline'

const CHECK_INTERVAL_MS = 30_000

/**
 * Konuşma tanıma servisinin açık olup olmadığını açılışta, düzenli aralıklarla
 * ve pencereye her dönüldüğünde denetler. Sekme arka plandayken düzenli
 * denetim atlanır.
 */
export function useServiceStatus(isAvailable: () => Promise<boolean>): ServiceStatus {
  const [status, setStatus] = useState<ServiceStatus>('checking')

  useEffect(() => {
    let cancelled = false
    const check = () => {
      void isAvailable().then((available) => {
        if (!cancelled) setStatus(available ? 'ready' : 'offline')
      })
    }
    const checkIfVisible = () => {
      if (!document.hidden) check()
    }

    check()
    const timer = setInterval(checkIfVisible, CHECK_INTERVAL_MS)
    // Sunucuyu terminalden başlatıp pencereye dönünce durum hemen güncellensin.
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [isAvailable])

  return status
}
