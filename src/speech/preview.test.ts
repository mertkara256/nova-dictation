import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSherpaPreview, type PreviewHandlers } from './preview.ts'

/** Tarayıcının WebSocket'ini taklit eden, olayları elle tetiklenebilen sahte bağlantı. */
class FakeSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static instances: FakeSocket[] = []
  readonly url: string
  binaryType = 'blob'
  sent: (ArrayBuffer | string)[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  send(data: ArrayBuffer | string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }

  open() {
    this.onopen?.()
  }

  fail() {
    this.onerror?.()
  }

  message(data: unknown) {
    this.onmessage?.({ data })
  }
}

const RATE = 48000

function createPreview() {
  return createSherpaPreview('ws://test/nemotron', FakeSocket as unknown as typeof WebSocket)
}

function createHandlers(): PreviewHandlers {
  return { onText: vi.fn(), onError: vi.fn() }
}

describe('createSherpaPreview', () => {
  beforeEach(() => {
    FakeSocket.instances = []
  })

  it('bağlantı açılana kadar gelen sesi biriktirir, açılınca 16 kHz olarak gönderir', () => {
    const session = createPreview().open(RATE, createHandlers())
    const socket = FakeSocket.instances[0]
    session?.push(new Float32Array(4800))
    expect(socket.sent).toHaveLength(0)

    socket.open()
    session?.push(new Float32Array(4800))

    expect(socket.binaryType).toBe('arraybuffer')
    expect(socket.sent).toHaveLength(2)
    // 4800 örnek 48 kHz'te 100 ms; 16 kHz'te 1600 Float32 = 6400 bayt.
    expect((socket.sent[0] as ArrayBuffer).byteLength).toBe(6400)
  })

  it('sunucudan gelen metni iletir', () => {
    const handlers = createHandlers()
    createPreview().open(RATE, handlers)
    const socket = FakeSocket.instances[0]
    socket.open()
    socket.message(JSON.stringify({ text: ' Toplantı yarın ', segment: 0 }))
    expect(handlers.onText).toHaveBeenCalledWith('Toplantı yarın')
  })

  it('parça bitince "Done" gönderir ve sunucu bitirince bağlantıyı kapatır', () => {
    const session = createPreview().open(RATE, createHandlers())
    const socket = FakeSocket.instances[0]
    socket.open()
    session?.finish()
    expect(socket.sent.at(-1)).toBe('Done')
    socket.message('Done!')
    expect(socket.closed).toBe(true)
  })

  it('bağlantı kurulamazsa hata bildirir ve sonraki parçalarda yeniden denemez', () => {
    const preview = createPreview()
    const handlers = createHandlers()
    preview.open(RATE, handlers)
    FakeSocket.instances[0].fail()

    expect(handlers.onError).toHaveBeenCalled()
    expect(preview.open(RATE, createHandlers())).toBeNull()

    preview.reset()
    expect(preview.open(RATE, createHandlers())).not.toBeNull()
  })

  it('iptal edilen parçanın bağlantısını hemen kapatır', () => {
    const session = createPreview().open(RATE, createHandlers())
    session?.cancel()
    expect(FakeSocket.instances[0].closed).toBe(true)
  })
})
