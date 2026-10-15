import { describe, expect, it } from 'vitest'
import { type EditorAction, editorReducer, initialEditorState } from './editor.ts'

function run(...actions: EditorAction[]) {
  return actions.reduce(editorReducer, initialEditorState)
}

const dictate = (segment: string): EditorAction => ({ type: 'dictate', segment })
const type = (text: string): EditorAction => ({ type: 'type', text, selection: null })

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
    state = editorReducer(state, { type: 'undo' })
    state = editorReducer(state, { type: 'undo' })
    expect(state.text).toBe('Bir.')
    state = editorReducer(state, { type: 'redo' })
    expect(state.text).toBe('Bir. İki.')
  })

  it('yeni bir değişiklikten sonra yinelenecek bir şey kalmaz', () => {
    let state = run(dictate('Bir.'), dictate('İki.'), { type: 'undo' }, dictate('Üç.'))
    state = editorReducer(state, { type: 'redo' })
    expect(state.text).toBe('Bir. Üç.')
    expect(state.feedback?.type).toBe('nothing-to-redo')
  })

  it('yalnızca imleci taşıyan komutları geçmişe yazmaz', () => {
    const state = run(dictate('Bir.'), dictate('İki.'), dictate('Nova, başa git.'), { type: 'undo' })
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
    state = editorReducer(state, { type: 'undo' })
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
    expect(run({ type: 'undo' }).feedback?.type).toBe('nothing-to-undo')
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
})
