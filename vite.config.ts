import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { testRecordingsPlugin } from './scripts/test-recordings-plugin.ts'
import { WHISPER_ORIGIN, whisperGuardPlugin, whisperProxyPath } from './scripts/whisper-address.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), testRecordingsPlugin(), whisperGuardPlugin()],
  server: {
    // Notlar tarayıcıda adrese göre saklanır; başka bir porta geçilirse notlar
    // kaybolmuş gibi görünür. Bu yüzden 5173 doluysa sunucu başlamaz.
    port: 5173,
    strictPort: true,
    proxy: {
      // Yerel whisper.cpp sunucusu (npm run whisper); tarayıcı ona bu yol üzerinden ulaşır.
      // Sunucunun rastgele ön ekini yalnızca geliştirme sunucusu bilir.
      '/whisper': {
        target: WHISPER_ORIGIN,
        rewrite: (path) => whisperProxyPath(path),
      },
    },
  },
  preview: {
    // vite preview, kendi yönlendirmesi verilmezse yukarıdakini devralır; ama Whisper'ı
    // başka sitelerden koruyan whisperGuardPlugin yalnızca geliştirme sunucusunda çalışır.
    // Önizleme Whisper ile dikteyi desteklemez (npm start geliştirme sunucusunu kullanır).
    proxy: {},
  },
  test: {
    projects: [
      {
        // Mantık testleri (*.test.ts) doğrudan Node'da çalışır.
        extends: true,
        test: {
          name: 'mantık',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Arayüz testleri (*.test.tsx) sahte bir tarayıcı sayfasında (jsdom) çalışır.
        extends: true,
        test: {
          name: 'arayüz',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['src/test/setupDom.ts'],
        },
      },
    ],
  },
})
