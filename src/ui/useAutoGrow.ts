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
    // Dikteyle eklenen metin görünsün diye, kullanıcı yazmıyorsa imlecin olduğu yere kaydır:
    // imleç sondaysa en alta, ortadaysa (yansımadaki imleç ya da seçim) görünmüyorsa ortaya.
    if (document.activeElement !== editor) {
      const caret = mirror.querySelector<HTMLElement>('.caret, .selection')
      if (!caret) editor.scrollTop = editor.scrollHeight
      else {
        const top = caret.offsetTop
        const visible = top >= editor.scrollTop && top + caret.offsetHeight <= editor.scrollTop + editor.clientHeight
        if (!visible) editor.scrollTop = top - editor.clientHeight / 2
      }
      mirror.scrollTop = editor.scrollTop
    }

    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [editorRef, mirrorRef, content])
}
