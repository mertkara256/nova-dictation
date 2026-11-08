import { describe, expect, it } from 'vitest'
import type { Doc } from './document.ts'
import {
  addBullets,
  clearSelection,
  deleteAll,
  deleteLine,
  deleteParagraph,
  deletePhrase,
  deleteSentence,
  deleteWords,
  insertBreak,
  insertMark,
  insertText,
  moveToBullet,
  moveToEdge,
  moveToLine,
  moveToParagraph,
  moveToPhrase,
  moveToSentenceEdge,
  replacePhrase,
  rewriteRange,
  selectAll,
  selectBetween,
  selectParagraph,
  selectPhrase,
  selectRange,
  selectSentence,
  selectWords,
} from './operations.ts'

/** İmleci "|" ile, seçimi "[" ve "]" ile gösteren kısa yazımdan belge oluşturur. */
function doc(marked: string): Doc {
  const caret = marked.indexOf('|')
  if (caret !== -1) {
    const text = marked.replace('|', '')
    return { text, selection: caret === text.length ? null : { start: caret, end: caret } }
  }
  const start = marked.indexOf('[')
  if (start !== -1) {
    const end = marked.indexOf(']') - 1
    return { text: marked.replace('[', '').replace(']', ''), selection: { start, end } }
  }
  return { text: marked, selection: null }
}

/** Belgeyi aynı kısa yazımla geri yazar. */
function show(value: Doc | null | undefined): string | null {
  if (!value) return null
  const { text, selection } = value
  if (!selection) return text
  if (selection.start === selection.end) {
    return `${text.slice(0, selection.start)}|${text.slice(selection.start)}`
  }
  return `${text.slice(0, selection.start)}[${text.slice(selection.start, selection.end)}]${text.slice(selection.end)}`
}

describe('insertText', () => {
  it('imleç yoksa metnin sonuna, araya boşluk koyarak yazar', () => {
    expect(show(insertText(doc('Toplantı yarın.'), 'Gündem hazır.')?.doc)).toBe(
      'Toplantı yarın. Gündem hazır.',
    )
  })

  it('imlecin olduğu yere yazar ve imleci yazılanın sonuna taşır', () => {
    expect(show(insertText(doc('Bir |üç.'), 'iki')?.doc)).toBe('Bir iki| üç.')
  })

  it('seçili metnin yerine yazar', () => {
    expect(show(insertText(doc('Toplantı [yarın] saat onda.'), 'perşembe')?.doc)).toBe(
      'Toplantı perşembe| saat onda.',
    )
  })

  it('arkasından aynı cümle devam ediyorsa duraklamada konan noktayı atar', () => {
    expect(show(insertText(doc('Toplantı [yarın] saat onda.'), 'Perşembe.')?.doc)).toBe(
      'Toplantı Perşembe| saat onda.',
    )
    expect(show(insertText(doc('Merhaba|, nasılsın?'), 'Ayşe.')?.doc)).toBe('Merhaba Ayşe|, nasılsın?')
  })

  it('yeni bir cümle ya da satırdan önce noktayı, ortada üç noktayı korur', () => {
    expect(show(insertText(doc('|Toplantı yarın.'), 'Bence.')?.doc)).toBe('Bence.| Toplantı yarın.')
    expect(show(insertText(doc('- |\n- '), 'Bütçe.')?.doc)).toBe('- Bütçe.\n- ')
    expect(show(insertText(doc('Bir |üç.'), 'iki...')?.doc)).toBe('Bir iki...| üç.')
  })

  it('noktalamayla başlayan parçanın önüne boşluk koymaz', () => {
    expect(show(insertText(doc('Merhaba'), ', dünya')?.doc)).toBe('Merhaba, dünya')
  })

  it('boş maddeleri sırayla doldurur', () => {
    let current = addBullets(doc('Gündem:'), 3)
    current = insertText(current, 'Bütçe')?.doc ?? current
    current = insertText(current, 'Takvim')?.doc ?? current
    expect(show(current)).toBe('Gündem:\n- Bütçe\n- Takvim\n- ')
  })

  it('boş parçayı yok sayar', () => {
    expect(insertText(doc('Merhaba'), '  ')).toBeNull()
  })
})

