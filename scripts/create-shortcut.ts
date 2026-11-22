/**
 * Masaüstüne, uygulamayı tek tıkla başlatan bir kısayol koyar (`npm run shortcut`).
 * Kısayol proje klasörüne gidip `npm start` çalıştırır; bağımlılıklar kurulu
 * değilse önce `npm install`. macOS ve Windows'ta çalışır.
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Shortcut {
  fileName: string
  content: string
}

/** Bu sistem için kısayol dosyasının adı ve içeriği; desteklenmeyen sistemde null. */
export function shortcutFor(platform: NodeJS.Platform, projectDir: string): Shortcut | null {
  switch (platform) {
    case 'darwin':
      return {
        fileName: 'Nova Dictation.command',
        content: [
          '#!/bin/zsh',
          "# Nova Dictation'ı Whisper sunucusuyla birlikte başlatır ve tarayıcıda açar.",
          '# Bu Terminal penceresini kapatınca ikisi de kapanır.',
          `cd '${projectDir.replaceAll("'", "'\\''")}' || exit 1`,
          '[ -d node_modules ] || npm install',
          'npm start',
          '',
        ].join('\n'),
      }
    case 'win32':
      return {
        fileName: 'Nova Dictation.cmd',
        content: [
          '@echo off',
          // Proje yolunda Türkçe karakter olabilir; satırlar UTF-8 okunsun.
          'chcp 65001 >nul',
          'rem Nova Dictation: Whisper sunucusunu ve uygulamayi baslatir, tarayicida acar.',
          'rem Bu pencere kapaninca ikisi de kapanir.',
          // .cmd dosyasında % değişken açar; yoldaki % karakteri %% yazılmalı.
          `cd /d "${projectDir.replaceAll('%', '%%')}" || exit /b 1`,
          'if not exist node_modules call npm install',
          'call npm start',
          '',
        ].join('\r\n'),
      }
    default:
      return null
  }
}

/**
 * Masaüstü klasörü. Windows'ta OneDrive'a taşınmış olabileceği için Windows'a sorulur;
 * PowerShell çalışmazsa ya da yanıt boşsa kullanıcı klasöründeki Desktop kullanılır.
 */
export function desktopDir(platform: NodeJS.Platform = process.platform): string {
  const fallback = join(homedir(), 'Desktop')
  if (platform !== 'win32') return fallback
  const command =
    "[Console]::OutputEncoding = [Text.Encoding]::UTF8; [Environment]::GetFolderPath('Desktop')"
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}

// Testler shortcutFor'u kullanırken dosya yazılmasın; yalnızca doğrudan çalıştırılınca yazılır.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const shortcut = shortcutFor(process.platform, process.cwd())
  if (!shortcut) {
    console.error('Bu sistem için masaüstü kısayolu yok; uygulamayı "npm start" ile başlatın.')
    process.exit(1)
  }
  const file = join(desktopDir(), shortcut.fileName)
  writeFileSync(file, shortcut.content)
  if (process.platform !== 'win32') chmodSync(file, 0o755)
  console.log(`Kısayol oluşturuldu: ${file}`)
}
