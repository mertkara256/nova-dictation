import { describe, expect, it } from 'vitest'
import { checkWakeWord, findWakeWords, splitSyllables, wakeWordPattern } from './wakeWord.ts'

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

describe('findWakeWords', () => {
  const found = (wakeWord: string, text: string) =>
    findWakeWords(text, wakeWord).map(({ start, end, exact }) => ({ word: text.slice(start, end), exact }))

  it('uzun kelimelerde bir harflik yazım farkını da bulur', () => {
    expect(found('Jarvis', 'carvis, son cümleyi sil')).toEqual([{ word: 'carvis', exact: false }])
    expect(found('Jarvis', 'jarviz geri al')).toEqual([{ word: 'jarviz', exact: false }])
    expect(found('Asistan', 'asıstan, yeni satır')).toEqual([{ word: 'asıstan', exact: false }])
  })

  it('tam eşleşmeleri ayrıca işaretler', () => {
    expect(found('Jarvis', 'tamam. jarvis, geri al')).toEqual([{ word: 'jarvis', exact: true }])
    expect(found('Nova', 'no va, geri al')).toEqual([{ word: 'no va', exact: true }])
  })

  it('kelimenin ekli hallerini ve iki harften fazla farkı saymaz', () => {
    expect(found('Asistan', 'asistana söyle, asistanı gördüm')).toEqual([])
    expect(found('Jarvis', "jarvis'e sor, harvey geldi")).toEqual([])
  })

  it('kısa kelimelerde yazım farkına izin vermez', () => {
    // "Nova" 4 harf; "noa" gibi farkları kabul etmek normal kelimeleri komut sandırabilir.
    expect(found('Nova', 'noa, geri al. nowa, geri al')).toEqual([])
  })
})
