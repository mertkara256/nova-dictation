import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../speech/index.ts'
import type { TranscriberHandlers } from '../speech/transcriber.ts'
import App from './App.tsx'
import { COMMAND_KEY_HOLD_MS } from './shortcuts.ts'

// Gerçek mikrofon ve Whisper yerine, testin istediği metni "duyan" sahte bir servis.
const speech = vi.hoisted(() => {
  const state = {
    handlers: null as TranscriberHandlers | null,
    commandMode: false,
    available: true,
    loading: false,
    /** Mikrofonun kaç kez açıldığı. */
    starts: 0,
    retries: 0,
    /** Servise en son verilen özel kelimeler. */
    vocabulary: [] as string[],
  }
  const service: SpeechService = {
    name: 'Whisper',
    offlineHint: '',
    isAvailable: async () => state.available,
    getStatus: async () => state.loading ? 'loading' : state.available ? 'ready' : 'offline',
    transcriber: {
      start: (next) => {
        state.handlers = next
        state.starts++
      },
      stop: () => {
        state.handlers?.onEnd()
        state.handlers = null
      },
      retry: () => {
        state.retries++
        state.handlers?.onRetryAvailable?.(false)
      },
      cancel: () => {
        state.handlers?.onRetryAvailable?.(false)
        state.handlers?.onPartial('')
        state.handlers?.onEnd()
        state.handlers = null
      },
      setCommandMode: (active) => {
        state.commandMode = active
      },
    },
    setVocabulary: (words) => {
      state.vocabulary = words
    },
  }
  return { service, state }
})

vi.mock('../speech/index.ts', () => ({ createSpeechService: () => speech.service }))

/** Konuşma tanımadan kesinleşmiş bir parça gelmiş gibi yapar (komut modundaysa komut olarak). */
function say(text: string) {
  const { handlers, commandMode } = speech.state
  act(() => (commandMode ? handlers?.onCommand?.(text) : handlers?.onFinal(text)))
}

const editor = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Metin' })
const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name })

/** Komut tuşunu (⌃) komut modu başlayacak kadar basılı tutar. */
async function holdCommandKey(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('{Control>}')
  await act(() => new Promise((resolve) => setTimeout(resolve, COMMAND_KEY_HOLD_MS + 50)))
}

async function renderApp() {
  render(<App />)
  // Servis durumu açılışta bir kez denetlenir; sonucu gelmeden teste başlanmaz.
  await screen.findByText(speech.state.available ? 'Whisper hazır' : 'Whisper kapalı')
  return userEvent.setup()
}

