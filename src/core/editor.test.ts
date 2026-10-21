import { describe, expect, it } from 'vitest'
import type { Command } from '../commands/types.ts'
import { DEFAULT_WAKE_WORD } from '../commands/wakeWord.ts'
import { type EditorAction, editorReducer, initialEditorState } from './editor.ts'

function run(...actions: EditorAction[]) {
  return actions.reduce(editorReducer, initialEditorState)
}

const dictate = (segment: string, wakeWord = DEFAULT_WAKE_WORD): EditorAction => ({
  type: 'dictate',
  segment,
  wakeWord,
  at: 0,
})
const type = (text: string): EditorAction => ({ type: 'type', text, selection: null })
/** Bir düğmenin komut çalıştırması. */
const press = (command: Command, source = 'düğme'): EditorAction => ({
  type: 'command',
  command,
  source,
  at: 0,
})
const undo = press({ type: 'undo' })
const redo = press({ type: 'redo' })

describe('editorReducer', () => {
  it('dikte edilen parçaları metne ekler', () => {
    expect(run(dictate('Toplantı yarın.'), dictate('Gündem hazır.')).text).toBe(
      'Toplantı yarın. Gündem hazır.',
    )
  })

  it('"Nova, son cümleyi sil" ile son cümleyi siler ve ne silindiğini bildirir', () => {
    const state = run(
      dictate('Toplantı yarın. Gündem hazır.'),
      dictate('Nova, son cümleyi sil.'),
    )
    expect(state.text).toBe('Toplantı yarın.')
    expect(state.feedback).toMatchObject({
      type: 'deleted',
      what: 'sentence',
      removed: 'Gündem hazır.',
      at: 15,
    })
  })

  it('aynı parçadaki metni, komutu ve sonrasını sırayla uygular', () => {
    const state = run(dictate('Gündem bu. Nova, son cümleyi sil. Toplantı yarın.'))
    expect(state.text).toBe('Toplantı yarın.')
  })

  it('boş maddeler ekler ve sonraki parçalarla sırayla doldurur', () => {
    const state = run(
      dictate('Gündem şöyle. Nova, buraya üç boş madde ekle.'),
      dictate('Bütçe'),
      dictate('Takvim'),
    )
    expect(state.text).toBe('Gündem şöyle.\n- Bütçe\n- Takvim\n- ')
  })

  it('imleci taşıyan komutlardan sonra dikteyi imlecin olduğu yere yazar', () => {
    const state = run(
      dictate('Toplantı yarın saat onda.'),
      dictate('Nova, en başa git.'),
      dictate('Not:'),
    )
    expect(state.text).toBe('Not: Toplantı yarın saat onda.')
  })

  it('seçili metnin yerine dikte edilen metni yazar', () => {
    const state = run(
      dictate('Bir. Yanlış cümle. Üç.'),
      dictate('Nova, ikinci cümleyi seç.'),
      dictate('İki.'),
    )
    expect(state.text).toBe('Bir. İki. Üç.')
  })

  it('"Nova, bunu sil" son dikte edilen parçayı siler', () => {
    const state = run(dictate('Toplantı yarın.'), dictate('Bu kısım yanlış oldu'), dictate('Nova, bunu sil.'))
    expect(state.text).toBe('Toplantı yarın.')
    expect(state.feedback).toMatchObject({ type: 'deleted', what: 'dictation' })
  })

  it('kelimeyi seçer; seçimi geçmişe yazmaz, ardından söyleneni seçimin yerine yazar', () => {
    let state = run(dictate('Toplantı yarın saat onda.'), dictate('Nova, yarın kelimesini seç.'))
    expect(state.selection).toEqual({ start: 9, end: 14 })
    expect(state.past).toHaveLength(1)
    state = editorReducer(state, dictate('Perşembe.'))
    expect(state.text).toBe('Toplantı Perşembe saat onda.')
  })

  it('"bunu seç" son söyleneni, "her şeyi seç" bütün metni seçer', () => {
    const state = run(dictate('Toplantı yarın.'), dictate('Gündem hazır.'), dictate('Nova, bunu seç.'))
    expect(state.selection).toEqual({ start: 16, end: 29 })
    expect(editorReducer(state, dictate('Nova, her şeyi seç.')).selection).toEqual({ start: 0, end: 29 })
  })

  it('harfleri büyütür ya da küçültür, tırnak içine alır ve geri alınabilir', () => {
    let state = run(dictate('Toplantı yarın.'), dictate('ayşe hanım'), dictate('Nova, bunu büyük harfle yaz.'))
    expect(state.text).toBe('Toplantı yarın. Ayşe Hanım')
    expect(state.feedback).toMatchObject({ type: 'replaced', from: 'ayşe hanım', to: 'Ayşe Hanım' })
    state = editorReducer(state, dictate('Nova, toplantı kelimesini küçük harfle yaz.'))
    expect(state.text).toBe('toplantı yarın. Ayşe Hanım')
    state = editorReducer(state, dictate('Nova, yarın kelimesini tırnak içine al.'))
    expect(state.text).toBe('toplantı “yarın”. Ayşe Hanım')
    expect(editorReducer(state, undo).text).toBe('toplantı yarın. Ayşe Hanım')
  })

  it('"bunu" ile verilen komutun hedefi yoksa bildirir', () => {
    expect(run(dictate('Nova, bunu büyük harfle yaz.')).feedback).toMatchObject({
      type: 'missing',
      what: 'target',
    })
  })

  it('"X yerine Y yaz" ile kelime değiştirir', () => {
    const state = run(dictate('Toplantı yarın saat onda.'), dictate('Nova, yarın yerine perşembe yaz.'))
    expect(state.text).toBe('Toplantı perşembe saat onda.')
  })

  it('"Nova, geri al" son değişikliği geri alır, "Nova, yinele" yeniden yapar', () => {
    let state = run(
      dictate('Toplantı yarın. Gündem hazır.'),
      dictate('Nova, son cümleyi sil.'),
      dictate('Nova, geri al.'),
    )
    expect(state.text).toBe('Toplantı yarın. Gündem hazır.')
    expect(state.feedback?.type).toBe('undone')

    state = editorReducer(state, dictate('Nova, yinele.'))
    expect(state.text).toBe('Toplantı yarın.')
    expect(state.feedback?.type).toBe('redone')
  })

  it('geri alma ve yineleme düğmeleri art arda kullanılabilir', () => {
    let state = run(dictate('Bir.'), dictate('İki.'), dictate('Üç.'))
    state = editorReducer(state, undo)
    state = editorReducer(state, undo)
    expect(state.text).toBe('Bir.')
    state = editorReducer(state, redo)
    expect(state.text).toBe('Bir. İki.')
  })

  it('yeni bir değişiklikten sonra yinelenecek bir şey kalmaz', () => {
    let state = run(dictate('Bir.'), dictate('İki.'), undo, dictate('Üç.'))
    state = editorReducer(state, redo)
    expect(state.text).toBe('Bir. Üç.')
    expect(state.feedback?.type).toBe('nothing-to-redo')
  })

  it('yalnızca imleci taşıyan komutları geçmişe yazmaz', () => {
    const state = run(dictate('Bir.'), dictate('İki.'), dictate('Nova, başa git.'), undo)
    expect(state.text).toBe('Bir.')
  })

  it('aynı parçada söylenen metni "geri al" ile hemen geri alır', () => {
    const state = run(dictate('Bir.'), dictate('Yanlış oldu. Nova, geri al.'))
    expect(state.text).toBe('Bir.')
  })

  it('elle yazılanları önce, tek seferde geri alır', () => {
    let state = run(dictate('Merhaba.'))
    state = editorReducer(state, type('Merhaba. D'))
    state = editorReducer(state, type('Merhaba. Dü'))
    state = editorReducer(state, type('Merhaba. Dünya'))
    state = editorReducer(state, undo)
    expect(state.text).toBe('Merhaba.')
  })

  it('kullanıcının taşıdığı imleci kaydeder, metnin sonundaysa null tutar', () => {
    let state = run(dictate('Merhaba dünya.'))
    state = editorReducer(state, { type: 'select', selection: { start: 7, end: 7 } })
    expect(state.selection).toEqual({ start: 7, end: 7 })
    state = editorReducer(state, { type: 'select', selection: { start: 14, end: 14 } })
    expect(state.selection).toBeNull()
  })

  it('hedef bulunamazsa ya da geri alınacak bir şey yoksa bunu bildirir', () => {
    expect(run(undo).feedback?.type).toBe('nothing-to-undo')
    expect(run(dictate('Nova, son cümleyi sil')).feedback).toMatchObject({
      type: 'missing',
      what: 'sentence',
    })
    expect(run(dictate('Bir.'), dictate('Nova, beşinci satıra git')).feedback).toMatchObject({
      type: 'missing',
      what: 'line',
    })
    expect(run(dictate('Bir.'), dictate('Nova, iki yerine üç yaz')).feedback).toMatchObject({
      type: 'phrase-not-found',
      phrase: 'iki',
    })
  })

  it('arayüzün yapacağı işleri bildirim olarak iletir', () => {
    expect(run(dictate('Nova, dinlemeyi durdur.')).feedback?.type).toBe('stop-listening')
    expect(run(dictate('Nova, metni kopyala.')).feedback?.type).toBe('copy')
    expect(run(dictate('Nova, komutları göster.')).feedback?.type).toBe('show-help')
  })

  it('tanınmayan komutu metin olarak ekler ve bildirir', () => {
    const state = run(dictate('Nova, sayfayı çevir.'))
    expect(state.text).toBe('Nova, sayfayı çevir.')
    expect(state.feedback).toMatchObject({ type: 'unrecognized', phrase: 'Nova, sayfayı çevir.' })
  })

  it('her yeni bildirimde kimliği artırır', () => {
    const state = run(dictate('Bir.'), dictate('Nova, geri al'), dictate('Nova, geri al'))
    expect(state.feedback).toMatchObject({ id: 2, type: 'nothing-to-undo' })
  })

  it('düğmelerin çalıştırdığı komutları da uygular ve geri alınabilir yapar', () => {
    let state = run(dictate('Bir. İki.'), press({ type: 'delete-all' }, 'Temizle düğmesi'))
    expect(state.text).toBe('')
    state = editorReducer(state, undo)
    expect(state.text).toBe('Bir. İki.')
  })

  it('seçilen komut kelimesini dinler, eskisini düz metin sayar', () => {
    const state = run(
      dictate('Toplantı yarın. Gündem hazır.', 'Asistan'),
      dictate('Asistan, son cümleyi sil.', 'Asistan'),
      dictate('Nova, yeni satır.', 'Asistan'),
    )
    expect(state.text).toBe('Toplantı yarın. Nova, yeni satır.')
  })

  describe('komut tuşuyla söylenenler', () => {
    const commandSpeech = (segment: string): EditorAction => ({
      type: 'command-speech',
      segment,
      wakeWord: 'Nova',
      at: 0,
    })

    it('komut kelimesi olmadan uygular ve geri alınabilir', () => {
      let state = run(dictate('Toplantı yarın. Gündem hazır.'), commandSpeech('Son cümleyi sil.'))
      expect(state.text).toBe('Toplantı yarın.')
      expect(state.log.at(-1)).toMatchObject({ via: 'voice', source: 'Son cümleyi sil' })
      state = editorReducer(state, undo)
      expect(state.text).toBe('Toplantı yarın. Gündem hazır.')
    })

    it('anlaşılamayan komutu metne yazmaz, bildirir', () => {
      const state = run(dictate('Toplantı yarın.'), commandSpeech('Sayfayı çevir.'))
      expect(state.text).toBe('Toplantı yarın.')
      expect(state.feedback).toMatchObject({ type: 'not-understood', phrase: 'Sayfayı çevir.' })
      expect(state.log.at(-1)).toMatchObject({ source: 'Sayfayı çevir.', detail: { type: 'not-understood' } })
    })
  })

  describe('komut geçmişi', () => {
    it('her komutu nasıl verildiği ve sonucuyla birlikte kaydeder', () => {
      const state = run(
        dictate('Toplantı yarın. Gündem hazır.'),
        { type: 'dictate', segment: 'Nova, son cümleyi sil. Nova, yeni satır.', wakeWord: 'Nova', at: 1000 },
        press({ type: 'delete-all' }, 'Temizle düğmesi'),
      )
      expect(state.log).toMatchObject([
        {
          id: 1,
          at: 1000,
          via: 'voice',
          source: 'Nova, son cümleyi sil',
          detail: { type: 'deleted', what: 'sentence' },
        },
        { id: 2, at: 1000, via: 'voice', source: 'Nova, yeni satır', detail: null },
        { id: 3, via: 'button', source: 'Temizle düğmesi', detail: { type: 'deleted', what: 'all' } },
      ])
    })

    it('tanınmayan "Nova" ifadelerini de kaydeder, düz dikteyi kaydetmez', () => {
      const state = run(dictate('Merhaba dünya.'), dictate('Nova, sayfayı çevir.'))
      expect(state.log).toMatchObject([
        { source: 'Nova, sayfayı çevir.', detail: { type: 'unrecognized' } },
      ])
    })

    it('en fazla 50 satır tutar', () => {
      const state = run(...Array.from({ length: 60 }, () => dictate('Nova, yeni satır.')))
      expect(state.log).toHaveLength(50)
      expect(state.log.at(-1)?.id).toBe(60)
    })
  })
})
