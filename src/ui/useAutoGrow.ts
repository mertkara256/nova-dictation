import { type RefObject, useLayoutEffect } from 'react'

/**
 * Metin alanının yüksekliğini içeriğe göre ayarlar. CSS'teki max-height'a
 * ulaşınca alan büyümeyi bırakır ve içeride kaydırılır.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }

    fit()
    // Dikteyle eklenen metin görünsün diye, kullanıcı yazmıyorsa en alta kaydır.
    if (document.activeElement !== el) el.scrollTop = el.scrollHeight

    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [ref, value])
}