beforeEach(() => {
  localStorage.setItem('nova-dictation:setup-seen', '1')
  Object.assign(speech.state, {
    handlers: null,
    commandMode: false,
    available: true,
    loading: false,
    starts: 0,
    retries: 0,
    vocabulary: [],
  })
  // jsdom tuvale çizemez; ses göstergesi testlerde boş kalır.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('uygulama', () => {
  it('model yüklenirken mikrofonu açmaz', async () => {
    speech.state.loading = true
    render(<App />)
    await screen.findByText('Whisper model yükleniyor')
    expect(button('Mikrofon').disabled).toBe(true)
    const user = userEvent.setup()
    await user.keyboard('{Alt>}m{/Alt}')
    expect(speech.state.starts).toBe(0)
  })

  it('ilk kullanımda rehberi açar; komut denemeleri taslağa dokunmaz ve kapatma hatırlanır', async () => {
    localStorage.removeItem('nova-dictation:setup-seen')
    const user = await renderApp()
    expect(screen.getByRole('heading', { name: 'İlk kullanım rehberi' })).toBeTruthy()
    expect(button('Mikrofon').disabled).toBe(true)
    const reason = 'İlk kullanım rehberi açıkken dikte kapalı; rehberi kapatınca mikrofona basıp konuşabilirsin.'
    expect(screen.getByText(reason)).toBeTruthy()
    await user.click(button(/Nova, son cümleyi sil/))
    expect(editor().value).toBe('')
    await user.click(button('Editöre geç'))
    expect(localStorage.getItem('nova-dictation:setup-seen')).toBe('1')
    expect(button('Mikrofon').disabled).toBe(false)
    expect(screen.queryByText(reason)).toBeNull()
    await user.click(button('Ayarlar'))
    await user.click(button('İlk kullanım rehberi'))
    expect(screen.getByRole('heading', { name: 'İlk kullanım rehberi' })).toBeTruthy()
  })

  it('taslak kaydedilemediğinde bildirir ve güncel metni yeniden kaydeder', async () => {
    const user = await renderApp()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('dolu') })
    await user.type(editor(), 'Kaybolmasın.')
    expect(await screen.findByText(/Taslak kaydedilemedi/)).toBeTruthy()
    // Yazmaya devam edilse de, kayıt başarılı olana kadar uyarı kaybolmaz.
    await user.type(editor(), ' Hâlâ.')
    expect(screen.getByText(/Taslak kaydedilemedi/)).toBeTruthy()
    write.mockRestore()
    await user.click(button('Kaydetmeyi yeniden dene'))
    expect(screen.queryByText(/Taslak kaydedilemedi/)).toBeNull()
    expect(localStorage.getItem('nova-dictation:draft')).toBe('Kaybolmasın. Hâlâ.')
  })

  it('başarısız sesi yeniden denerken mikrofonu açmaz ve işlem bitince düğmeyi etkinleştirir', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    act(() => {
      speech.state.handlers?.onRetryAvailable?.(true)
      speech.state.handlers?.onError('timeout')
      speech.state.handlers?.onEnd()
    })
    expect(button('Mikrofon').disabled).toBe(true)
    await user.click(button('Yeniden dene'))
    expect(speech.state.retries).toBe(1)
    expect(speech.state.starts).toBe(1)
    expect(screen.getByText('Bekleyen ses yazıya çevriliyor…')).toBeTruthy()
    say('Kurtarılan metin.')
    act(() => speech.state.handlers?.onEnd())
    expect(editor().value).toBe('Kurtarılan metin.')
    expect(button('Mikrofon').disabled).toBe(false)
    expect(screen.queryByText('Yeniden dene')).toBeNull()
  })

  it('bekleyen sesten vazgeçmek mevcut taslağı korur', async () => {
    localStorage.setItem('nova-dictation:draft', 'Önceki metin.')
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    act(() => {
      speech.state.handlers?.onRetryAvailable?.(true)
      speech.state.handlers?.onError('transcription')
      speech.state.handlers?.onEnd()
    })
    await user.click(button('Bekleyen sesten vazgeç'))
    expect(editor().value).toBe('Önceki metin.')
    expect(button('Mikrofon').disabled).toBe(false)
    expect(screen.queryByText('Yeniden dene')).toBeNull()
  })

  it('kayıtlı taslakla açılır ve yazılanı kaydeder', async () => {
    localStorage.setItem('nova-dictation:draft', 'Dünkü not.')
    const user = await renderApp()
    expect(editor().value).toBe('Dünkü not.')

    await user.type(editor(), ' Yeni cümle.')
    await waitFor(() =>
      expect(localStorage.getItem('nova-dictation:draft')).toBe('Dünkü not. Yeni cümle.'),
    )
  })

  it('Temizle düğmesiyle silinen metin geri alınabilir', async () => {
    localStorage.setItem('nova-dictation:draft', 'Bir. İki.')
    const user = await renderApp()

    await user.click(button('Metni temizle'))
    expect(editor().value).toBe('')
    expect(screen.getByText('Tüm metin silindi.')).toBeTruthy()

    await user.click(button('Geri al'))
    expect(editor().value).toBe('Bir. İki.')
  })

  it('sayfa yenilenmeden önce silinen metni geri getirmeyi önerir', async () => {
    localStorage.setItem('nova-dictation:cleared-draft', 'Dünkü toplantı notları.')
    const user = await renderApp()
    expect(screen.getByText(/Son silinen metin: “Dünkü toplantı notları.”/)).toBeTruthy()

    await user.click(button('Geri getir'))
    expect(editor().value).toBe('Dünkü toplantı notları.')
    expect(screen.queryByText(/Son silinen metin/)).toBeNull()
    expect(localStorage.getItem('nova-dictation:cleared-draft')).toBeNull()
  })

  it('taslak boş değilse silinen metni önermez', async () => {
    localStorage.setItem('nova-dictation:draft', 'Bugünkü not.')
    localStorage.setItem('nova-dictation:cleared-draft', 'Dünkü not.')
    await renderApp()
    expect(screen.queryByText(/Son silinen metin/)).toBeNull()
  })

  it('metni panoya kopyalar', async () => {
    localStorage.setItem('nova-dictation:draft', 'Kopyalanacak metin.')
    const user = await renderApp()
    await user.click(button('Metni kopyala'))
    expect(await navigator.clipboard.readText()).toBe('Kopyalanacak metin.')
    expect(screen.getByText('Metin panoya kopyalandı.')).toBeTruthy()
  })

  it('özel kelimeleri kaydeder ve konuşma tanıma servisine verir', async () => {
    localStorage.setItem('nova-dictation:vocabulary', 'Kubernetes')
    const user = await renderApp()
    expect(speech.state.vocabulary).toEqual(['Kubernetes'])

    await user.click(button('Ayarlar'))
    const field = screen.getByRole('textbox', { name: 'Özel kelimeler' })
    await user.clear(field)
    await user.type(field, 'Ayşe Hanım, Kubernetes')
    await user.click(button('Özel kelimeleri kaydet'))

    expect(speech.state.vocabulary).toEqual(['Ayşe Hanım', 'Kubernetes'])
    expect(localStorage.getItem('nova-dictation:vocabulary')).toBe('Ayşe Hanım\nKubernetes')
  })

  it('metin panoya kopyalanamazsa "kopyalandı" demez, uyarı gösterir', async () => {
    localStorage.setItem('nova-dictation:draft', 'Kopyalanacak metin.')
    const user = await renderApp()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('izin yok'))
    await user.click(button('Metni kopyala'))

    expect(await screen.findByText(/Metin panoya kopyalanamadı/)).toBeTruthy()
    expect(screen.queryByText('Metin panoya kopyalandı.')).toBeNull()
  })

  it('"Nova, kopyala" seçim varken yalnızca seçimi kopyalar', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Toplantı yarın saat onda.')
    say('Nova, yarın kelimesini seç.')
    say('Nova, kopyala.')

    expect(await navigator.clipboard.readText()).toBe('yarın')
    expect(await screen.findByText('Seçili metin panoya kopyalandı.')).toBeTruthy()
  })

  it('dikteyi metne yazar ve sesli komutları uygular', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))

    // Konuşurken gelen ara metin yazının devamında soluk gösterilir.
    act(() => speech.state.handlers?.onPartial('Toplantı yarın'))
    expect(document.querySelector('.ghost')?.textContent).toBe('Toplantı yarın')

    say('Toplantı yarın. Gündem hazır.')
    say('Nova, son cümleyi sil.')
    expect(editor().value).toBe('Toplantı yarın.')
    expect(screen.getByText('Cümle silindi: “Gündem hazır.”')).toBeTruthy()

    say('Nova, komutları göster.')
    expect(screen.getByRole('heading', { name: 'Komutlar' })).toBeTruthy()

    await user.click(button('Geçmiş'))
    expect(screen.getByText('“Nova, son cümleyi sil”')).toBeTruthy()
  })

  it('mikrofon kısayolu mikrofonu açar; Esc önce dinlemeyi durdurur, sonra paneli kapatır', async () => {
    const user = await renderApp()
    await user.click(button('Komutlar'))

    // Testlerdeki tarayıcı Mac değil; mikrofon kısayolu Alt + M.
    await user.keyboard('{Alt>}m{/Alt}')
    expect(speech.state.handlers).not.toBeNull()

    await user.keyboard('{Escape}')
    expect(speech.state.handlers).toBeNull()
    expect(screen.getByRole('heading', { name: 'Komutlar' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: 'Komutlar' })).toBeNull()
  })

  it('açık paneli metin alanından ayrı, yanındaki bölümde gösterir', async () => {
    const user = await renderApp()
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(button('Komutlar'))
    const side = screen.getByRole('complementary')
    expect(within(side).getByRole('heading', { name: 'Komutlar' })).toBeTruthy()
    expect(within(screen.getByRole('main')).getByRole('textbox', { name: 'Metin' })).toBeTruthy()
  })

  it('komut kelimesi değiştirilince komutları yeni kelimeyle tanır', async () => {
    const user = await renderApp()
    await user.click(button('Ayarlar'))
    const input = screen.getByRole('textbox', { name: 'Komut kelimesi' })
    await user.clear(input)
    await user.type(input, 'asistan{Enter}')

    expect(screen.getByText('Komutlar “Asistan” ile başlar')).toBeTruthy()
    expect(localStorage.getItem('nova-dictation:wake-word')).toBe('Asistan')

    await user.click(button('Mikrofon'))
    say('Bir. İki. Asistan, son cümleyi sil.')
    expect(editor().value).toBe('Bir.')

    // Eski kelime artık sıradan bir kelime.
    say('Nova, yeni satır.')
    expect(editor().value).toBe('Bir. Nova, yeni satır.')
  })

  it('"Nova" deyip duraklayınca komutu bekler ve bunu gösterir', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Toplantı yarın. Gündem hazır.')
    say('Nova.')
    expect(screen.getByText('Dinleniyor…')).toBeTruthy()
    say('Son cümleyi sil.')
    expect(editor().value).toBe('Toplantı yarın.')
    expect(screen.queryByText('Dinleniyor…')).toBeNull()
  })

  describe('komut tuşu (⌃)', () => {
    it('⌃C gibi kısayollarda mikrofonu açmaz', async () => {
      localStorage.setItem('nova-dictation:draft', 'Toplantı yarın.')
      const user = await renderApp()
      await user.click(editor())
      await user.keyboard('{Control>}c{/Control}')
      await act(() => new Promise((resolve) => setTimeout(resolve, COMMAND_KEY_HOLD_MS + 50)))
      expect(speech.state.starts).toBe(0)
      expect(screen.queryByText('Dinleniyor…')).toBeNull()
    })

    it('basılıyken söyleneni komut olarak uygular; mikrofonu yalnızca o süre için açar', async () => {
      localStorage.setItem('nova-dictation:draft', 'Toplantı yarın. Gündem hazır.')
      const user = await renderApp()

      await holdCommandKey(user)
      expect(speech.state.handlers).not.toBeNull()
      expect(screen.getByText('Dinleniyor…')).toBeTruthy()

      say('Son cümleyi sil.')
      await user.keyboard('{/Control}')
      expect(speech.state.handlers).toBeNull()
      expect(editor().value).toBe('Toplantı yarın.')
      expect(screen.getByText('Cümle silindi: “Gündem hazır.”')).toBeTruthy()
    })

    it('dikte sürerken basılırsa mikrofonu açık bırakır ve sonrası yine metne yazılır', async () => {
      const user = await renderApp()
      await user.click(button('Mikrofon'))
      say('Bir. İki.')

      await holdCommandKey(user)
      say('Son cümleyi sil.')
      await user.keyboard('{/Control}')
      say('Üç.')

      expect(speech.state.handlers).not.toBeNull()
      expect(editor().value).toBe('Bir. Üç.')
    })

    it('anlaşılamayan komutu metne yazmaz, bildirir', async () => {
      localStorage.setItem('nova-dictation:draft', 'Toplantı yarın.')
      const user = await renderApp()
      await holdCommandKey(user)
      say('Sayfayı çevir.')
      await user.keyboard('{/Control}')

      expect(editor().value).toBe('Toplantı yarın.')
      expect(screen.getByText('Komut anlaşılamadı: “Sayfayı çevir.”')).toBeTruthy()
    })

    it('Whisper kapalıyken mikrofonu açmaz, komut kelimesini hatırlatır', async () => {
      speech.state.available = false
      const user = await renderApp()
      await holdCommandKey(user)
      expect(speech.state.handlers).toBeNull()
      expect(screen.getByText(/Tuşla komut vermek için Whisper/)).toBeTruthy()
    })
  })
})