describe('insertBreak ve insertMark', () => {
  it('yeni satır ve yeni paragraf ekler', () => {
    expect(show(insertBreak(doc('Merhaba. '), 'line'))).toBe('Merhaba.\n')
    expect(show(insertBreak(doc('Merhaba.'), 'paragraph'))).toBe('Merhaba.\n\n')
  })

  it('noktalama işaretini önceki kelimeye bitiştirir', () => {
    expect(show(insertMark(doc('Merhaba '), '.'))).toBe('Merhaba.')
    expect(show(insertMark(doc('Merhaba| dünya'), ','))).toBe('Merhaba,| dünya')
  })

  it('açılan tırnak ve parantezi önceki kelimeden ayırır, sonraki dikteyi bitiştirir', () => {
    expect(show(insertMark(doc('Dedi ki'), '“'))).toBe('Dedi ki “')
    expect(show(insertMark(doc('Bugün |hava'), '('))).toBe('Bugün (|hava')
    expect(show(insertMark(doc('Merhaba.'), '('))).toBe('Merhaba. (')
    expect(show(insertText(doc('Dedi ki “'), 'Merhaba.')?.doc)).toBe('Dedi ki “Merhaba.')
    expect(show(insertMark(doc('Dedi ki “Merhaba.'), '”'))).toBe('Dedi ki “Merhaba”')
  })

  it('tireyi iki yanındaki kelimeye bitiştirir', () => {
    expect(show(insertText(insertMark(doc('Ankara.'), '-'), 'İstanbul')?.doc)).toBe('Ankara-İstanbul')
  })

  it('duraklamada konan noktanın, soru ya da ünlem işaretinin yerine geçer', () => {
    expect(show(insertMark(doc('Merhaba.'), ','))).toBe('Merhaba,')
    expect(show(insertMark(doc('Nasılsın. '), '?'))).toBe('Nasılsın?')
    expect(show(insertMark(doc('Merhaba.| Dünya'), ':'))).toBe('Merhaba:| Dünya')
    expect(show(insertMark(doc('Merhaba.'), '.'))).toBe('Merhaba.')
    expect(show(insertMark(doc('Nasılsın?'), '?'))).toBe('Nasılsın?')
    expect(show(insertMark(doc('Nasılsın?'), ','))).toBe('Nasılsın,')
    expect(show(insertMark(doc('Harika!'), '!'))).toBe('Harika!')
    expect(show(insertMark(doc('Merhaba,'), ','))).toBe('Merhaba,')
    expect(show(insertMark(doc('Merhaba,'), '.'))).toBe('Merhaba.')
  })

  it('üç noktayı ve art arda yazılmış işaretleri korur', () => {
    expect(show(insertMark(doc('Bekle...'), ','))).toBe('Bekle...,')
    expect(show(insertMark(doc('Ne?!'), ','))).toBe('Ne?!,')
  })
})

describe('addBullets', () => {
  it('metnin altına boş maddeler ekleyip imleci ilkine taşır', () => {
    expect(show(addBullets(doc('Gündem:'), 3))).toBe('Gündem:\n- |\n- \n- ')
  })

  it('imlecin olduğu satırın altına ekler', () => {
    expect(show(addBullets(doc('Başlık|\nSon satır'), 2))).toBe('Başlık\n- |\n- \nSon satır')
  })
})

describe('replacePhrase', () => {
  it('ifadenin son geçtiği yeri değiştirir', () => {
    expect(show(replacePhrase(doc('Yarın gel, yarın konuşuruz.'), 'yarın', 'perşembe')?.doc)).toBe(
      'Yarın gel, perşembe konuşuruz.',
    )
  })

  it('büyük harfle başlayan kelimenin yerine de büyük harfle yazar', () => {
    expect(replacePhrase(doc('İstanbul güzel.'), 'istanbul', 'ankara')?.doc.text).toBe('Ankara güzel.')
  })

  it('ifade bulunamazsa null döner', () => {
    expect(replacePhrase(doc('Merhaba'), 'dünya', 'evren')).toBeNull()
  })

  it('kesme işaretiyle eklenmiş eki korur, yalnızca kelimeyi değiştirir', () => {
    expect(replacePhrase(doc("Ankara'ya gidiyorum."), 'ankara', 'izmir')?.doc.text).toBe(
      "İzmir'ya gidiyorum.",
    )
  })
})

describe('kesme işaretiyle ek almış kelimeler', () => {
  it('silinirken, seçilirken ve arkasına gidilirken eki de kelimeye dahil eder', () => {
    expect(deletePhrase(doc("Ayşe Hanım'a selamlar."), 'ayşe hanım')?.doc.text).toBe('Selamlar.')
    expect(deletePhrase(doc("Saat 3'te buluşalım."), '3')?.doc.text).toBe('Saat buluşalım.')
    expect(show(selectPhrase(doc("Ankara’nın havası"), 'ankara'))).toBe('[Ankara’nın] havası')
    expect(show(moveToPhrase(doc("Ankara'ya gidiyorum."), 'ankara', 'after'))).toBe(
      "Ankara'ya| gidiyorum.",
    )
    expect(show(selectBetween(doc("Yarın Ankara'ya gidiyorum."), 'yarın', 'ankara'))).toBe(
      "[Yarın Ankara'ya] gidiyorum.",
    )
  })
})

