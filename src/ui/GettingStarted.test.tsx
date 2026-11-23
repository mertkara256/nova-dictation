import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Transcriber, TranscriberHandlers } from '../speech/transcriber.ts'
import { GettingStarted } from './GettingStarted.tsx'
import { memoryStorage } from '../test/memoryStorage.ts'
import { markSetupSeen, shouldShowSetup } from './setupSetting.ts'

const props = {
  wakeWord: 'Asistan', serviceName: 'Whisper', localModel: true, transcriber: null,
  status: 'ready' as const, onRecheck: vi.fn(), onClose: vi.fn(),
}

/** Testin istediği metni "duyan" sahte konuşma tanıma. */
function fakeSpeech() {
  let handlers: TranscriberHandlers | null = null
  const transcriber: Transcriber = {
    start: (next) => {
      handlers = next
    },
    stop: () => {
      handlers?.onEnd()
      handlers = null
    },
  }
  return {
    transcriber,
    say: (text: string) => act(() => handlers?.onFinal(text)),
    get listening() {
      return handlers !== null
    },
  }
}

const example = (phrase: RegExp) => screen.getByRole('button', { name: phrase })

describe('ilk kullanım rehberi', () => {
  it('üç komutu bağımsız deneme metnine uygular', async () => {
    const user = userEvent.setup()
    render(<GettingStarted {...props} />)
    const demo = screen.getByLabelText('Deneme metni')
    const initial = demo.textContent
    await user.click(screen.getByRole('button', { name: /Asistan, son cümleyi sil/ }))
    expect(demo.textContent).toBe('Bugün bir deneme yapıyorum.')
    await user.click(screen.getByRole('button', { name: /Asistan, geri al/ }))
    expect(demo.textContent).toBe(initial)
    await user.click(screen.getByRole('button', { name: /Asistan, yeni paragraf/ }))
    expect(demo.textContent).toBe(initial + '\n\n')
  })

  it('söylenen komutları deneme metnine uygular ve sesle çalışanı işaretler', async () => {
    const user = userEvent.setup()
    const speech = fakeSpeech()
    render(<GettingStarted {...props} transcriber={speech.transcriber} />)
    const demo = screen.getByLabelText('Deneme metni')
    await user.click(screen.getByRole('button', { name: 'Mikrofonu aç' }))
    expect(speech.listening).toBe(true)

    speech.say('Asistan, son cümleyi sil.')
    expect(demo.textContent).toBe('Bugün bir deneme yapıyorum.')
    expect(example(/son cümleyi sil/).textContent).toContain('✓ Söylendi')
    expect(example(/geri al/).textContent).not.toContain('✓ Söylendi')
    expect(screen.getByText('Son duyulan: “Asistan, son cümleyi sil.”')).toBeTruthy()

    // Komut kelimesi tek başına söylenip komut bir sonraki parçada gelebilir.
    speech.say('Asistan.')
    speech.say('Geri al.')
    expect(demo.textContent).toBe('Bugün bir deneme yapıyorum. İkinci cümle hazır.')
    expect(screen.queryByText(/Üç komut da sesle çalıştı/)).toBeNull()

    speech.say('Asistan, yeni paragraf.')
    expect(screen.getByText(/Üç komut da sesle çalıştı/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Dinlemeyi bitir' }))
    expect(speech.listening).toBe(false)
  })

  it('"mikrofonu kapat" mikrofonu kapatır; sonra söylenen deneme metnine yazılmaz', async () => {
    const user = userEvent.setup()
    const speech = fakeSpeech()
    render(<GettingStarted {...props} transcriber={speech.transcriber} />)
    const demo = screen.getByLabelText('Deneme metni')
    const initial = demo.textContent
    await user.click(screen.getByRole('button', { name: 'Mikrofonu aç' }))

    speech.say('Asistan, mikrofonu kapat.')
    expect(speech.listening).toBe(false)
    speech.say('Bu yazılmamalı.')
    expect(demo.textContent).toBe(initial)
    expect(screen.queryByText(/Bu yazılmamalı/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Mikrofonu aç' })).toBeTruthy()
  })

  it('tarayıcının tanımasında "duraklat" mikrofonu kapatır', async () => {
    const user = userEvent.setup()
    const speech = fakeSpeech()
    render(<GettingStarted {...props} localModel={false} transcriber={speech.transcriber} />)
    const demo = screen.getByLabelText('Deneme metni')
    const initial = demo.textContent
    await user.click(screen.getByRole('button', { name: 'Mikrofonu aç' }))

    speech.say('Asistan, duraklat.')
    expect(speech.listening).toBe(false)
    speech.say('Bu yazılmamalı.')
    expect(demo.textContent).toBe(initial)
    expect(screen.queryByText(/Bu yazılmamalı/)).toBeNull()
  })

  it('Whisper\'da "duraklat" mikrofonu açık bırakır; "devam et" ile yazmaya devam edilir', async () => {
    const user = userEvent.setup()
    const speech = fakeSpeech()
    render(<GettingStarted {...props} transcriber={speech.transcriber} />)
    const demo = screen.getByLabelText('Deneme metni')
    const initial = demo.textContent
    await user.click(screen.getByRole('button', { name: 'Mikrofonu aç' }))

    speech.say('Asistan, duraklat.')
    expect(speech.listening).toBe(true)
    speech.say('Bu yazılmaz.')
    expect(demo.textContent).toBe(initial)
    speech.say('Asistan, devam et.')
    speech.say('Üç.')
    expect(demo.textContent).toBe(`${initial} Üç.`)
  })

  it('düğmeyle denenen komutu söylenmiş saymaz', async () => {
    const user = userEvent.setup()
    render(<GettingStarted {...props} transcriber={fakeSpeech().transcriber} />)
    await user.click(example(/son cümleyi sil/))
    expect(screen.getByLabelText('Deneme metni').textContent).toBe('Bugün bir deneme yapıyorum.')
    expect(screen.queryByText('✓ Söylendi')).toBeNull()
  })

  it('model yüklenirken mikrofonu açmaz; tarayıcıda konuşma tanıma yoksa düğmeleri önerir', () => {
    const { unmount } = render(<GettingStarted {...props} status="loading" transcriber={fakeSpeech().transcriber} />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Mikrofonu aç' }).disabled).toBe(true)
    unmount()
    render(<GettingStarted {...props} />)
    expect(screen.queryByRole('button', { name: 'Mikrofonu aç' })).toBeNull()
    expect(screen.getByText('Düğmelere sırayla tıkla ve aşağıdaki metni izle.')).toBeTruthy()
  })

  it('yüklenen modeli hazır saymaz; yeniden denetleme sunar', async () => {
    const user = userEvent.setup()
    render(<GettingStarted {...props} status="loading" />)
    expect(screen.getByText(/Model: yüklenmesi bekleniyor/)).toBeTruthy()
    expect(screen.queryByText(/Model: yüklendi/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Durumu yeniden denetle' }))
    expect(props.onRecheck).toHaveBeenCalled()
  })

  it('rehber kapatılınca hatırlar; mevcut taslaklara kendiliğinden açılmaz', () => {
    const storage = memoryStorage()
    expect(shouldShowSetup(false, storage)).toBe(true)
    expect(shouldShowSetup(true, storage)).toBe(false)
    markSetupSeen(storage)
    expect(shouldShowSetup(false, storage)).toBe(false)
  })
})
