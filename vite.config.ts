import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { testRecordingsPlugin } from './scripts/test-recordings-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), testRecordingsPlugin()],
  server: {
    // Notlar tarayıcıda adrese göre saklanır; başka bir porta geçilirse notlar
    // kaybolmuş gibi görünür. Bu yüzden 5173 doluysa sunucu başlamaz.
    port: 5173,
    strictPort: true,
    proxy: {
      // Yerel whisper.cpp sunucusu (npm run whisper); tarayıcı ona bu yol üzerinden ulaşır.
      '/whisper': {
        target: 'http://127.0.0.1:8178',
        rewrite: (path) => path.replace(/^\/whisper/, ''),
      },
    },
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