describe('deleteSentence', () => {
  it('son cümleyi siler', () => {
    expect(deleteSentence(doc('Toplantı yarın. Gündem hazır.'), 'last')).toMatchObject({
      doc: { text: 'Toplantı yarın.' },
      removed: 'Gündem hazır.',
    })
  })

  it('sırası verilen cümleyi siler ve boşlukları düzeltir', () => {
    expect(show(deleteSentence(doc('Bir. İki. Üç.'), 1)?.doc)).toBe('İki. Üç.')
    expect(show(deleteSentence(doc('Bir. İki. Üç.'), 2)?.doc)).toBe('Bir. Üç.')
  })

  it('"son" cümle imlecin önündeki son cümledir', () => {
    expect(show(deleteSentence(doc('Bir. İki.| Üç.'), 'last')?.doc)).toBe('Bir.| Üç.')
  })

  it('bütün satırı oluşturan maddeyi satırıyla birlikte siler', () => {
    expect(show(deleteSentence(doc('Gündem:\n- Bütçe\n- Takvim'), 'last')?.doc)).toBe('Gündem:\n- Bütçe')
  })

  it('böyle bir cümle yoksa null döner', () => {
    expect(deleteSentence(doc(''), 'last')).toBeNull()
    expect(deleteSentence(doc('Bir.'), 3)).toBeNull()
  })
})

describe('deleteParagraph', () => {
  it('son paragrafı öncesindeki boş satırlarla siler', () => {
    expect(show(deleteParagraph(doc('Birinci.\n\nİkinci.'), 'last')?.doc)).toBe('Birinci.')
  })

  it('ilk paragrafı sonrasındaki boş satırlarla siler', () => {
    expect(show(deleteParagraph(doc('Birinci.\n\nİkinci.'), 1)?.doc)).toBe('İkinci.')
  })
})

describe('deleteWords, deletePhrase, deleteAll', () => {
  it('imlecin önündeki son kelimeleri siler', () => {
    expect(show(deleteWords(doc('Bir iki üç dört'), 1)?.doc)).toBe('Bir iki üç')
    expect(show(deleteWords(doc('Bir iki üç dört'), 2)?.doc)).toBe('Bir iki')
  })

  it('ifadenin son geçtiği yeri siler', () => {
    expect(show(deletePhrase(doc('Toplantı yarın saat onda.'), 'yarın')?.doc)).toBe('Toplantı saat onda.')
  })

  it('kelimeyi listeden ayıran virgülü de siler; silinen kelime ne ise bildirilir', () => {
    const middle = deletePhrase(doc('Elma, armut, muz.'), 'armut')
    expect(middle?.doc.text).toBe('Elma, muz.')
    expect(middle?.removed).toBe('armut')
    expect(deletePhrase(doc('Elma, armut, muz.'), 'muz')?.doc.text).toBe('Elma, armut.')
    expect(deletePhrase(doc('Elma, armut'), 'armut')?.doc.text).toBe('Elma')
  })

  it('cümlenin ilk kelimesi silinince sonraki kelimeyi büyük harfle başlatır', () => {
    expect(deletePhrase(doc('Yarın, perşembe görüşürüz.'), 'yarın')?.doc.text).toBe('Perşembe görüşürüz.')
    expect(deletePhrase(doc('Bir. Yarın gel.'), 'yarın')?.doc.text).toBe('Bir. Gel.')
  })

  it('bütün metni siler', () => {
    expect(deleteAll(doc('Bir. İki.'))).toEqual({
      doc: { text: '', selection: null },
      removed: 'Bir. İki.',
      at: 0,
    })
    expect(deleteAll(doc(''))).toBeNull()
  })
})

describe('gezinme', () => {
  it('satırın sonuna gider', () => {
    expect(show(moveToLine(doc('Bir\nİki\nÜç'), 2))).toBe('Bir\nİki|\nÜç')
    expect(moveToLine(doc('Bir'), 3)).toBeNull()
  })

  it('başa ve sona gider', () => {
    expect(show(moveToEdge(doc('Merhaba'), 'start'))).toBe('|Merhaba')
    expect(show(moveToEdge(doc('Mer|haba'), 'end'))).toBe('Merhaba')
  })

  it('sonraki ve önceki maddeye geçer', () => {
    expect(show(moveToBullet(doc('- Bir|\n- İki\n- Üç'), 'next'))).toBe('- Bir\n- İki|\n- Üç')
    expect(show(moveToBullet(doc('- Bir\n- İki|\n- Üç'), 'previous'))).toBe('- Bir|\n- İki\n- Üç')
    expect(moveToBullet(doc('- Bir\n- İki'), 'next')).toBeNull()
  })

  it('ifadenin önüne ya da arkasına gider', () => {
    expect(show(moveToPhrase(doc('Toplantı yarın.'), 'toplantı', 'after'))).toBe('Toplantı| yarın.')
    expect(show(moveToPhrase(doc('Toplantı yarın.'), 'yarın', 'before'))).toBe('Toplantı |yarın.')
  })
})

