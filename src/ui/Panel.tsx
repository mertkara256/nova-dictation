import { type ReactNode, useId } from 'react'

interface PanelProps {
  title: string
  onClose(): void
  children: ReactNode
}

/** Metnin altında açılan bilgi paneli (komut listesi, komut geçmişi). */
export function Panel({ title, onClose, children }: PanelProps) {
  const titleId = useId()
  return (
    <section className="panel" aria-labelledby={titleId}>
      <header className="panel-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="link-button" onClick={onClose}>
          Kapat
        </button>
      </header>
      {children}
    </section>
  )
}
