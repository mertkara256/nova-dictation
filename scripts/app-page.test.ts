import { describe, expect, it } from 'vitest'
import { isFromAppPage } from './app-page.ts'

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
