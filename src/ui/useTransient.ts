import { useEffect, useState } from 'react'

/**
 * Kimlik her değiştiğinde, verilen süre boyunca true döner. Kısa süreli
 * vurgular ve kendiliğinden kaybolan bildirimler için.
 */
export function useTransient(id: number | null, duration: number): boolean {
  const [expired, setExpired] = useState<number | null>(null)

  useEffect(() => {
    if (id === null) return
    const timer = setTimeout(() => setExpired(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration])

  return id !== null && expired !== id
}
