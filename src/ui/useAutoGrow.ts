import { type RefObject, useLayoutEffect } from 'react'

/**
 * Metin alanının yüksekliğini içeriğe göre ayarlar. Canlı ara metin yalnızca
 * arkadaki yansıma katmanında durduğu için yükseklik ikisinin büyüğüne göre
 * belirlenir. CSS'teki max-height'a ulaşınca alan büyümeyi bırakır ve içeride
 * kaydırılır; yansıma katmanı da aynı konuma kaydırılır.
 */
export function useAutoGrow(
  editorRef: RefObject<HTMLTextAreaElement | null>,
  mirrorRef: RefObject<HTMLElement | null>,
  content: string,
) {
  useLayoutEffect(() => {
    const editor = editorRef.current
    const mirror = mirrorRef.current
    if (!editor || !mirror) return

    const fit = () => {
      editor.style.height = 'auto'
      editor.style.height = `${Math.max(editor.scrollHeight, mirror.scrollHeight)}px`
      mirror.scrollTop = editor.scrollTop
    }

    fit()
    // Dikteyle eklenen metin görünsün diye, kullanıcı yazmıyorsa en alta kaydır.
    if (document.activeElement !== editor) {
      editor.scrollTop = editor.scrollHeight
      mirror.scrollTop = editor.scrollTop
    }

    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [editorRef, mirrorRef, content])
}
