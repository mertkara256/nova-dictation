import { describe, expect, it } from 'vitest'
import { type EditorAction, editorReducer, initialEditorState } from './editor.ts'

function run(...actions: EditorAction[]) {
  return actions.reduce(editorReducer, initialEditorState)
}

const dictate = (segment: string): EditorAction => ({ type: 'dictate', segment })

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
    expect(state.feedback).toMatchObject({ type: 'deleted', removed: 'Gündem hazır.', at: 15 })
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

  it('"Nova, geri al" son değişikliği geri alır', () => {
    const state = run(
      dictate('Toplantı yarın. Gündem hazır.'),
      dictate('Nova, son cümleyi sil.'),
      dictate('Nova, geri al.'),
    )
    expect(state.text).toBe('Toplantı yarın. Gündem hazır.')
    expect(state.feedback?.type).toBe('undone')
  })

  it('geri alma düğmesi de aynı şekilde çalışır ve art arda kullanılabilir', () => {
    let state = run(dictate('Bir.'), dictate('İki.'), dictate('Üç.'))
    state = editorReducer(state, { type: 'undo' })
    expect(state.text).toBe('Bir. İki.')
    state = editorReducer(state, { type: 'undo' })
    expect(state.text).toBe('Bir.')
  })

  it('aynı parçada söylenen metni "geri al" ile hemen geri alır', () => {
    const state = run(dictate('Bir.'), dictate('Yanlış oldu. Nova, geri al.'))
    expect(state.text).toBe('Bir.')
  })

  it('elle yazılanları önce, tek seferde geri alır', () => {
    let state = run(dictate('Merhaba.'))
    state = editorReducer(state, { type: 'type', text: 'Merhaba. D' })
    state = editorReducer(state, { type: 'type', text: 'Merhaba. Dü' })
    state = editorReducer(state, { type: 'type', text: 'Merhaba. Dünya' })
    state = editorReducer(state, { type: 'undo' })
    expect(state.text).toBe('Merhaba.')
  })

  it('geri alınacak ya da silinecek bir şey yoksa bunu bildirir', () => {
    expect(run({ type: 'undo' }).feedback?.type).toBe('nothing-to-undo')
    expect(run(dictate('Nova, son cümleyi sil')).feedback?.type).toBe('nothing-to-delete')
  })

  it('tanınmayan komutu metin olarak ekler ve bildirir', () => {
    const state = run(dictate('Nova, son paragrafı sil.'))
    expect(state.text).toBe('Nova, son paragrafı sil.')
    expect(state.feedback).toMatchObject({ type: 'unrecognized', phrase: 'Nova, son paragrafı sil.' })
  })

  it('her yeni bildirimde kimliği artırır', () => {
    const state = run(dictate('Bir.'), dictate('Nova, geri al'), dictate('Nova, geri al'))
    expect(state.feedback).toMatchObject({ id: 2, type: 'nothing-to-undo' })
  })
})
