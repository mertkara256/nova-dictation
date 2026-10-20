/**
 * Yerel whisper.cpp sunucusunu başlatır (`npm run whisper`). macOS, Linux ve
 * Windows'ta çalışır; kurulum için README'deki "Whisper kurulumu" bölümüne bakın.
 *
 * Klasörler ortam değişkenleriyle değiştirilebilir: WHISPER_DIR, WHISPER_MODELS_DIR,
 * WHISPER_MODEL; sunucu programı başka bir yerdeyse tam yolu WHISPER_SERVER ile verilir.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const whisperDir = process.env.WHISPER_DIR ?? join(homedir(), 'Developer', 'whisper.cpp')
const modelsDir = process.env.WHISPER_MODELS_DIR ?? join(homedir(), 'Developer', 'whisper-models')
const model = join(modelsDir, process.env.WHISPER_MODEL ?? 'ggml-large-v3-turbo-q5_0.bin')
const vadModel = join(modelsDir, 'ggml-silero-v5.1.2.bin')

// Derleme yöntemine göre program farklı yerde olur; Windows'ta Visual Studio ile
// derlenince build/bin/Release altına yazılır.
const serverCandidates = process.env.WHISPER_SERVER
  ? [process.env.WHISPER_SERVER]
  : [
      join(whisperDir, 'build', 'bin', 'whisper-server'),
      join(whisperDir, 'build', 'bin', 'whisper-server.exe'),
      join(whisperDir, 'build', 'bin', 'Release', 'whisper-server.exe'),
    ]

const server = serverCandidates.find((path) => existsSync(path))
if (!server) fail(`whisper-server bulunamadı. Bakılan yerler:\n  ${serverCandidates.join('\n  ')}`)
for (const file of [model, vadModel]) {
  if (!existsSync(file)) fail(`Model dosyası bulunamadı: ${file}`)
}

const child = spawn(
  server,
  ['-m', model, '--vad', '-vm', vadModel, '-l', 'tr', '--host', '127.0.0.1', '--port', '8178'],
  { stdio: 'inherit' },
)
child.on('error', (error) => fail(`whisper-server başlatılamadı: ${error.message}`))
child.on('exit', (code) => process.exit(code ?? 0))
// Terminal kapatılınca ya da Ctrl+C'ye basılınca sunucu da kapansın.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => child.kill(signal))
}

function fail(message: string): never {
  console.error(message)
  console.error('README\'deki "Whisper kurulumu" adımlarını izleyin.')
  process.exit(1)
}
