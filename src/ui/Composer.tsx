import { useLayoutEffect, useRef } from 'react'
import type { Range } from '../core/document.ts'
import type { EditorFeedback } from '../core/feedback.ts'
import { MicIcon } from './icons.tsx'
import { MIC_SHORTCUT_LABEL } from './shortcuts.ts'
import { useAutoGrow } from './useAutoGrow.ts'
import { useTransient } from './useTransient.ts'
import { VoiceMeter } from './VoiceMeter.tsx'

// Yansımanın son satırı boş olsa bile yüksekliği olsun diye eklenen görünmez karakter.
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b)
const REMOVED_FLASH_MS = 1200

interface ComposerProps {
  text: string
  selection: Range | null
  /** Son komutun sonucu; silinen metin kısa süre kırmızı gösterilir. */
  feedback: EditorFeedback | null
  /** Konuşma tanımadan gelen, henüz kesinleşmemiş metin. */
  partial: string
  listening: boolean
  /** Ses göstergesi için mikrofonun son ses seviyesini verir. */
  readLevel(): number
  micAvailable: boolean
  onToggleMic(): void
  onType(text: string, selection: Range): void
  onSelect(selection: Range): void
}

/** Metin alanı ve yanındaki mikrofon düğmesi. */
export function Composer({
  text,
  selection,
  feedback,
  partial,
  listening,
  readLevel,
  micAvailable,
  onToggleMic,
  onType,
  onSelect,
}: ComposerProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  // İmleç metnin sonundaysa ara metin ve silme vurgusu yazının devamında gösterilir.
  const atEnd = selection === null
  const deletion = feedback?.type === 'deleted' ? feedback : null
  const flashing = useTransient(deletion?.id ?? null, REMOVED_FLASH_MS)
  const removed =
    atEnd && flashing && deletion?.at === text.length ? withSeparator(text, deletion.removed) : ''
  const ghost = atEnd && partial ? withSeparator(text + removed, partial) : ''
  useAutoGrow(editorRef, mirrorRef, text + removed + ghost)

  // Sesli komutların taşıdığı imleci ve seçimi metin alanına da yansıt.
  useLayoutEffect(() => {
    const element = editorRef.current
    if (!element) return
    const start = selection?.start ?? text.length
    const end = selection?.end ?? text.length
    if (element.selectionStart !== start || element.selectionEnd !== end) {
      element.setSelectionRange(start, end)
    }
  }, [selection, text])

  return (
    <>
      <div className="composer">
        <div className="editor-area">
          {/* Metin alanının arkasındaki yansıma: aynı metni görünmez yazar; imleci,
              seçimi, silinen cümleyi ve ara metni gösterir. */}
          <div ref={mirrorRef} className="editor-mirror" aria-hidden="true">
            {selection ? <MirroredSelection text={text} selection={selection} /> : text}
            {removed && (
              <span key={deletion?.id} className="removed">
                {removed}
              </span>
            )}
            <span className="ghost">{ghost}</span>
            {ZERO_WIDTH_SPACE}
          </div>
          <textarea
            ref={editorRef}
            className="editor"
            rows={1}
            aria-label="Metin"
            placeholder={ghost || removed ? '' : 'Yaz ya da mikrofona basıp konuş…'}
            value={text}
            onChange={(event) => onType(event.target.value, rangeOf(event.target))}
            onSelect={(event) => onSelect(rangeOf(event.currentTarget))}
            onScroll={(event) => {
              if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop
            }}
          />
        </div>
        {listening && <VoiceMeter readLevel={readLevel} />}
        <button
          type="button"
          className="mic"
          aria-label="Mikrofon"
          aria-pressed={listening}
          title={`${listening ? 'Mikrofonu kapat' : 'Mikrofonu aç'} (${MIC_SHORTCUT_LABEL})`}
          disabled={!micAvailable}
          onClick={onToggleMic}
        >
          <MicIcon />
        </button>
      </div>
      {/* İmleç metnin ortasındayken ara metin yazının içinde değil, burada görünür. */}
      {!atEnd && partial && <p className="pending">{partial}</p>}
    </>
  )
}

/** Yansımada imleci ince bir çizgiyle, seçimi vurguyla gösterir. */
function MirroredSelection({ text, selection }: { text: string; selection: Range }) {
  const { start, end } = selection
  return (
    <>
      {text.slice(0, start)}
      {start === end ? (
        <span className="caret" />
      ) : (
        <mark className="selection">{text.slice(start, end)}</mark>
      )}
      {text.slice(end)}
    </>
  )
}

function rangeOf(element: HTMLTextAreaElement): Range {
  return { start: element.selectionStart, end: element.selectionEnd }
}

/** Eklenen metnin öncesine, gerekiyorsa bir boşluk koyar. */
function withSeparator(before: string, addition: string) {
  return (before && !/\s$/.test(before) ? ' ' : '') + addition
}
