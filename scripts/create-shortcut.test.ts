import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { desktopDir, shortcutFor } from './create-shortcut.ts'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }))

describe('shortcutFor', () => {
  it("macOS'ta proje klasörüne gidip npm start çalıştıran bir .command dosyası üretir", () => {
    const shortcut = shortcutFor('darwin', '/Users/ayse/Belgeler/nova-dictation')
    expect(shortcut?.fileName).toBe('Nova Dictation.command')
    expect(shortcut?.content.split('\n')).toEqual(
      expect.arrayContaining([
        '#!/bin/zsh',
        "cd '/Users/ayse/Belgeler/nova-dictation' || exit 1",
        '[ -d node_modules ] || npm install',
        'npm start',
      ]),
    )
  })

  it('klasör adındaki tek tırnağı kabuk için kaçırır', () => {
    const shortcut = shortcutFor('darwin', "/Users/a/Mert'in projeleri")
    expect(shortcut?.content).toContain("cd '/Users/a/Mert'\\''in projeleri' || exit 1")
  })

  it("Windows'ta Türkçe karakterli yollarla da çalışan bir .cmd dosyası üretir", () => {
    const shortcut = shortcutFor('win32', 'C:\\Users\\Şule\\nova-dictation')
    expect(shortcut?.fileName).toBe('Nova Dictation.cmd')
    const lines = shortcut?.content.split('\r\n') ?? []
    // Kod sayfası, yolu içeren satırdan önce UTF-8 yapılmalı.
    expect(lines.indexOf('chcp 65001 >nul')).toBeLessThan(
      lines.indexOf('cd /d "C:\\Users\\Şule\\nova-dictation" || exit /b 1'),
    )
    expect(lines).toEqual(expect.arrayContaining(['if not exist node_modules call npm install', 'call npm start']))
  })

  it('Windows yolundaki % karakterini .cmd için %% yazar', () => {
    const shortcut = shortcutFor('win32', 'C:\\Users\\a\\%100 proje')
    expect(shortcut?.content.split('\r\n')).toContain('cd /d "C:\\Users\\a\\%%100 proje" || exit /b 1')
  })

  it('desteklenmeyen sistemde kısayol üretmez', () => {
    expect(shortcutFor('linux', '/home/a/nova-dictation')).toBeNull()
  })
})

describe('desktopDir', () => {
  const fallback = join(homedir(), 'Desktop')

  it("Windows'ta masaüstü klasörünü PowerShell'e sorar", () => {
    vi.mocked(execFileSync).mockReturnValueOnce('D:\\OneDrive\\Masaüstü\r\n')
    expect(desktopDir('win32')).toBe('D:\\OneDrive\\Masaüstü')
  })

  it("PowerShell çalışmazsa kullanıcı klasöründeki Desktop'a düşer", () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw new Error('powershell bulunamadı')
    })
    expect(desktopDir('win32')).toBe(fallback)
  })

  it("PowerShell boş yanıt verirse kullanıcı klasöründeki Desktop'a düşer", () => {
    vi.mocked(execFileSync).mockReturnValueOnce('\r\n')
    expect(desktopDir('win32')).toBe(fallback)
  })

  it("macOS'ta PowerShell'e sormadan kullanıcı klasöründeki Desktop'u verir", () => {
    vi.mocked(execFileSync).mockClear()
    expect(desktopDir('darwin')).toBe(fallback)
    expect(execFileSync).not.toHaveBeenCalled()
  })
})
