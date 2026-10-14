import { describe, expect, it, vi } from 'vitest'
import type { OpenMicrophone } from '../microphone.ts'
import { describeTranscriberContract } from '../testing/transcriberContract.ts'
import type { TranscriberHandlers } from '../transcriber.ts'
import { createWhisperServerTranscriber } from './whisperServer.ts'

const RATE = 16000

function speech(ms: number) {
  return Float32Array.from(
    { length: (RATE * ms) / 1000 },
    (_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE),
  )
}

function silence(ms: number) {
  return new Float32Array((RATE * ms) / 1000)
}

async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** Sahte mikrofon ve sahte whisper.cpp sunucusuyla bir test ortamı kurar. */
function setup({ serverUp = true, micError }: { serverUp?: boolean; micError?: Error } = {}) {
  const replies: string[] = []
  let onAudio: ((samples: Float32Array) => void) | null = null
  const microphone = { open: false, closed: false }

  const openMicrophone: OpenMicrophone = async (callback) => {
    if (micError) throw micError
    microphone.open = true
    onAudio = callback
    return {
      sampleRate: RATE,
      close: async () => {
        microphone.closed = true
      },
    }
  }

  const fetch = vi.fn(async (url: string | URL | Request) => {
    if (!serverUp) throw new TypeError('fetch failed')
    if (String(url).endsWith('/inference')) {
      return new Response(JSON.stringify({ text: replies.shift() ?? '' }))
    }
    return new Response('ok')
  })

  const transcriber = createWhisperServerTranscriber({
    baseUrl: '/whisper',
    openMicrophone,
    fetch: fetch as typeof globalThis.fetch,
  })

  return {
    transcriber,
    fetch,
    microphone,
    /** Sunucunun bir sonraki çeviri isteğine vereceği yanıt. */
    reply: (text: string) => replies.push(text),
    /** Mikrofona ses verir. */
    audio: (samples: Float32Array) => onAudio?.(samples),
    /** Konuşmayı ve ardından gelen sessizliği mikrofona verir. */
    async say(text: string) {
      replies.push(text)
      onAudio?.(speech(800))
      onAudio?.(silence(800))
      await settle()
    },
  }
}

function createHandlers(): TranscriberHandlers {
  return { onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() }
}

describeTranscriberContract('whisper.cpp sunucusu', () => {
  const { transcriber, say } = setup()
  return { transcriber, speak: say, settle }
})

describe('createWhisperServerTranscriber', () => {
  it('sunucuya ulaşılamazsa "unavailable" hatası verir ve mikrofonu açmaz', async () => {
    const { transcriber, microphone } = setup({ serverUp: false })
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    expect(handlers.onError).toHaveBeenCalledWith('unavailable')
    expect(handlers.onEnd).toHaveBeenCalledTimes(1)
    expect(microphone.open).toBe(false)
  })

  it('her konuşma parçasını WAV olarak gönderir ve metni temizler', async () => {
    const { transcriber, fetch, say } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    await say(' Toplantı yarın.\n Gündemde 3 madde var.\n')

    const [url, init] = fetch.mock.calls.at(-1) as unknown as [string, RequestInit]
    expect(url).toBe('/whisper/inference')
    const file = (init.body as FormData).get('file') as Blob
    expect(file.type).toBe('audio/wav')
    expect(handlers.onFinal).toHaveBeenCalledWith('Toplantı yarın. Gündemde 3 madde var.')
  })

  it('çeviri sürerken ara metin olarak "…" gösterir, bitince temizler', async () => {
    const { transcriber, say } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    await say('merhaba')
    expect(handlers.onPartial).toHaveBeenCalledWith('…')
    expect(handlers.onPartial).toHaveBeenLastCalledWith('')
  })

  it('boş sonuç gelirse metin eklemez', async () => {
    const { transcriber, say } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    await say('')
    expect(handlers.onFinal).not.toHaveBeenCalled()
  })

  it('mikrofon izni verilmezse "permission" hatası verir', async () => {
    const { transcriber } = setup({ micError: new DOMException('', 'NotAllowedError') })
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    expect(handlers.onError).toHaveBeenCalledWith('permission')
    expect(handlers.onEnd).toHaveBeenCalledTimes(1)
  })

  it('durdurulunca süren konuşmayı da çevirip mikrofonu kapatır', async () => {
    const { transcriber, microphone, reply, audio } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()

    // Sessizlik beklenmeden durduruluyor; son konuşma yine de çevrilmeli.
    reply('son cümle')
    audio(speech(800))
    transcriber.stop()
    await settle()

    expect(handlers.onFinal).toHaveBeenCalledWith('son cümle')
    expect(microphone.closed).toBe(true)
    expect(handlers.onEnd).toHaveBeenCalledTimes(1)
  })

  it('parçaları söylendikleri sırayla iletir', async () => {
    const { transcriber, say } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    await say('birinci')
    await say('ikinci')
    expect(vi.mocked(handlers.onFinal).mock.calls).toEqual([['birinci'], ['ikinci']])
  })
})
