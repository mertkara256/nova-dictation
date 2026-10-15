import { describe, expect, it } from 'vitest'
import { parseSegment } from './parse.ts'

function commands(segment: string) {
  return parseSegment(segment).parts.flatMap((part) =>
    part.type === 'command' ? [part.command] : [],
  )
}

describe('parseSegment', () => {
  it('komut içermeyen parçayı olduğu gibi metin olarak bırakır', () => {
    expect(parseSegment('Toplantı yarın saat onda.')).toEqual({
      parts: [{ type: 'text', text: 'Toplantı yarın saat onda.' }],
      unrecognized: [],
    })
  })

  it('komuttan önce ve sonra söyleneni metin olarak ayırır', () => {
    expect(parseSegment('Gündem bu. Nova, son cümleyi sil. Toplantı yarın.').parts).toEqual([
      { type: 'text', text: 'Gündem bu.' },
      { type: 'command', command: { type: 'delete-sentence', which: 'last' }, spoken: 'Nova, son cümleyi sil' },
      { type: 'text', text: 'Toplantı yarın.' },
    ])
  })

  it('komut kelimesi değiştirilebilir; o zaman "Nova" düz metin sayılır', () => {
    expect(parseSegment('Gündem bu. Asistan, son cümleyi sil.', 'Asistan').parts).toEqual([
      { type: 'text', text: 'Gündem bu.' },
      { type: 'command', command: { type: 'delete-sentence', which: 'last' }, spoken: 'Asistan, son cümleyi sil' },
    ])
    expect(parseSegment('Nova, son cümleyi sil.', 'Asistan')).toEqual({
      parts: [{ type: 'text', text: 'Nova, son cümleyi sil.' }],
      unrecognized: [],
    })
  })

  it('cümle silme komutunun farklı söyleniş biçimlerini tanır', () => {
    for (const spoken of [
      'Nova son cümleyi sil',
      'nova, bir önceki cümleyi sil.',
      'Nova: önceki cümleyi kaldır',
      'NOVA SON CÜMLEYİ SİL',
    ]) {
      expect(commands(spoken), spoken).toEqual([{ type: 'delete-sentence', which: 'last' }])
    }
  })

  it('madde sayısını yazıyla ve rakamla anlar', () => {
    expect(commands('Nova, buraya üç boş madde ekle.')).toEqual([{ type: 'add-bullets', count: 3 }])
    expect(commands('Nova 5 tane madde ekle')).toEqual([{ type: 'add-bullets', count: 5 }])
    expect(commands('Nova, boş madde ekle')).toEqual([{ type: 'add-bullets', count: 1 }])
    expect(commands('Nova, 99 boş madde ekle')).toEqual([{ type: 'add-bullets', count: 20 }])
  })

  it('geri alma komutunu tanır', () => {
    expect(commands('Nova, geri al.')).toEqual([{ type: 'undo' }])
  })

  it('bir parçadaki birden fazla komutu sırayla çıkarır', () => {
    expect(commands('Nova, iki madde ekle. Nova, geri al.')).toEqual([
      { type: 'add-bullets', count: 2 },
      { type: 'undo' },
    ])
  })

  it('konuşma tanımanın küçük yazım hatalarını tolere eder', () => {
    // Whisper'ın gerçek denemede ürettiği yanlış yazımlar.
    expect(commands('Nova, son cümle isi.')).toEqual([{ type: 'delete-sentence', which: 'last' }])
    expect(commands('Nova, 3 boş magda ekle.')).toEqual([{ type: 'add-bullets', count: 3 }])
    expect(commands('Nova geri alın')).toEqual([{ type: 'undo' }])
    expect(commands('No va, bunu si.')).toEqual([{ type: 'delete-that' }])
  })

  it('hata toleransı farklı ifadeleri komut sanacak kadar geniş değildir', () => {
    expect(commands('Nova, geri almak istemiyorum.')).toEqual([])
    expect(commands('Nova, son günü sil.')).toEqual([])
  })

  it('cümle içindeki "Nova" kelimesini komut saymaz', () => {
    expect(parseSegment('Nova projesi çok güzel ilerliyor.').parts).toEqual([
      { type: 'text', text: 'Nova projesi çok güzel ilerliyor.' },
    ])
    expect(parseSegment("Bunu Nova'ya sor.").unrecognized).toEqual([])
  })

  it('cümle başındaki tanınmayan "Nova" ifadesini bildirir ama metinde bırakır', () => {
    expect(parseSegment('Nova, sayfayı çevir.')).toEqual({
      parts: [{ type: 'text', text: 'Nova, sayfayı çevir.' }],
      unrecognized: ['Nova, sayfayı çevir.'],
    })
  })

  it('komut kelimeleri komutun parçası değilse onları metin sayar', () => {
    expect(commands('Nova, son cümleyi silmek istemiyorum.')).toEqual([])
  })

  describe('yeni komutlar', () => {
    const cases: [string, unknown][] = [
      ['Nova, ilk cümleyi sil.', { type: 'delete-sentence', which: 1 }],
      ['Nova, üçüncü cümleyi sil.', { type: 'delete-sentence', which: 3 }],
      ["Nova, 2'nci cümleyi kaldır.", { type: 'delete-sentence', which: 2 }],
      ['Nova, son paragrafı sil.', { type: 'delete-paragraph', which: 'last' }],
      ['Nova, son kelimeyi sil.', { type: 'delete-words', count: 1 }],
      ['Nova, son üç kelimeyi sil.', { type: 'delete-words', count: 3 }],
      ['Nova, yarın kelimesini sil.', { type: 'delete-phrase', phrase: 'yarın' }],
      ['Nova, bunu sil.', { type: 'delete-that' }],
      ['Nova, seçili metni sil.', { type: 'delete-selection' }],
      ['Nova, her şeyi sil.', { type: 'delete-all' }],
      ['Nova, yarın yerine Perşembe yaz.', { type: 'replace', from: 'yarın', to: 'Perşembe' }],
      ['Nova, yeni satır.', { type: 'insert-break', kind: 'line' }],
      ['Nova, yeni paragraf.', { type: 'insert-break', kind: 'paragraph' }],
      ['Nova, virgül koy.', { type: 'insert-mark', mark: ',' }],
      ['Nova, soru işareti.', { type: 'insert-mark', mark: '?' }],
      ['Nova, noktalı virgül.', { type: 'insert-mark', mark: ';' }],
      ['Nova, 3. satıra git.', { type: 'go-to-line', line: 3 }],
      ['Nova, ikinci satıra git.', { type: 'go-to-line', line: 2 }],
      ['Nova, en başa git.', { type: 'go-to-edge', edge: 'start' }],
      ['Nova, sona git.', { type: 'go-to-edge', edge: 'end' }],
      ['Nova, sonraki maddeye geç.', { type: 'go-to-bullet', direction: 'next' }],
      ['Nova, önceki madde.', { type: 'go-to-bullet', direction: 'previous' }],
      [
        'Nova, toplantı kelimesinden sonra yaz.',
        { type: 'go-to-phrase', phrase: 'toplantı', side: 'after' },
      ],
      ['Nova, son cümleyi seç.', { type: 'select-sentence', which: 'last' }],
      ['Nova, ilk paragrafı seç.', { type: 'select-paragraph', which: 1 }],
      [
        'Nova, yarın kelimesinden onda kelimesine kadar seç.',
        { type: 'select-between', from: 'yarın', to: 'onda' },
      ],
      ['Nova, seçimi kaldır.', { type: 'clear-selection' }],
      ['Nova, yinele.', { type: 'redo' }],
      ['Nova, dinlemeyi durdur.', { type: 'stop-listening' }],
      ['Nova, metni kopyala.', { type: 'copy' }],
      ['Nova, komutları göster.', { type: 'show-help' }],
    ]

    for (const [spoken, expected] of cases) {
      it(spoken, () => {
        expect(commands(spoken)).toEqual([expected])
      })
    }

    it('serbest metindeki tırnakları atar ve büyük harfleri korur', () => {
      expect(commands('Nova, "İstanbul" yerine "Ankara" yaz.')).toEqual([
        { type: 'replace', from: 'İstanbul', to: 'Ankara' },
      ])
    })

    it('"son kelimeyi sil" ile "X kelimesini sil" komutlarını karıştırmaz', () => {
      expect(commands('Nova, son kelimeyi sil')).toEqual([{ type: 'delete-words', count: 1 }])
    })
  })
})
