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
      { type: 'command', command: { type: 'delete-last-sentence' }, spoken: 'Nova, son cümleyi sil' },
      { type: 'text', text: 'Toplantı yarın.' },
    ])
  })

  it('cümle silme komutunun farklı söyleniş biçimlerini tanır', () => {
    for (const spoken of [
      'Nova son cümleyi sil',
      'nova, bir önceki cümleyi sil.',
      'Nova: önceki cümleyi kaldır',
      'NOVA SON CÜMLEYİ SİL',
    ]) {
      expect(commands(spoken), spoken).toEqual([{ type: 'delete-last-sentence' }])
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
    expect(commands('Nova, son cümle isi.')).toEqual([{ type: 'delete-last-sentence' }])
    expect(commands('Nova, 3 boş magda ekle.')).toEqual([{ type: 'add-bullets', count: 3 }])
    expect(commands('Nova geri alın')).toEqual([{ type: 'undo' }])
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
    expect(parseSegment('Nova, son paragrafı sil.')).toEqual({
      parts: [{ type: 'text', text: 'Nova, son paragrafı sil.' }],
      unrecognized: ['Nova, son paragrafı sil.'],
    })
  })

  it('komut kelimeleri komutun parçası değilse onları metin sayar', () => {
    expect(commands('Nova, son cümleyi silmek istemiyorum.')).toEqual([])
  })
})
