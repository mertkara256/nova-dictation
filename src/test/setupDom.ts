import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Her arayüz testinden sonra çizilen bileşenleri ve kayıtları temizle; testler
// birbirinin taslağını ya da ayarını görmesin.
afterEach(() => {
  cleanup()
  localStorage.clear()
})