describe('deleteLine', () => {
  it('satırı satır sonuyla birlikte siler; "son", imlecin önündeki son dolu satırdır', () => {
    expect(deleteLine(doc('Gündem:\n- Süt\n- Ekmek\n'), 'last')?.doc.text).toBe('Gündem:\n- Süt\n')
    expect(deleteLine(doc('Bir\nİki|\nÜç'), 'last')?.doc.text).toBe('Bir\nÜç')
    expect(deleteLine(doc('Bir\nİki\nÜç'), 2)?.removed).toBe('İki')
    expect(deleteLine(doc('Bir'), 3)).toBeNull()
  })
})

describe('moveToParagraph ve moveToSentenceEdge', () => {
  it('imleci paragrafın sonuna taşır', () => {
    expect(show(moveToParagraph(doc('|Bir.\n\nİki.\n\nÜç.'), 2))).toBe('Bir.\n\nİki.|\n\nÜç.')
    expect(show(moveToParagraph(doc('|Bir.\n\nİki.'), 'last'))).toBe('Bir.\n\nİki.')
    expect(moveToParagraph(doc('Bir.'), 2)).toBeNull()
  })

  it('imleci bulunduğu cümlenin başına ya da sonuna taşır', () => {
    expect(show(moveToSentenceEdge(doc('Bir. İki ü|ç. Dört.'), 'start'))).toBe('Bir. |İki üç. Dört.')
    expect(show(moveToSentenceEdge(doc('Bir. İki ü|ç. Dört.'), 'end'))).toBe('Bir. İki üç.| Dört.')
    expect(show(moveToSentenceEdge(doc('Bir. İki.'), 'start'))).toBe('Bir. |İki.')
    expect(moveToSentenceEdge(doc(''), 'start')).toBeNull()
  })
})

describe('kelime, son kelimeler, son söylenen ve bütün metni seçme', () => {
  it('ifadenin son geçtiği yeri seçer', () => {
    expect(show(selectPhrase(doc('Yarın gel, yarın git.'), 'yarın'))).toBe('Yarın gel, [yarın] git.')
    expect(selectPhrase(doc('Yarın gel.'), 'bugün')).toBeNull()
  })

  it('imlecin önündeki son kelimeleri seçer', () => {
    expect(show(selectWords(doc('Bir iki üç'), 2))).toBe('Bir [iki üç]')
    expect(show(selectWords(doc('Bir iki| üç'), 5))).toBe('[Bir iki] üç')
    expect(selectWords(doc('|Bir'), 1)).toBeNull()
  })

  it('verilen aralığı ve bütün metni seçer', () => {
    expect(show(selectRange(doc('Bir iki'), { start: 4, end: 7 }))).toBe('Bir [iki]')
    expect(selectRange(doc('Bir'), { start: 2, end: 9 })).toBeNull()
    expect(show(selectAll(doc('Bir iki')))).toBe('[Bir iki]')
    expect(selectAll(doc('  '))).toBeNull()
  })
})

describe('rewriteRange', () => {
  it('aralığı dönüştürür, seçimi yeni metne göre kaydırır', () => {
    const result = rewriteRange(doc('[yarın] gel'), { start: 0, end: 5 }, (text) => `“${text}”`)
    expect(show(result.doc)).toBe('[“yarın”] gel')
    expect(result).toMatchObject({ from: 'yarın', to: '“yarın”' })
  })
})

describe('seçme', () => {
  it('cümle ve paragraf seçer', () => {
    expect(show(selectSentence(doc('Bir. İki.'), 'last'))).toBe('Bir. [İki.]')
    expect(show(selectSentence(doc('Bir. İki.'), 1))).toBe('[Bir.] İki.')
    expect(show(selectParagraph(doc('Bir.\n\nİki.'), 1))).toBe('[Bir.]\n\nİki.')
  })

  it('iki ifade arasını seçer', () => {
    expect(show(selectBetween(doc('Toplantı yarın saat onda.'), 'yarın', 'onda'))).toBe(
      'Toplantı [yarın saat onda].',
    )
  })

  it('seçimi kaldırır ve imleci seçimin sonunda bırakır', () => {
    expect(show(clearSelection(doc('Bir [iki] üç')))).toBe('Bir iki| üç')
  })
})
