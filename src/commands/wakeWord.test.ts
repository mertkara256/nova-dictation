import { describe, expect, it } from 'vitest'
import { checkWakeWord, splitSyllables, wakeWordPattern } from './wakeWord.ts'

function matches(wakeWord: string, text: string) {
  return [...text.matchAll(wakeWordPattern(wakeWord))].map((match) => match[0])
}

describe('checkWakeWord', () => {
  it('geçerli kelimeyi baş harfi büyük olarak döner', () => {
    expect(checkWakeWord('  asistan ')).toEqual({ ok: true, word: 'Asistan' })
    expect(checkWakeWord('ırmak')).toEqual({ ok: true, word: 'Irmak' })
    expect(checkWakeWord('İPEK')).toEqual({ ok: true, word: 'İpek' })
  })

  it('boş, birden fazla kelimeli, harf dışı ya da çok kısa girdiyi reddeder', () => {
    expect(checkWakeWord('   ')).toMatchObject({ ok: false })
    expect(checkWakeWord('hey nova')).toMatchObject({ ok: false })
    expect(checkWakeWord('nova2')).toMatchObject({ ok: false })
    expect(checkWakeWord('ai')).toMatchObject({ ok: false, error: 'En az 3 harf olmalı.' })
    expect(checkWakeWord('a'.repeat(21))).toMatchObject({ ok: false })
  })
})

describe('splitSyllables', () => {
  it('kelimeyi Türkçe hece kuralıyla böler', () => {
    expect(splitSyllables('nova')).toEqual(['no', 'va'])
    expect(splitSyllables('asistan')).toEqual(['a', 'sis', 'tan'])
    expect(splitSyllables('saat')).toEqual(['sa', 'at'])
    expect(splitSyllables('jarvis')).toEqual(['jar', 'vis'])
    expect(splitSyllables('brr')).toEqual(['brr'])
  })
})

describe('wakeWordPattern', () => {
  it('kelimeyi tek başına ya da hecelerine bölünmüş halde bulur', () => {
    expect(matches('Nova', 'nova, son cümleyi sil')).toEqual(['nova'])
    expect(matches('Nova', 'no va son cümleyi sil')).toEqual(['no va'])
    expect(matches('Asistan', 'tamam. asis tan, yeni satır')).toEqual(['asis tan'])
  })

  it('başka bir kelimenin parçası olarak geçtiğinde saymaz', () => {
    expect(matches('Nova', "nova'ya sordum, novalar, süpernova")).toEqual([])
    expect(matches('Ada', 'kanada, adalar')).toEqual([])
  })
})
