/**
 * Uygulamayı tek komutla başlatır (`npm start`): Whisper sunucusu çalışmıyorsa
 * arka planda başlatır, geliştirme sunucusunu açar ve uygulamayı tarayıcıda
 * gösterir. Pencere kapanınca ya da Ctrl+C'ye basılınca başlattıklarını da
 * kapatır. Masaüstü kısayolu (`npm run shortcut`) bu komutu çalıştırır.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { openSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWhisperClient } from '../src/speech/whisperClient.ts'

const STRIP_TYPES = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning']
const started: ChildProcess[] = []

if (await createWhisperClient('http://127.0.0.1:8178').status() === 'offline') {
  const logFile = join(tmpdir(), 'nova-whisper.log')
  const log = openSync(logFile, 'w')
  const whisper = spawn(process.execPath, [...STRIP_TYPES, join('scripts', 'whisper-server.ts')], {
    stdio: ['ignore', log, log],
  })
  whisper.on('exit', (code) => {
    if (code) {
      console.log(
        `Whisper başlatılamadı (ayrıntılar: ${logFile}); uygulama tarayıcının konuşma tanımasıyla çalışır.`,
      )
    }
  })
  started.push(whisper)
}

const vite = spawn(process.execPath, [join('node_modules', 'vite', 'bin', 'vite.js'), '--open'], {
  stdio: 'inherit',
})
started.push(vite)

vite.on('exit', (code) => {
  stopAll()
  process.exit(code ?? 0)
})
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    stopAll()
    process.exit(0)
  })
}

/** Başlatılan süreçleri, onların başlattıklarıyla birlikte kapatır. */
function stopAll() {
  for (const child of started) {
    if (child.exitCode !== null || child.pid === undefined) continue
    // Windows'ta bir süreci kapatmak onun açtıklarını kapatmaz; ağaç olarak kapatılır.
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      child.kill('SIGTERM')
    }
  }
}
