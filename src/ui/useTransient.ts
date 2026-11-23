import { useEffect, useState } from 'react'

/**
 * Kimlik her değiştiğinde, verilen süre boyunca true döner. Kısa süreli
 * vurgular ve kendiliğinden kaybolan bildirimler için. held true iken süre
 * işlemez; false olunca süre baştan başlar.
 */
export function useTransient(id: number | null, duration: number, held = false): boolean {
  const [expired, setExpired] = useState<number | null>(null)

  useEffect(() => {
    if (id === null || held) return
    const timer = setTimeout(() => setExpired(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, held])

  return id !== null && expired !== id
}
