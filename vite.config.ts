import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Yerel whisper.cpp sunucusu (npm run whisper); tarayıcı ona bu yol üzerinden ulaşır.
      '/whisper': {
        target: 'http://127.0.0.1:8178',
        rewrite: (path) => path.replace(/^\/whisper/, ''),
      },
      // Canlı önizleme için yerel Nemotron sunucusu (npm run nemotron).
      '/nemotron': {
        target: 'ws://127.0.0.1:8179',
        ws: true,
        rewrite: () => '/',
      },
    },
  },
})
