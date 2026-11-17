import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isFromAppPage, saveRecording } from './test-recordings-plugin.ts'

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

describe('isFromAppPage', () => {
  it('uygulamanın kendi sayfasından gelen isteği kabul eder', () => {
    for (const host of ['localhost:5173', '127.0.0.1:5173', '[::1]:5173']) {
      expect(isFromAppPage({ host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' })).toBe(true)
    }
  })

  it('tarayıcı dışından gelen isteği kabul eder', () => {
    expect(isFromAppPage({ host: 'localhost:5173' })).toBe(true)
  })

  it('başka bir siteden gönderilen formu reddeder', () => {
    expect(
      isFromAppPage({ host: 'localhost:5173', origin: 'https://ornek.com', 'sec-fetch-site': 'cross-site' }),
    ).toBe(false)
    // Sec-Fetch-Site göndermeyen eski tarayıcılar
    expect(isFromAppPage({ host: 'localhost:5173', origin: 'https://ornek.com' })).toBe(false)
  })

  it('bilgisayardaki başka bir uygulamanın sayfasından gelen isteği reddeder', () => {
    expect(
      isFromAppPage({ host: 'localhost:5173', origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site' }),
    ).toBe(false)
    expect(isFromAppPage({ host: 'localhost:5173', origin: 'http://localhost:3000' })).toBe(false)
  })

  it('bilgisayara yönlendirilmiş yabancı bir alan adını reddeder', () => {
    // Alan adı 127.0.0.1'e yönlendirilince tarayıcı isteği aynı sitedenmiş gibi gönderir.
    expect(
      isFromAppPage({ host: 'ornek.com:5173', origin: 'http://ornek.com:5173', 'sec-fetch-site': 'same-origin' }),
    ).toBe(false)
  })

  it('adresi okunamayan isteği reddeder', () => {
    expect(isFromAppPage({ host: 'localhost:5173', origin: 'null' })).toBe(false)
  })
})
