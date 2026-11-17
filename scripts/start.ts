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
import { whisperUrl } from './whisper-address.ts'

const STRIP_TYPES = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning']
const APP_URL = 'http://localhost:5173/'
const started: ChildProcess[] = []

// Uygulama zaten açıksa ikinci bir sunucu başlatılmaz, açık olan gösterilir. Port başka
// bir uygulamadaysa da başlatılmaz: notlar bu adrese bağlı olduğu için başka porta geçilemez.
const page = await fetch(APP_URL, { signal: AbortSignal.timeout(2000) }).then((response) => response.text(), () => null)
if (page !== null) {
  if (page.includes('<title>Nova Dictation</title>')) {
    console.log(`Nova zaten açık: ${APP_URL}`)
    openInBrowser(APP_URL)
    process.exit(0)
  }
  console.error(
    '5173 portunu başka bir uygulama kullanıyor. Notlar bu adrese bağlı olduğu için Nova başka bir portta açılmaz; o uygulamayı kapatıp yeniden deneyin.',
  )
  process.exit(1)
}

if (await createWhisperClient(whisperUrl()).status() === 'offline') {
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

/** Adresi varsayılan tarayıcıda açar. */
function openInBrowser(url: string) {
  if (process.platform === 'win32') spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
  else spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' })
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
