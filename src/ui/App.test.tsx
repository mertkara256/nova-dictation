import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../speech/index.ts'
import type { TranscriberHandlers } from '../speech/transcriber.ts'
import App from './App.tsx'
import { loadDraft } from './draft.ts'
import { addNote, loadNotes, saveNotes, setNoteText } from './notes.ts'
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
    /** Bekleyen sesin kaç kez atıldığı. */
    cancels: 0,
    /** Servise en son verilen özel kelimeler. */
    vocabulary: [] as string[],
    /** Kullanıcı tarayıcının tanımasına geçmeye izin verdi mi? */
    fallbackAllowed: false,
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
        state.cancels++
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
    allowFallback: () => {
      state.fallbackAllowed = true
    },
    recorder: {
      enabled: false,
      onRecording: null,
      markCommandMode: () => {},
      wrap: (open) => open,
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
    cancels: 0,
    vocabulary: [],
    fallbackAllowed: false,
  })
  // jsdom tuvale çizemez; ses göstergesi testlerde boş kalır.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('uygulama', () => {
  it('deneme sürümünde bunu ve asıl sürümden farkını başlığın altında söyler', async () => {
    vi.stubEnv('MODE', 'demo')
    try {
      await renderApp()
      expect(screen.getByText('Deneme sürümü.')).toBeTruthy()
      expect(screen.getByRole('link', { name: 'uygulamayı bilgisayarına kur' })).toBeTruthy()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('bilgisayarda çalışan sürümde deneme açıklaması yoktur', async () => {
    await renderApp()
    expect(screen.queryByText('Deneme sürümü.')).toBeNull()
  })

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
    const reason = 'İlk kullanım rehberi açıkken bu metne dikte kapalı; komutları rehberde söyleyerek deneyebilirsin.'
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

  it('rehberde söylenenleri yalnızca rehberin deneme metnine yazar', async () => {
    localStorage.setItem('nova-dictation:draft', 'Asıl taslak.')
    const user = await renderApp()
    await user.click(button('Ayarlar'))
    await user.click(button('İlk kullanım rehberi'))
    await user.click(button('Mikrofonu aç'))
    say('Nova, son cümleyi sil.')

    expect(screen.getByLabelText('Deneme metni').textContent).toBe('Bugün bir deneme yapıyorum.')
    expect(editor().value).toBe('Asıl taslak.')
    // Rehber kapanınca rehberin mikrofonu da kapanır.
    await user.click(button('Editöre geç'))
    expect(speech.state.cancels).toBe(1)
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
    expect(loadDraft()).toBe('Kaybolmasın. Hâlâ.')
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
    await waitFor(() => expect(loadDraft()).toBe('Dünkü not. Yeni cümle.'))
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

    // Uyarı, başka bir komut verilene kadar kalır.
    await user.type(editor(), ' Ek.')
    expect(screen.getByText(/Metin panoya kopyalanamadı/)).toBeTruthy()
    await user.click(button('Metni temizle'))
    expect(screen.queryByText(/Metin panoya kopyalanamadı/)).toBeNull()
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

  it('art arda verilen komutların her birinin işi yapılır, yalnızca sonuncusunun değil', async () => {
    localStorage.setItem('nova-dictation:draft', 'Kopyalanacak metin.')
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Nova, kopyala ve her şeyi sil.')
    expect(editor().value).toBe('')
    expect(await navigator.clipboard.readText()).toBe('Kopyalanacak metin.')

    say('Nova, dinlemeyi durdur ve her şeyi seç.')
    expect(speech.state.cancels).toBe(1)
    expect(button('Mikrofon').getAttribute('aria-pressed')).toBe('false')
  })

  it('"komutları göster" not değiştirildikten sonra da listeyi açar', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Nova, komutları göster.')
    expect(screen.getByRole('heading', { name: 'Komutlar' })).toBeTruthy()

    await user.click(button('Notlar'))
    await user.type(editor(), 'Bir not.')
    await user.click(button('Yeni not'))
    say('Nova, komutları göster.')
    expect(screen.getByRole('heading', { name: 'Komutlar' })).toBeTruthy()
  })

  it('"dinlemeyi durdur" komuttan sonra söylenip henüz işlenmemiş sesi metne yazmadan atar', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Merhaba. Nova, dinlemeyi durdur.')
    expect(speech.state.cancels).toBe(1)
    expect(button('Mikrofon').getAttribute('aria-pressed')).toBe('false')
    expect(editor().value).toBe('Merhaba.')
  })

  it('"dinlemeyi durdur" oturum bittikten sonra işlenirse mikrofonu kilitlemez', async () => {
    // Whisper'da durdurulan oturum, son yanıt gelince önce metni verir, birkaç mikro görev sonra biter.
    const stop = vi.spyOn(speech.service.transcriber!, 'stop').mockImplementation(() => {})
    try {
      const user = await renderApp()
      await user.click(button('Mikrofon'))
      await user.click(button('Mikrofon'))
      const { handlers } = speech.state
      await act(async () => {
        handlers?.onFinal('Nova, dinlemeyi durdur.')
        await Promise.resolve()
        handlers?.onEnd()
        speech.state.handlers = null
      })

      expect(button('Mikrofon').disabled).toBe(false)
      await user.click(button('Mikrofon'))
      expect(speech.state.starts).toBe(2)
    } finally {
      stop.mockRestore()
    }
  })

  it('"kes" metni panoya da kopyalar; "yapıştır" geri yazar', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Merhaba.')
    say('Nova, bunu kes.')
    expect(editor().value).toBe('')
    expect(await navigator.clipboard.readText()).toBe('Merhaba.')
    say('Nova, yapıştır.')
    expect(editor().value).toBe('Merhaba.')
  })

  it('"duraklat" denince gri metni gizler ve duraklatıldığını gösterir; "devam et" ile sürer', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    say('Nova, duraklat.')
    expect(screen.getByText('Devam etmek için “Nova, devam et” de.')).toBeTruthy()
    act(() => speech.state.handlers?.onPartial('gizli konuşma'))
    expect(screen.queryByText('gizli konuşma')).toBeNull()
    say('Gizli konuşma.')
    expect(editor().value).toBe('')

    say('Nova, devam et.')
    say('Merhaba.')
    expect(editor().value).toBe('Merhaba.')
    expect(screen.queryByText('Devam etmek için “Nova, devam et” de.')).toBeNull()
    expect(speech.state.cancels).toBe(0)
  })

  it('Whisper\'a ulaşılamazsa sormadan tarayıcının tanımasına geçmez; sesin nereye gideceğini söyler', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    act(() => {
      speech.state.handlers?.onError('unavailable')
      speech.state.handlers?.onEnd()
    })

    expect(screen.getByRole('alert').textContent).toContain('Whisper sunucusuna ulaşılamadı; mikrofon kapalı.')
    expect(screen.getByText(/ses bilgisayardan çıkar, Google'a\s+ya da Apple'a gider/)).toBeTruthy()
    expect(screen.getByText('npm run whisper')).toBeTruthy()
    expect(button('Mikrofon').getAttribute('aria-pressed')).toBe('false')
    expect(speech.state.fallbackAllowed).toBe(false)
    expect(speech.state.starts).toBe(1)
  })

  it('"Tarayıcının tanımasıyla devam et" izin verir ve yeniden dinler', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    act(() => {
      speech.state.handlers?.onError('unavailable')
      speech.state.handlers?.onEnd()
    })

    await user.click(button('Tarayıcının tanımasıyla devam et'))
    act(() => speech.state.handlers?.onFallback?.())

    expect(speech.state.fallbackAllowed).toBe(true)
    expect(speech.state.starts).toBe(2)
    expect(button('Mikrofon').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Tarayıcının tanımasıyla devam et' })).toBeNull()
    expect(screen.getByText(/ses Google'a ya da Apple'a\s+gidiyor/)).toBeTruthy()
  })

  it('"Yeniden dinle" izin vermeden Whisper\'ı tekrar dener', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    act(() => {
      speech.state.handlers?.onError('unavailable')
      speech.state.handlers?.onEnd()
    })

    await user.click(button('Yeniden dinle'))

    expect(speech.state.fallbackAllowed).toBe(false)
    expect(speech.state.starts).toBe(2)
  })

  it('tarayıcının tanıması doğrudan kullanılıyorsa (deneme sürümü) izin sorulmaz', async () => {
    vi.stubEnv('MODE', 'demo')
    const { allowFallback } = speech.service
    speech.service.allowFallback = undefined
    try {
      const user = await renderApp()
      await user.click(button('Mikrofon'))
      act(() => {
        speech.state.handlers?.onError('unavailable')
        speech.state.handlers?.onEnd()
      })
      expect(screen.getByRole('alert').textContent).toContain('Konuşma tanıma şu an kullanılamıyor.')
      expect(screen.queryByRole('button', { name: 'Tarayıcının tanımasıyla devam et' })).toBeNull()
    } finally {
      speech.service.allowFallback = allowFallback
      vi.unstubAllEnvs()
    }
  })

  it('tarayıcının tanımasına geçildiyse "duraklat" mikrofonu kapatır', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))
    act(() => speech.state.handlers?.onFallback?.())
    say('Nova, duraklat.')
    expect(speech.state.cancels).toBe(1)
    expect(button('Mikrofon').getAttribute('aria-pressed')).toBe('false')
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

  it('ölçüm kaydı açıkken biten kaydı, mikrofonun açıldığı andaki metinle birlikte kaydettirir', async () => {
    const fetch = vi.fn(async () => Response.json({ file: '/Users/ada/nova-test-recordings/deneme.wav' }))
    vi.stubGlobal('fetch', fetch)
    try {
      const user = await renderApp()
      await user.type(editor(), 'Başlangıç.')
      await user.click(button('Ayarlar'))
      await user.click(screen.getByRole('checkbox', { name: 'Ölçüm için kaydet' }))
      expect(speech.service.recorder?.enabled).toBe(true)
      await user.click(button('Ayarlar'))

      await user.click(button('Mikrofon'))
      say('Devamı burada.')
      await user.click(button('Mikrofon'))
      const recording = { samples: new Float32Array(16000), sampleRate: 16000, commandModeChanges: [] }
      act(() => speech.service.recorder?.onRecording?.(recording))
      expect(screen.getByRole('heading', { name: 'Ölçüm kaydı (1 sn)' })).toBeTruthy()

      await user.click(button('Kaydet'))
      expect(await screen.findByText(/Kaydedildi:/)).toBeTruthy()
      const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
      expect(JSON.parse((init.body as FormData).get('info') as string)).toMatchObject({
        initialText: 'Başlangıç.',
        wakeWord: 'Nova',
        expectedText: 'Başlangıç. Devamı burada.',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  describe('notlar', () => {
    it('yeni not açar ve notlar arasında geçer; notlar sayfa yenilense de kalır', async () => {
      localStorage.setItem('nova-dictation:draft', 'İlk not.')
      const user = await renderApp()
      await user.click(button('Notlar'))
      await user.click(button('Yeni not'))
      expect(editor().value).toBe('')
      // Açık not boşken bir yenisi açılmaz.
      expect(button('Yeni not').disabled).toBe(true)
      await user.type(editor(), 'İkinci not.')

      await user.click(button(/^İlk not\./))
      expect(editor().value).toBe('İlk not.')
      await user.click(button(/^İkinci not\./))
      expect(editor().value).toBe('İkinci not.')

      // Sayfa yenilenmiş gibi uygulama baştan açılır.
      cleanup()
      const again = await renderApp()
      expect(editor().value).toBe('İkinci not.')
      await again.click(button('Notlar'))
      expect(button(/^İlk not\./)).toBeTruthy()
      expect(button(/^İkinci not\./).getAttribute('aria-current')).toBe('true')
    })

    it('başka bir sekme başka bir not açsa da bu sekme kendi notuna yazar', async () => {
      localStorage.setItem('nova-dictation:draft', 'Bu sekmenin notu.')
      const user = await renderApp()
      // İkinci sekme yeni bir not açıp içine yazdı; kayıttaki açık not artık o.
      const other = addNote(loadNotes())
      saveNotes(setNoteText(other, other.current, 'Öbür sekmenin notu.'))

      await user.type(editor(), ' Ek.')
      await act(() => new Promise((resolve) => setTimeout(resolve, 500)))
      // Sekme kapanırken de son hali kaydedilir.
      act(() => window.dispatchEvent(new Event('pagehide')))

      const texts = loadNotes().list.map((note) => note.text)
      expect(texts).toEqual(['Bu sekmenin notu. Ek.', 'Öbür sekmenin notu.'])
    })

    it('mikrofon açıkken ya da bekleyen ses varken not değiştirilemez; geç gelen metin kendi notuna yazılır', async () => {
      localStorage.setItem('nova-dictation:draft', 'İlk not.')
      const user = await renderApp()
      await user.click(button('Mikrofon'))
      await user.click(button('Notlar'))
      expect(screen.getByText(/Mikrofon açıkken ya da bekleyen ses yazıya çevrilirken not değiştirilemez/)).toBeTruthy()
      expect(button('Yeni not').disabled).toBe(true)
      expect(button(/^İlk not\./).disabled).toBe(true)
      expect(button(/^Notu sil/).disabled).toBe(true)

      // Yazıya çevirme başarısız oldu; ses yeniden denenmek üzere bekliyor.
      act(() => {
        speech.state.handlers?.onRetryAvailable?.(true)
        speech.state.handlers?.onError('timeout')
        speech.state.handlers?.onEnd()
      })
      expect(button('Yeni not').disabled).toBe(true)
      await user.click(button('Yeniden dene'))
      expect(button('Yeni not').disabled).toBe(true)
      say('Geç gelen cümle.')
      act(() => speech.state.handlers?.onEnd())

      expect(editor().value).toBe('İlk not. Geç gelen cümle.')
      expect(button('Yeni not').disabled).toBe(false)
      expect(screen.queryByText(/not değiştirilemez/)).toBeNull()
    })

    it('her notun kendi geri alma geçmişi vardır', async () => {
      localStorage.setItem('nova-dictation:draft', 'Bir.')
      const user = await renderApp()
      await user.type(editor(), ' İki.')
      await user.click(button('Notlar'))
      await user.click(button('Yeni not'))
      await user.click(button('Mikrofon'))

      say('Nova, geri al.')
      expect(editor().value).toBe('')
      expect(screen.getByText('Geri alınacak bir şey yok.')).toBeTruthy()

      // Not değiştirmek için önce mikrofon kapatılır.
      await user.click(button('Mikrofon'))
      await user.click(button(/^Bir\. İki\./))
      await user.click(button('Mikrofon'))
      say('Nova, geri al.')
      expect(editor().value).toBe('Bir.')
    })

    it('notu onaylayınca siler; açık not silinince en son değişen diğer not açılır', async () => {
      localStorage.setItem('nova-dictation:draft', 'Eski not.')
      const user = await renderApp()
      await user.click(button('Notlar'))
      await user.click(button('Yeni not'))
      await user.type(editor(), 'Yeni metin.')

      await user.click(button('Notu sil: Yeni metin.'))
      expect(screen.getByText('“Yeni metin.” silinsin mi?')).toBeTruthy()
      await user.click(button('Vazgeç'))
      expect(editor().value).toBe('Yeni metin.')

      await user.click(button('Notu sil: Yeni metin.'))
      await user.click(button('Sil'))
      expect(editor().value).toBe('Eski not.')
      expect(screen.queryByRole('button', { name: /^Yeni metin\./ })).toBeNull()
    })

    it('içine hiç yazılmamış boş not, başka bir nota geçilince listeden çıkar', async () => {
      localStorage.setItem('nova-dictation:draft', 'Dolu not.')
      const user = await renderApp()
      await user.click(button('Notlar'))
      await user.click(button('Yeni not'))
      expect(button(/^Boş not/)).toBeTruthy()

      await user.click(button(/^Dolu not\./))
      expect(screen.queryByRole('button', { name: /^Boş not/ })).toBeNull()
    })
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

    it('komut modunu bilmeyen serviste (tarayıcının tanıması) yok sayılır, Komutlar panelinde anılmaz', async () => {
      const transcriber = speech.service.transcriber!
      const { setCommandMode } = transcriber
      delete transcriber.setCommandMode
      try {
        const user = await renderApp()
        await holdCommandKey(user)
        expect(speech.state.handlers).toBeNull()
        expect(screen.queryByText(/Tuşla komut/)).toBeNull()
        await user.keyboard('{/Control}')

        await user.click(button('Komutlar'))
        expect(screen.queryByText(/basılıyken/)).toBeNull()
        expect(screen.queryByText(/basılı tut/)).toBeNull()
      } finally {
        transcriber.setCommandMode = setCommandMode
      }
    })
  })
})
