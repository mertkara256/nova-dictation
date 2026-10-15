import { useEffect, useRef, useState } from 'react'
import type { DownloadFormat } from './download.ts'
import { ClearIcon, CopyIcon, DownloadIcon } from './icons.tsx'

export type PanelName = 'commands' | 'history'

const DOWNLOAD_FORMATS: { format: DownloadFormat; label: string }[] = [
  { format: 'txt', label: 'Düz metin (.txt)' },
  { format: 'md', label: 'Markdown (.md)' },
]

interface ToolbarProps {
  wordCount: number
  openPanel: PanelName | null
  onCopy(): void
  onDownload(format: DownloadFormat): void
  onClear(): void
  onTogglePanel(panel: PanelName): void
}

/** Metin alanının altındaki satır: kelime sayısı, metin işlemleri ve paneller. */
export function Toolbar({
  wordCount,
  openPanel,
  onCopy,
  onDownload,
  onClear,
  onTogglePanel,
}: ToolbarProps) {
  const empty = wordCount === 0

  return (
    <div className="toolbar">
      <p className="toolbar-info" aria-live="polite">
        {empty ? 'Komutlar “Nova” ile başlar' : `${wordCount} kelime`}
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

/** "İndir" düğmesi ve açılan biçim seçenekleri. Dışarı tıklayınca ya da Esc ile kapanır. */
function DownloadMenu({ disabled, onDownload }: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const visible = open && !disabled

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
      onKeyDown={(event) => {
        // Esc önce menüyü kapatsın; uygulama genelindeki Esc kısayoluna ulaşmasın.
        if (event.key === 'Escape' && visible) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
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
                setOpen(false)
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
