import { describe, expect, it } from 'vitest'
import { downloadFileName } from './download.ts'

describe('downloadFileName', () => {
  it('tarih ve saati içeren, uzantısı biçime uyan bir ad üretir', () => {
    const date = new Date(2026, 9, 5, 9, 7)
    expect(downloadFileName('txt', date)).toBe('nova-dictation-2026-10-05-0907.txt')
    expect(downloadFileName('md', date)).toBe('nova-dictation-2026-10-05-0907.md')
  })
})
