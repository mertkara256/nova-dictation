import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveRecording } from './test-recordings-plugin.ts'

describe('saveRecording', () => {
  let dir = ''
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nova-kayit-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  function form(name: string) {
    const data = new FormData()
    data.append('name', name)
    data.append('info', JSON.stringify({ expectedText: 'Toplantı yarın.' }))
    data.append('audio', new Blob([new Uint8Array([1, 2, 3])]), 'kayit.wav')
    return data
  }

  it('sesi ve bilgilerini tarih ve adla yazar', async () => {
    const file = await saveRecording(dir, form('E-posta 1'), new Date(2026, 9, 17, 9, 30, 5))
    expect(file).toBe('2026-10-17-093005-e-posta-1.wav')
    expect([...(await readFile(join(dir, file)))]).toEqual([1, 2, 3])
    expect(JSON.parse(await readFile(join(dir, '2026-10-17-093005-e-posta-1.json'), 'utf8'))).toEqual({
      expectedText: 'Toplantı yarın.',
    })
  })

  it('addaki klasör ve nokta karakterlerini dosya adından çıkarır', async () => {
    const file = await saveRecording(dir, form('../../gizli.wav'), new Date(2026, 9, 17, 9, 30, 5))
    expect(file).toBe('2026-10-17-093005-gizli-wav.wav')
    expect(await readdir(dir)).toHaveLength(2)
  })

  it('ses ya da bilgi eksikse yazmaz', async () => {
    const data = new FormData()
    data.append('info', '{}')
    await expect(saveRecording(dir, data)).rejects.toThrow('eksik')
    expect(await readdir(dir)).toEqual([])
  })
})
