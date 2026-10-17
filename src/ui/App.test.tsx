import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../speech/index.ts'
import type { TranscriberHandlers } from '../speech/transcriber.ts'
import App from './App.tsx'

// Gerçek mikrofon ve Whisper yerine, testin istediği metni "duyan" sahte bir servis.
const speech = vi.hoisted(() => {
  let handlers: TranscriberHandlers | null = null
  const service: SpeechService = {
    name: 'Whisper',
    offlineHint: '',
    isAvailable: async () => true,
    transcriber: {
      start: (next) => {
        handlers = next
      },
      stop: () => {
        handlers?.onEnd()
        handlers = null
      },
    },
  }
  return {
    service,
    get handlers() {
      return handlers
    },
  }
})

vi.mock('../speech/index.ts', () => ({ createSpeechService: () => speech.service }))

/** Konuşma tanımadan kesinleşmiş bir parça gelmiş gibi yapar. */
function say(text: string) {
  act(() => speech.handlers?.onFinal(text))
}

const editor = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Metin' })
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })

async function renderApp() {
  render(<App />)
  // Servis durumu açılışta bir kez denetlenir; sonucu gelmeden teste başlanmaz.
  await screen.findByText('Whisper hazır')
  return userEvent.setup()
}

beforeEach(() => {
  // jsdom tuvale çizemez; ses göstergesi testlerde boş kalır.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('uygulama', () => {
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

  it('metni panoya kopyalar', async () => {
    localStorage.setItem('nova-dictation:draft', 'Kopyalanacak metin.')
    const user = await renderApp()
    await user.click(button('Metni kopyala'))
    expect(await navigator.clipboard.readText()).toBe('Kopyalanacak metin.')
    expect(screen.getByText('Metin panoya kopyalandı.')).toBeTruthy()
  })

  it('dikteyi metne yazar ve sesli komutları uygular', async () => {
    const user = await renderApp()
    await user.click(button('Mikrofon'))

    // Konuşurken gelen ara metin yazının devamında soluk gösterilir.
    act(() => speech.handlers?.onPartial('Toplantı yarın'))
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

  it('⌥ Boşluk mikrofonu açar; Esc önce dinlemeyi durdurur, sonra paneli kapatır', async () => {
    const user = await renderApp()
    await user.click(button('Komutlar'))

    await user.keyboard('{Alt>} {/Alt}')
    expect(speech.handlers).not.toBeNull()

    await user.keyboard('{Escape}')
    expect(speech.handlers).toBeNull()
    expect(screen.getByRole('heading', { name: 'Komutlar' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: 'Komutlar' })).toBeNull()
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
})
