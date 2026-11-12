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
  it('başka bir notu yükler; komut geçmişini korur, bekleyen bildirimi ve komut kelimesini unutur', () => {
    const before = run(dictate('Bir.'), press({ type: 'delete-all' }), dictate('Nova.'))
    expect(before.log).toHaveLength(1)
    const saved = run(type('Öteki not.'), type('Öteki not. Ek.'))

    const loaded = editorReducer(before, { type: 'load', state: saved })
    expect(loaded.text).toBe('Öteki not. Ek.')
    expect(loaded.past).toEqual(saved.past)
    expect(loaded.log).toBe(before.log)
    expect(loaded.feedback).toBeNull()
    expect(loaded.pendingWake).toBeNull()
  })

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

  it('komut kelimesinin etrafındaki virgülleri çiftlemez', () => {
    expect(run(dictate('Merhaba, Nova, virgül, nasılsın?')).text).toBe('Merhaba, nasılsın?')
  })

  describe('komut kelimesinden sonra duraklama', () => {
    it('tek başına gelen "Nova"yı yazmaz, komutu bir sonraki parçadan alır', () => {
      let state = run(dictate('Toplantı yarın. Gündem hazır.'), dictate('Nova.'))
      expect(state.text).toBe('Toplantı yarın. Gündem hazır.')
      expect(state.pendingWake).toBe('Nova.')
      state = editorReducer(state, dictate('Son cümleyi sil.'))
      expect(state.text).toBe('Toplantı yarın.')
      expect(state.pendingWake).toBeNull()
      expect(state.log.at(-1)?.source).toBe('Nova, Son cümleyi sil')
    })

    it('sonraki parça komut değilse ikisini de metne yazar ve bildirir', () => {
      const state = run(dictate('No va!'), dictate('Projesi çok güzel ilerliyor.'))
      expect(state.text).toBe('No va, Projesi çok güzel ilerliyor.')
      expect(state.feedback).toMatchObject({ type: 'unrecognized' })
    })

    it('mikrofon kapanınca ya da elle yazılınca bekleyen komut kelimesini unutur', () => {
      const ended = run(dictate('Nova.'), { type: 'speech-ended' }, dictate('Son cümleyi sil.'))
      expect(ended.text).toBe('Son cümleyi sil.')
      expect(run(dictate('Nova.'), type('Merhaba')).pendingWake).toBeNull()
    })
  })

  it('kesme işaretiyle eklenmiş eki tırnağa ve büyük harfe kelimeyle birlikte alır', () => {
    let state = run(dictate("ankara'ya gidiyorum."), dictate('Nova, ankara kelimesini büyük harfle yaz.'))
    expect(state.text).toBe("Ankara'ya gidiyorum.")
    state = editorReducer(state, dictate('Nova, ankara kelimesini tırnak içine al.'))
    expect(state.text).toBe("“Ankara'ya” gidiyorum.")
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

  it('"üç kez geri al" birden fazla değişikliği geri alır, "iki kez yinele" yineler', () => {
    let state = run(dictate('Bir.'), dictate('İki.'), dictate('Üç.'), dictate('Dört.'))
    state = editorReducer(state, dictate('Nova, üç kez geri al.'))
    expect(state.text).toBe('Bir.')
    expect(state.feedback).toMatchObject({ type: 'undone', count: 3 })
    state = editorReducer(state, dictate('Nova, iki kez yinele.'))
    expect(state.text).toBe('Bir. İki. Üç.')
    expect(editorReducer(state, dictate('Nova, beş kez yinele.')).feedback).toMatchObject({
      type: 'redone',
      count: 1,
    })
  })

  it('"kopyala" seçimi, "metni kopyala" bütün metni kopyalatır', () => {
    const state = run(dictate('Toplantı yarın saat onda.'), dictate('Nova, yarın kelimesini seç.'))
    expect(editorReducer(state, dictate('Nova, kopyala.')).feedback).toMatchObject({
      type: 'copy',
      text: 'yarın',
      selection: true,
    })
    expect(editorReducer(state, dictate('Nova, metni kopyala.')).feedback).toMatchObject({
      type: 'copy',
      text: 'Toplantı yarın saat onda.',
      selection: false,
    })
  })

  it('yalnızca imleci taşıyan komutları geçmişe yazmaz', () => {
    const state = run(dictate('Bir.'), dictate('İki.'), dictate('Nova, başa git.'), undo)
    expect(state.text).toBe('Bir.')
  })

  it('aynı parçada söylenen metni "geri al" ile hemen geri alır; geri alınan yinelenebilir', () => {
    let state = run(dictate('Bir.'), dictate('Yanlış oldu. Nova, geri al.'))
    expect(state.text).toBe('Bir.')
    state = editorReducer(state, dictate('Nova, yinele.'))
    expect(state.text).toBe('Bir. Yanlış oldu.')
    expect(state.feedback?.type).toBe('redone')
  })

  it('aynı parçadaki "geri al" yalnızca son değişikliği geri alır; parça yine tek değişiklik sayılır', () => {
    const commandSpeech = (segment: string): EditorAction => ({
      type: 'command-speech',
      segment,
      wakeWord: DEFAULT_WAKE_WORD,
      at: 0,
    })
    let state = run(dictate('Bir. İki. Üç.'), commandSpeech('son cümleyi sil, son cümleyi sil ve geri al'))
    expect(state.text).toBe('Bir. İki.')
    // Parçada kalan değişiklik (bir cümle silmek) tek seferde geri alınır.
    state = editorReducer(state, undo)
    expect(state.text).toBe('Bir. İki. Üç.')
  })

  it('bir parçadaki bütün değişiklikler tek seferde geri alınır', () => {
    const state = run(dictate('Bir.'), dictate('İki. Nova, yeni satır. Üç.'), undo)
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

  it('duraklatılınca "devam et" denene kadar söyleneni yazmaz, komutları uygulamaz', () => {
    const paused = [dictate('Bir.'), dictate('Nova, duraklat.'), dictate('Bu yazılmaz.'), dictate('Nova, her şeyi sil.')]
    const state = run(...paused)
    expect(state.text).toBe('Bir.')
    expect(state.paused).toBe(true)
    expect(state.feedback?.type).toBe('pause-listening')

    // "devam et"ten önce söylenen atılır, sonrası yazılır.
    const resumed = run(...paused, dictate('Bu da yazılmaz. Nova, devam et. İki.'))
    expect(resumed.text).toBe('Bir. İki.')
    expect(resumed.paused).toBe(false)
    expect(resumed.log.map((entry) => entry.detail?.type)).toEqual(['pause-listening', 'resume-listening'])
  })

  it('"duraklat"tan sonra aynı parçada söyleneni yazmaz; tek başına "Nova" ile de devam edilir', () => {
    const state = run(dictate('Bir. Nova, duraklat. İki.'))
    expect(state.text).toBe('Bir.')
    expect(run(dictate('Bir. Nova, duraklat. İki.'), dictate('Nova.'), dictate('Devam et.'), dictate('Üç.')).text).toBe(
      'Bir. Üç.',
    )
  })

  it('duraklatılmışken düğmeler çalışır; mikrofon kapanınca duraklatma biter', () => {
    const state = run(dictate('Bir.'), dictate('Nova, duraklat.'), press({ type: 'delete-all' }))
    expect(state.text).toBe('')
    expect(state.paused).toBe(true)
    expect(editorReducer(state, { type: 'speech-ended' }).paused).toBe(false)
  })

  it('kesilen metni yapıştırır; "ve" ile tek seferde de olur', () => {
    const cut = run(dictate('Bir. İki. Üç.'), dictate('Nova, son cümleyi kes.'))
    expect(cut.text).toBe('Bir. İki.')
    expect(cut.feedback).toMatchObject({ type: 'cut', text: 'Üç.' })
    expect(cut.clipboard).toBe('Üç.')

    const pasted = run(dictate('Bir. İki. Üç.'), dictate('Nova, son cümleyi kes.'), dictate('Nova, başa git.'), dictate('Nova, yapıştır.'))
    expect(pasted.text).toBe('Üç. Bir. İki.')
    expect(pasted.feedback).toMatchObject({ type: 'pasted', text: 'Üç.' })
    expect(run(dictate('Bir. İki. Üç.'), dictate('Nova, son cümleyi kes ve başa git ve yapıştır.')).text).toBe(
      'Üç. Bir. İki.',
    )
  })

  it('"kes" seçimi, seçim yoksa son söyleneni keser; yapıştırılan "bunu" olur', () => {
    const state = run(dictate('İlk cümle.'), dictate('Fazla cümle.'), dictate('Nova, kes.'), dictate('Nova, yapıştır.'))
    expect(state.text).toBe('İlk cümle. Fazla cümle.')
    expect(run(dictate('İlk cümle.'), dictate('Fazla cümle.'), dictate('Nova, kes.'), dictate('Nova, yapıştır.'), dictate('Nova, bunu sil.')).text).toBe(
      'İlk cümle.',
    )
    expect(run(type('Hiç söylenmedi.'), dictate('Nova, kes.')).feedback).toMatchObject({ type: 'missing', what: 'target' })
  })

  it('kopyalanan metni de yapıştırır; pano boşsa bildirir', () => {
    expect(run(dictate('Merhaba.'), dictate('Nova, metni kopyala.'), dictate('Nova, yapıştır.')).text).toBe('Merhaba. Merhaba.')
    expect(run(dictate('Merhaba.'), dictate('Nova, yapıştır.')).feedback).toMatchObject({ type: 'missing', what: 'clipboard' })
  })

  it('pano not değişince korunur', () => {
    const cut = run(dictate('Bir. İki.'), dictate('Nova, son cümleyi kes.'))
    const loaded = editorReducer(cut, { type: 'load', state: { ...initialEditorState, text: 'Öteki not.' } })
    expect(editorReducer(loaded, dictate('Nova, yapıştır.')).text).toBe('Öteki not. İki.')
  })

  it('cümleyi ya da son söyleneni başa veya sona taşır; tek seferde geri alınır', () => {
    expect(run(dictate('Bir. İki. Üç.'), dictate('Nova, son cümleyi başa taşı.')).text).toBe('Üç. Bir. İki.')
    expect(run(dictate('Bir. İki. Üç.'), dictate('Nova, ilk cümleyi sona taşı.')).text).toBe('İki. Üç. Bir.')
    const moved = run(dictate('Merhaba dünya.'), dictate('Bugün güzel.'), dictate('Nova, bunu başa taşı.'))
    expect(moved.text).toBe('Bugün güzel. Merhaba dünya.')
    expect(moved.feedback).toMatchObject({ type: 'text-moved', text: 'Bugün güzel.', to: 'start' })
    expect(editorReducer(moved, undo).text).toBe('Merhaba dünya. Bugün güzel.')
    expect(run(dictate('Bir.'), dictate('Nova, dördüncü cümleyi başa taşı.')).feedback).toMatchObject({
      type: 'missing',
      what: 'sentence',
    })
  })

  it('kelime birebir yoksa ek almış halini seçer', () => {
    const state = run(dictate('Raporu yarın gönder.'), dictate('Nova, rapor kelimesini seç.'))
    expect(state.selection).toEqual({ start: 0, end: 6 })
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
