import { describe, expect, it } from 'vitest'
import { RULES } from './grammar.ts'
import { isLoneWakeWord, parseCommandSpeech, parseSegment } from './parse.ts'

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

  it('uzun komut kelimesindeki küçük yazım hatasını, arkasından komut geliyorsa tolere eder', () => {
    expect(parseSegment('Gündem bu. Carvis, son cümleyi sil.', 'Jarvis').parts).toEqual([
      { type: 'text', text: 'Gündem bu.' },
      { type: 'command', command: { type: 'delete-sentence', which: 'last' }, spoken: 'Carvis, son cümleyi sil' },
    ])
    // Arkasından komut gelmeyen benzer kelime sıradan bir kelimedir ve bildirilmez.
    expect(parseSegment('Carvis güzel bir film.', 'Jarvis')).toEqual({
      parts: [{ type: 'text', text: 'Carvis güzel bir film.' }],
      unrecognized: [],
    })
  })

  it('komut kelimesinin ekli halini komut saymaz', () => {
    expect(parseSegment('Asistana son cümleyi sil dedim.', 'Asistan').parts).toEqual([
      { type: 'text', text: 'Asistana son cümleyi sil dedim.' },
    ])
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

  it('"ve" ile bağlanan komutları sırayla uygular; arkası komut değilse metin sayar', () => {
    expect(commands('Nova, son cümleyi sil ve yeni satır.')).toEqual([
      { type: 'delete-sentence', which: 'last' },
      { type: 'insert-break', kind: 'line' },
    ])
    expect(parseSegment('Nova, yeni satır ve sonra görüşürüz.').parts).toEqual([
      { type: 'command', command: { type: 'insert-break', kind: 'line' }, spoken: 'Nova, yeni satır' },
      { type: 'text', text: 've sonra görüşürüz.' },
    ])
  })

  it('komut kelimesinin önündeki hitap virgülünü metne yazmaz', () => {
    expect(parseSegment('Bugün hava güzel, Nova, yeni satır, yarın görüşürüz.').parts).toEqual([
      { type: 'text', text: 'Bugün hava güzel' },
      { type: 'command', command: { type: 'insert-break', kind: 'line' }, spoken: 'Nova, yeni satır' },
      { type: 'text', text: 'yarın görüşürüz.' },
    ])
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

  it('geçmiş zamanla yazılan geri almanın son kelimesini metne bırakmaz', () => {
    expect(parseSegment('Nova, 3 kere geri aldım.').parts).toEqual([
      { type: 'command', command: { type: 'undo', count: 3 }, spoken: 'Nova, 3 kere geri aldım' },
    ])
  })

  it('hata toleransı farklı ifadeleri komut sanacak kadar geniş değildir', () => {
    expect(commands('Nova, geri almak istemiyorum.')).toEqual([])
    expect(commands('Nova, son günü sil.')).toEqual([])
  })

  it('"seç" ile söylenen hiçbir ifadeyi silme komutu saymaz', () => {
    // Her silme kalıbı "sil" yerine "seç" ile denenir; hata toleransı ikisini karıştırmamalı.
    const spoken = RULES.flatMap((rule) => rule.patterns)
      .filter((pattern) => pattern.endsWith(' sil'))
      .map((pattern) =>
        pattern
          .replace(/ sil$/, ' seç')
          .replace('{ordinal}', 'son')
          .replace('{count?}', 'üç')
          .replace('{text}', 'yarın'),
      )
    for (const phrase of spoken) {
      const deletes = commands(`Nova, ${phrase}.`).filter((command) => command.type.startsWith('delete-'))
      expect(deletes, phrase).toEqual([])
    }
  })

  it('komutun olumsuzunu ("silme", "geri alma") komut saymaz', () => {
    // Her kalıbın son kelimesi ünlü uyumuna göre "-me/-ma" ile olumsuz yapılır; hata toleransı
    // olumsuzu o komut saymamalı ("Nova, her şeyi silme." metni silmemeli).
    const negated = RULES.flatMap((rule) => rule.patterns)
      .map((pattern) => pattern.replace(/[[\]]/g, ''))
      .filter((pattern) => !pattern.endsWith('}'))
      .map((pattern) =>
        pattern
          .replace('{ordinal}', 'son')
          .replace(/\{count\??\}/, 'üç')
          .replace('{text}', 'yarın')
          .replace('{text2}', 'perşembe')
          .replace(/[\p{L}]+$/u, (verb) => verb + (/[eiöü][^aeıioöuü]*$/.test(verb) ? 'me' : 'ma')),
      )
    for (const phrase of negated) {
      expect(commands(`Nova, ${phrase}.`), phrase).toEqual([])
    }
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
      ['Nova, yarın kelimesini seç.', { type: 'select-phrase', phrase: 'yarın' }],
      ['Nova, son kelimeyi seç.', { type: 'select-words', count: 1 }],
      ['Nova, son üç kelimeyi seç.', { type: 'select-words', count: 3 }],
      ['Nova, bunu seç.', { type: 'select-that' }],
      ['Nova, her şeyi seç.', { type: 'select-all' }],
      ['Nova, tümünü seç.', { type: 'select-all' }],
      [
        'Nova, ankara kelimesini büyük harfle yaz.',
        { type: 'set-case', phrase: 'ankara', to: 'upper' },
      ],
      [
        'Nova, Perşembe kelimesini küçük harflerle yaz.',
        { type: 'set-case', phrase: 'Perşembe', to: 'lower' },
      ],
      ['Nova, bunu büyük harfle yaz.', { type: 'set-case', phrase: null, to: 'upper' }],
      [
        'Nova, yarın kelimesini tırnak içine al.',
        { type: 'wrap', phrase: 'yarın', marks: 'quotes' },
      ],
      ['Nova, bunu parantez içine al.', { type: 'wrap', phrase: null, marks: 'parentheses' }],
      ['Nova, tırnak aç.', { type: 'insert-mark', mark: '“' }],
      ['Nova, tırnak kapat.', { type: 'insert-mark', mark: '”' }],
      ['Nova, parantez aç.', { type: 'insert-mark', mark: '(' }],
      ['Nova, parantez kapat.', { type: 'insert-mark', mark: ')' }],
      ['Nova, tire.', { type: 'insert-mark', mark: '-' }],
      ['Nova, yinele.', { type: 'redo' }],
      ['Nova, dinlemeyi durdur.', { type: 'stop-listening' }],
      ['Nova, metni kopyala.', { type: 'copy', target: 'all' }],
      ['Nova, kopyala.', { type: 'copy', target: 'selection' }],
      ['Nova, seçili metni kopyala.', { type: 'copy', target: 'selection' }],
      ['Nova, son satırı sil.', { type: 'delete-line', which: 'last' }],
      ['Nova, ikinci satırı sil.', { type: 'delete-line', which: 2 }],
      ['Nova, ikinci paragrafa git.', { type: 'go-to-paragraph', paragraph: 2 }],
      ['Nova, cümlenin başına git.', { type: 'go-to-sentence-edge', edge: 'start' }],
      ['Nova, cümlenin sonuna git.', { type: 'go-to-sentence-edge', edge: 'end' }],
      ['Nova, üç kez geri al.', { type: 'undo', count: 3 }],
      ['Nova, 2 defa yinele.', { type: 'redo', count: 2 }],
      // Whisper'ın gerçek denemede bu komutlar için yazdıkları.
      ['Nova, 3 kere geri aldı.', { type: 'undo', count: 3 }],
      ['Nova, iki kere ileri alt.', { type: 'redo', count: 2 }],
      ['Nova, geri aldı.', { type: 'undo' }],
      ['Nova, ileri aldım.', { type: 'redo' }],
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

describe('isLoneWakeWord', () => {
  it('yalnızca komut kelimesinden (ve noktalamadan) oluşan parçayı tanır', () => {
    expect(isLoneWakeWord(' Nova.')).toBe(true)
    expect(isLoneWakeWord('No va!')).toBe(true)
    expect(isLoneWakeWord('Asistan,', 'Asistan')).toBe(true)
    expect(isLoneWakeWord('Nova projesi.')).toBe(false)
    expect(isLoneWakeWord('Novalar.')).toBe(false)
    expect(isLoneWakeWord('Carvis.', 'Jarvis')).toBe(false)
  })
})

describe('parseCommandSpeech', () => {
  const commandsOf = (segment: string) =>
    parseCommandSpeech(segment).parts.flatMap((part) => (part.type === 'command' ? [part.command] : []))

  it('komut kelimesi olmadan söylenen komutu tanır', () => {
    expect(parseCommandSpeech('Son cümleyi sil.')).toEqual({
      parts: [{ type: 'command', command: { type: 'delete-sentence', which: 'last' }, spoken: 'Son cümleyi sil' }],
      unrecognized: [],
    })
  })

  it('Whisper\'ın geçmiş zamanla yazdığı geri almayı tanır', () => {
    expect(commandsOf('Üç kere geri aldım.')).toEqual([{ type: 'undo', count: 3 }])
    expect(commandsOf('Geri aldı.')).toEqual([{ type: 'undo' }])
  })

  it('alışkanlıkla söylenen komut kelimesini atlar', () => {
    expect(commandsOf('Nova, geri al.')).toEqual([{ type: 'undo' }])
    expect(parseCommandSpeech('Asistan, yeni satır.', 'Asistan').parts).toHaveLength(1)
  })

  it('art arda söylenen komutları sırayla ayırır', () => {
    expect(commandsOf('Son cümleyi sil, yeni satır.')).toEqual([
      { type: 'delete-sentence', which: 'last' },
      { type: 'insert-break', kind: 'line' },
    ])
    expect(commandsOf('Son kelimeyi sil ve nokta koy.')).toHaveLength(2)
  })

  it('komutun olumsuzunu komut saymaz', () => {
    expect(parseCommandSpeech('Son cümleyi silme.')).toEqual({ parts: [], unrecognized: ['Son cümleyi silme.'] })
    expect(commandsOf('Geri alma.')).toEqual([])
  })

  it('anlaşılamayan kısmı metne eklemek yerine ayrı döner', () => {
    expect(parseCommandSpeech('Sayfayı çevir.')).toEqual({ parts: [], unrecognized: ['Sayfayı çevir.'] })
    expect(parseCommandSpeech('Geri al, sonra da kahve yap.').unrecognized).toEqual([
      'sonra da kahve yap.',
    ])
  })
})
