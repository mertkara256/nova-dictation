import { describe, expect, it } from 'vitest'
import { shortcutFor } from './create-shortcut.ts'

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

  it('desteklenmeyen sistemde kısayol üretmez', () => {
    expect(shortcutFor('linux', '/home/a/nova-dictation')).toBeNull()
  })
})
