import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Range } from '../core/document.ts'
import { Composer } from './Composer.tsx'

// jsdom sayfa düzeni hesaplamaz: metin alanı uzun bir metinle dolmuş ve imleç
// alanın görünen kısmının çok altında gibi ölçüler verilir.
const EDITOR_HEIGHT = 300
const CONTENT_HEIGHT = 2000
const CARET_TOP = 1500

function stubLayout() {
  const proto = HTMLElement.prototype
  const scrollTops = new WeakMap<Element, number>()
  vi.spyOn(proto, 'scrollTop', 'get').mockImplementation(function (this: HTMLElement) {
    return scrollTops.get(this) ?? 0
  })
  vi.spyOn(proto, 'scrollTop', 'set').mockImplementation(function (this: HTMLElement, value: number) {
    scrollTops.set(this, value)
  })
  vi.spyOn(proto, 'scrollHeight', 'get').mockReturnValue(CONTENT_HEIGHT)
  vi.spyOn(proto, 'clientHeight', 'get').mockReturnValue(EDITOR_HEIGHT)
  vi.spyOn(proto, 'offsetHeight', 'get').mockReturnValue(20)
  vi.spyOn(proto, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('caret') ? CARET_TOP : 0
  })
}

function renderComposer(selection: Range | null) {
  render(
    <Composer
      text={'Uzun bir metin.\n'.repeat(100)}
      selection={selection}
      feedback={null}
      partial=""
      listening
      readLevel={() => 0}
      micAvailable
      onToggleMic={() => {}}
      onType={() => {}}
      onSelect={() => {}}
    />,
  )
  return document.querySelector('textarea')!
}

afterEach(() => vi.restoreAllMocks())

describe('metin alanı', () => {
  it('dikte sırasında imleç sondaysa en alta kaydırır', () => {
    stubLayout()
    expect(renderComposer(null).scrollTop).toBe(CONTENT_HEIGHT)
  })

  it('dikte sırasında imleç ortadaysa en alta değil imlecin olduğu yere kaydırır', () => {
    stubLayout()
    expect(renderComposer({ start: 800, end: 800 }).scrollTop).toBe(CARET_TOP - EDITOR_HEIGHT / 2)
  })
})
