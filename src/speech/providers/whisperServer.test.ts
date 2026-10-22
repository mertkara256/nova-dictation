import { describe, expect, it, vi } from 'vitest'
import type { OpenMicrophone } from '../microphone.ts'
import type { LivePreview, PreviewHandlers } from '../preview.ts'
import { describeTranscriberContract } from '../testing/transcriberContract.ts'
import type { TranscriberHandlers } from '../transcriber.ts'
import { createWhisperClient } from '../whisperClient.ts'
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

/** Testte metni elle verilen sahte önizleme. */
function fakePreview() {
  const sessions: { handlers: PreviewHandlers; finished: boolean; cancelled: boolean }[] = []
  const preview: LivePreview = {
    open: (_sampleRate, handlers) => {
      const session = { handlers, finished: false, cancelled: false }
      sessions.push(session)
      return {
        push: () => {},
        finish: () => {
          session.finished = true
        },
        cancel: () => {
          session.cancelled = true
        },
      }
    },
  }
  return { preview, sessions }
}

/** Sahte mikrofon ve sahte whisper.cpp sunucusuyla bir test ortamı kurar. */
function setup({
  serverUp = true,
  micError,
  preview,
}: { serverUp?: boolean; micError?: Error; preview?: LivePreview } = {}) {
  const replies: string[] = []
  let hold: Promise<void> | null = null
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
      const text = replies.shift() ?? ''
      await hold
      return new Response(JSON.stringify({ text }))
    }
    return new Response(JSON.stringify({ status: 'ok' }))
  })

  const transcriber = createWhisperServerTranscriber({
    client: createWhisperClient('/whisper', fetch as typeof globalThis.fetch),
    openMicrophone,
    preview,
  })

  return {
    transcriber,
    fetch,
    microphone,
    /** Sunucunun bir sonraki çeviri isteğine vereceği yanıt. */
    reply: (text: string) => replies.push(text),
    /** Mikrofona ses verir. */
    audio: (samples: Float32Array) => onAudio?.(samples),
    /** Whisper'ın yanıtlarını, dönen fonksiyon çağrılana kadar bekletir. */
    holdReplies() {
      let release = () => {}
      hold = new Promise((resolve) => {
        release = resolve
      })
      return () => {
        hold = null
        release()
      }
    },
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

describeTranscriberContract('whisper.cpp sunucusu + önizleme', () => {
  const { transcriber, say } = setup({ preview: fakePreview().preview })
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

  it('çeviri isteği bir kez başarısız olursa yeniden dener, parça kaybolmaz', async () => {
    const { transcriber, fetch, say } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    fetch.mockImplementationOnce(async () => {
      throw new TypeError('fetch failed')
    })
    await say('Merhaba.')
    expect(handlers.onFinal).toHaveBeenCalledWith('Merhaba.')
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it('yeniden deneme de başarısız olursa kurtarılabilir çeviri hatası verir', async () => {
    const { transcriber, fetch, say } = setup()
    const handlers = createHandlers()
    transcriber.start(handlers)
    await settle()
    const failing = async () => {
      throw new TypeError('fetch failed')
    }
    fetch.mockImplementationOnce(failing).mockImplementationOnce(failing)
    await say('Merhaba.')
    expect(handlers.onFinal).not.toHaveBeenCalled()
    expect(handlers.onError).toHaveBeenCalledWith('transcription')
  })

  it('başarısız parçayı ve kuyruktakileri sırayla yeniden işler, önceden yazılanı tekrarlamaz', async () => {
    const { transcriber, fetch, say, audio, reply, microphone } = setup()
    const handlers = { ...createHandlers(), onRetryAvailable: vi.fn() }
    transcriber.start(handlers)
    await settle()
    await say('İlk.')
    const failing = async () => { throw new TypeError('bağlantı yok') }
    fetch.mockImplementationOnce(failing).mockImplementationOnce(failing)
    reply('İkinci.')
    reply('Üçüncü.')
    audio(speech(800)); audio(silence(800))
    audio(speech(800)); audio(silence(800))
    await settle()
    expect(microphone.closed).toBe(true)
    expect(handlers.onRetryAvailable).toHaveBeenLastCalledWith(true)
    transcriber.retry?.()
    await settle()
    expect(vi.mocked(handlers.onFinal).mock.calls).toEqual([['İlk.'], ['İkinci.'], ['Üçüncü.']])
    expect(handlers.onRetryAvailable).toHaveBeenLastCalledWith(false)
  })

  it('zaman aşımını otomatik tekrarlamaz; kullanıcı tekrar deneyince komut olarak iletir', async () => {
    const { transcriber, fetch, say } = setup()
    const handlers = { ...createHandlers(), onCommand: vi.fn(), onRetryAvailable: vi.fn() }
    transcriber.start(handlers)
    await settle()
    transcriber.setCommandMode?.(true)
    fetch.mockImplementationOnce(async () => { throw new DOMException('', 'TimeoutError') })
    await say('son cümleyi sil')
    expect(handlers.onError).toHaveBeenCalledWith('timeout')
    expect(handlers.onCommand).not.toHaveBeenCalled()
    transcriber.retry?.()
    await settle()
    expect(handlers.onCommand).toHaveBeenCalledExactlyOnceWith('son cümleyi sil')
  })

  it('iptal edilen isteğin geç gelen sonucunu atar ve yeni oturumu etkilemez', async () => {
    const { transcriber, holdReplies, say } = setup()
    const old = createHandlers()
    transcriber.start(old)
    await settle()
    const release = holdReplies()
    await say('Eski.')
    transcriber.cancel?.()
    await settle()
    const next = createHandlers()
    transcriber.start(next)
    await settle()
    release()
    await say('Yeni.')
    expect(old.onFinal).not.toHaveBeenCalled()
    expect(old.onEnd).toHaveBeenCalledTimes(1)
    expect(next.onFinal).toHaveBeenCalledExactlyOnceWith('Yeni.')
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

  it('mikrofondan gelen her ses bloğunun seviyesini bildirir', async () => {
    const { transcriber, audio } = setup()
    const handlers = { ...createHandlers(), onLevel: vi.fn() }
    transcriber.start(handlers)
    await settle()

    audio(silence(100))
    audio(speech(100))
    expect(handlers.onLevel).toHaveBeenNthCalledWith(1, 0)
    expect(vi.mocked(handlers.onLevel).mock.calls[1][0]).toBeCloseTo(0.3 / Math.SQRT2, 2)
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

  describe('önizlemeyle', () => {
    it('konuşurken önizlemeyi gösterir, Whisper sonucu gelince yerine koyar', async () => {
      const { preview, sessions } = fakePreview()
      const { transcriber, audio, reply } = setup({ preview })
      const handlers = createHandlers()
      transcriber.start(handlers)
      await settle()

      audio(speech(800))
      sessions[0].handlers.onText('toplantı yarın')
      expect(handlers.onPartial).toHaveBeenLastCalledWith('toplantı yarın')

      reply('Toplantı yarın.')
      audio(silence(800))
      await settle()

      expect(sessions[0].finished).toBe(true)
      expect(handlers.onFinal).toHaveBeenCalledWith('Toplantı yarın.')
      expect(handlers.onPartial).toHaveBeenLastCalledWith('')
    })

    it("önceki parça Whisper'ı beklerken yeni konuşmanın önizlemesini de gösterir", async () => {
      const { preview, sessions } = fakePreview()
      const { transcriber, audio, reply, holdReplies } = setup({ preview })
      const handlers = createHandlers()
      transcriber.start(handlers)
      await settle()
      const release = holdReplies()

      audio(speech(800))
      sessions[0].handlers.onText('birinci')
      reply('Birinci.')
      audio(silence(800))
      audio(speech(800))
      sessions[1].handlers.onText('ikinci')
      expect(handlers.onPartial).toHaveBeenLastCalledWith('birinci ikinci')

      release()
      await settle()
      expect(handlers.onFinal).toHaveBeenCalledWith('Birinci.')
      expect(handlers.onPartial).toHaveBeenLastCalledWith('ikinci')
    })

    it('atılan kısa seslerin önizleme oturumunu kapatır', async () => {
      const { preview, sessions } = fakePreview()
      const { transcriber, audio, fetch } = setup({ preview })
      transcriber.start(createHandlers())
      await settle()

      audio(speech(100))
      audio(silence(1000))
      await settle()

      expect(sessions[0].cancelled).toBe(true)
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/inference'))).toBe(false)
    })

    it('önizleme metni gelmeden parça biterse Whisper beklenirken "…" gösterir', async () => {
      const { preview } = fakePreview()
      const { transcriber, audio, reply, holdReplies } = setup({ preview })
      const handlers = createHandlers()
      transcriber.start(handlers)
      await settle()
      const release = holdReplies()

      audio(speech(800))
      reply('Merhaba.')
      audio(silence(800))
      expect(handlers.onPartial).toHaveBeenLastCalledWith('…')

      release()
      await settle()
      expect(handlers.onFinal).toHaveBeenCalledWith('Merhaba.')
    })
  })

  describe('komut modu', () => {
    it('komut modunda söyleneni metin olarak değil komut olarak iletir', async () => {
      const { transcriber, say } = setup()
      const handlers = { ...createHandlers(), onCommand: vi.fn() }
      transcriber.start(handlers)
      await settle()

      transcriber.setCommandMode?.(true)
      await say('son cümleyi sil')
      expect(handlers.onCommand).toHaveBeenCalledWith('son cümleyi sil')
      expect(handlers.onFinal).not.toHaveBeenCalled()

      transcriber.setCommandMode?.(false)
      await say('Gündem hazır.')
      expect(handlers.onFinal).toHaveBeenCalledWith('Gündem hazır.')
      expect(handlers.onCommand).toHaveBeenCalledTimes(1)
    })

    it('konuşma sürerken komut moduna geçilirse o ana kadar söyleneni metin olarak bitirir', async () => {
      const { transcriber, audio, reply, say } = setup()
      const handlers = { ...createHandlers(), onCommand: vi.fn() }
      transcriber.start(handlers)
      await settle()

      reply('Toplantı yarın.')
      audio(speech(600))
      transcriber.setCommandMode?.(true)
      await settle()
      expect(handlers.onFinal).toHaveBeenCalledWith('Toplantı yarın.')

      await say('son cümleyi sil')
      expect(handlers.onCommand).toHaveBeenCalledWith('son cümleyi sil')
    })

    it('komutun önizlemesini dikte metninden ayrı gösterir', async () => {
      const { preview, sessions } = fakePreview()
      const { transcriber, audio } = setup({ preview })
      const handlers = { ...createHandlers(), onCommandPartial: vi.fn() }
      transcriber.start(handlers)
      await settle()

      transcriber.setCommandMode?.(true)
      audio(speech(600))
      sessions[0].handlers.onText('son cümleyi')
      expect(handlers.onCommandPartial).toHaveBeenLastCalledWith('son cümleyi')
      expect(handlers.onPartial).not.toHaveBeenCalledWith('son cümleyi')
    })
  })
})
