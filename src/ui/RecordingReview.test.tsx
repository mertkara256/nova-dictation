import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type PendingRecording, RecordingReview } from './RecordingReview.tsx'
import type { TestRecordingInfo } from './testRecordings.ts'

const pending: PendingRecording = {
  id: 1,
  recording: {
    samples: new Float32Array(16000 * 3),
    sampleRate: 16000,
    commandModeChanges: [{ at: 1.5, active: true }],
  },
  initialText: '',
  initialSelection: null,
  wakeWord: 'Nova',
  vocabulary: ['Ayşe Hanım'],
}

function stubServer() {
  const fetch = vi.fn(async () => Response.json({ file: '/Users/ada/nova-test-recordings/2026-10-17-093005-e-posta.wav' }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Sunucuya gönderilen kayıt bilgileri. */
function sentInfo(fetch: ReturnType<typeof stubServer>): TestRecordingInfo {
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
  return JSON.parse((init.body as FormData).get('info') as string)
}

const expectedField = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Metnin olması gereken son hali' })

describe('ölçüm kaydı kartı', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('beklenen metni, düzeltilene kadar uygulamadaki metinle günceller', () => {
    const { rerender } = render(
      <RecordingReview pending={pending} resultText="Toplantı" onClose={vi.fn()} />,
    )
    expect(expectedField().value).toBe('Toplantı')
    // Kayıttan sonra gelen son Whisper sonucu da beklenen metne girer.
    rerender(<RecordingReview pending={pending} resultText="Toplantı yarın." onClose={vi.fn()} />)
    expect(expectedField().value).toBe('Toplantı yarın.')
  })

  it('düzeltilen metni ve kaydı geliştirme sunucusuna gönderir', async () => {
    const fetch = stubServer()
    const user = userEvent.setup()
    render(<RecordingReview pending={pending} resultText="Toplantı yarın." onClose={vi.fn()} />)

    await user.clear(expectedField())
    await user.type(expectedField(), 'Toplantı yarın saat onda.')
    await user.type(screen.getByRole('textbox', { name: 'Kaydın adı' }), 'e-posta')
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))

    expect(fetch).toHaveBeenCalledWith('/__test-recordings', expect.objectContaining({ method: 'POST' }))
    expect(sentInfo(fetch)).toMatchObject({
      expectedText: 'Toplantı yarın saat onda.',
      initialText: '',
      wakeWord: 'Nova',
      vocabulary: ['Ayşe Hanım'],
      commandModeChanges: [{ at: 1.5, active: true }],
    })
    expect(await screen.findByText('/Users/ada/nova-test-recordings/2026-10-17-093005-e-posta.wav')).toBeTruthy()
  })

  it('sunucu kaydedemezse nedenini söyler', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('hata', { status: 400 })))
    const user = userEvent.setup()
    render(<RecordingReview pending={pending} resultText="Metin." onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Kayıt yazılamadı')
  })
})
