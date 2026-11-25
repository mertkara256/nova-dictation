import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorFeedback } from '../core/feedback.ts'
import { CommandToast } from './CommandToast.tsx'

const deleted = (id: number): EditorFeedback => ({ id, type: 'deleted', what: 'sentence', removed: 'Bir.', at: 0 })

function renderToast(feedback: EditorFeedback | null, onApplyCommand = () => {}) {
  return render(<CommandToast feedback={feedback} onUndo={() => {}} onRedo={() => {}} onApplyCommand={onApplyCommand} />)
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const undoButton = () => screen.queryByRole('button', { name: 'Geri al' })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('komut bildirimi', () => {
  it('odak düğmedeyken kalkmaz; odak ayrılınca süre yeniden işler', async () => {
    renderToast(deleted(1))
    const button = undoButton()!
    act(() => button.focus())

    await advance(7000)
    expect(undoButton()).toBe(button)
    expect(document.activeElement).toBe(button)

    act(() => button.blur())
    await advance(5000)
    expect(undoButton()).toBeTruthy()
    await advance(1000)
    expect(undoButton()).toBeNull()
  })

  it('fare üzerindeyken kalkmaz', async () => {
    renderToast(deleted(1))
    fireEvent.mouseEnter(screen.getByRole('status'))
    await advance(7000)
    expect(undoButton()).toBeTruthy()

    fireEvent.mouseLeave(screen.getByRole('status'))
    await advance(6000)
    expect(undoButton()).toBeNull()
  })

  it('odaktaki düğme kaybolduktan sonra gelen bildirim de süresi dolunca kalkar', async () => {
    const { rerender } = renderToast(deleted(1))
    act(() => undoButton()!.focus())
    // Düğmesi olmayan bir bildirim geldi; odaktaki düğme sayfadan kalktı.
    rerender(<CommandToast feedback={{ id: 2, type: 'selection-cleared' }} onUndo={() => {}} onRedo={() => {}} onApplyCommand={() => {}} />)
    rerender(<CommandToast feedback={deleted(3)} onUndo={() => {}} onRedo={() => {}} onApplyCommand={() => {}} />)

    await advance(6000)
    expect(undoButton()).toBeNull()
  })

  it('komut önerisinde "Komut olarak uygula" düğmesi bildirimin kimliğiyle çağırır', () => {
    const onApplyCommand = vi.fn()
    renderToast({ id: 4, type: 'command-suggestion', phrase: 'Son cümleyi sil.' }, onApplyCommand)
    expect(screen.getByRole('status').textContent).toContain('Metin olarak eklendi: “Son cümleyi sil.”')
    fireEvent.click(screen.getByRole('button', { name: 'Komut olarak uygula' }))
    expect(onApplyCommand).toHaveBeenCalledExactlyOnceWith(4)
  })
})
