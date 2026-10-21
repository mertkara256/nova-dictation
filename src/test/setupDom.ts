import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Her arayüz testinden sonra çizilen bileşenleri, kayıtları ve taklitleri
// temizle; testler birbirinin taslağını, ayarını ya da taklidini görmesin.
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
