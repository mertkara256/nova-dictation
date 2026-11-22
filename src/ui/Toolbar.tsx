import { useEffect, useRef, useState } from 'react'
import { countWords } from '../core/text.ts'
import type { DownloadFormat } from './download.ts'
import { ClearIcon, CopyIcon, DownloadIcon } from './icons.tsx'

export type PanelName = 'notes' | 'commands' | 'history' | 'settings' | 'setup'

const DOWNLOAD_FORMATS: { format: DownloadFormat; label: string }[] = [
  { format: 'txt', label: 'Düz metin (.txt)' },
  { format: 'md', label: 'Markdown (.md)' },
]

interface ToolbarProps {
  text: string
  /** Komutlardan önce söylenen kelime; metin boşken ipucunda gösterilir. */
  wakeWord: string
  openPanel: PanelName | null
  onCopy(): void
  onDownload(format: DownloadFormat): void
  onClear(): void
  onTogglePanel(panel: PanelName): void
}

/** Metin alanının altındaki satır: kelime sayısı, metin işlemleri ve paneller. */
export function Toolbar({
  text,
  wakeWord,
  openPanel,
  onCopy,
  onDownload,
  onClear,
  onTogglePanel,
}: ToolbarProps) {
  // Kelimesi olmayan metin de (emoji, boş madde) kopyalanabilir, indirilebilir, temizlenebilir.
  const empty = !text.trim()
  const wordCount = countWords(text)

  return (
    <div className="toolbar">
      <p className={empty ? 'toolbar-info toolbar-hint' : 'toolbar-info'}>
        {empty ? `Komutlar “${wakeWord}” ile başlar` : `${wordCount} kelime`}
      </p>
      <div className="toolbar-actions">
        <button
          type="button"
          className="tool"
          aria-label="Metni kopyala"
          title="Metni kopyala"
          disabled={empty}
          onClick={onCopy}
        >
          <CopyIcon />
        </button>
        <DownloadMenu disabled={empty} onDownload={onDownload} />
        <button
          type="button"
          className="tool"
          aria-label="Metni temizle"
          title="Metni temizle"
          disabled={empty}
          onClick={onClear}
        >
          <ClearIcon />
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="tool"
          aria-pressed={openPanel === 'notes'}
          onClick={() => onTogglePanel('notes')}
        >
          Notlar
        </button>
        <button
          type="button"
          className="tool"
          aria-pressed={openPanel === 'history'}
          onClick={() => onTogglePanel('history')}
        >
          Geçmiş
        </button>
        <button
          type="button"
          className="tool"
          aria-pressed={openPanel === 'commands'}
          onClick={() => onTogglePanel('commands')}
        >
          Komutlar
        </button>
      </div>
    </div>
  )
}

interface DownloadMenuProps {
  disabled: boolean
  onDownload(format: DownloadFormat): void
}

/**
 * "İndir" düğmesi ve açılan biçim seçenekleri. Açılınca ilk seçenek odaklanır; ok
 * tuşlarıyla seçenekler arasında gezilir. Dışarı tıklayınca, Tab ile çıkınca ya da Esc ile kapanır;
 * Esc ya da seçimden sonra odak "İndir" düğmesine döner.
 */
function DownloadMenu({ disabled, onDownload }: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const visible = open && !disabled

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (visible) items()[0]?.focus()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [visible])

  return (
    <div
      ref={menuRef}
      className="menu"
      onBlur={(event) => {
        // Tab ile menüden çıkılınca kapanır.
        if (visible && !menuRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (!visible) return
        // Esc önce menüyü kapatsın; uygulama genelindeki Esc kısayoluna ulaşmasın.
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const list = items()
          const step = event.key === 'ArrowDown' ? 1 : -1
          const index = list.indexOf(document.activeElement as HTMLElement)
          list[(index + step + list.length) % list.length]?.focus()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="tool"
        aria-label="İndir"
        title="İndir"
        aria-haspopup="menu"
        aria-expanded={visible}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <DownloadIcon />
      </button>
      {visible && (
        <div className="menu-list" role="menu">
          {DOWNLOAD_FORMATS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                onDownload(format)
                close()
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
