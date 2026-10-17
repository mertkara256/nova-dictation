import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommandLogEntry } from '../core/editor.ts'
import { CommandHistory } from './CommandHistory.tsx'

const at = new Date(2026, 9, 15, 9, 30, 5).getTime()

const log: CommandLogEntry[] = [
  {
    id: 1,
    at,
    via: 'voice',
    source: 'Nova, son cümleyi sil',
    detail: { type: 'deleted', what: 'sentence', removed: 'Gündem hazır.', at: 0 },
  },
  { id: 2, at, via: 'voice', source: 'Nova, onuncu satıra git', detail: { type: 'missing', what: 'line' } },
  { id: 3, at, via: 'button', source: 'Temizle düğmesi', detail: { type: 'deleted', what: 'all', removed: '', at: 0 } },
  { id: 4, at, via: 'voice', source: 'Nova, yeni satır', detail: null },
]

describe('komut geçmişi', () => {
  it('henüz komut yoksa seçilen komut kelimesiyle açıklama yapar', () => {
    render(<CommandHistory log={[]} wakeWord="Asistan" onClose={vi.fn()} />)
    expect(screen.getByText(/“Asistan” ile başlayan komutlar/)).toBeTruthy()
  })

  it('komutları en yenisi üstte, saati ve sonucuyla listeler', () => {
    render(<CommandHistory log={log} wakeWord="Nova" onClose={vi.fn()} />)
    const rows = screen.getAllByRole('listitem').map((row) => row.textContent)
    expect(rows).toEqual([
      '09:30:05“Nova, yeni satır”Uygulandı.',
      '09:30:05Temizle düğmesiTüm metin silindi.',
      '09:30:05“Nova, onuncu satıra git”Böyle bir satır yok.',
      '09:30:05“Nova, son cümleyi sil”Cümle silindi: “Gündem hazır.”',
    ])
  })

  it('yapılamayan komutları ayrıca işaretler', () => {
    render(<CommandHistory log={log} wakeWord="Nova" onClose={vi.fn()} />)
    expect(screen.getByText('Böyle bir satır yok.').classList.contains('failed')).toBe(true)
    expect(screen.getByText('Tüm metin silindi.').classList.contains('failed')).toBe(false)
  })
})
