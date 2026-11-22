import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { type Server, createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type ViteDevServer, createServer as createViteServer } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WHISPER_ORIGIN,
  createWhisperPath,
  readWhisperPath,
  whisperGuardPlugin,
  whisperProxyPath,
  whisperUrl,
} from './whisper-address.ts'

describe('Whisper adresinin ön eki', () => {
  let dir = ''
  let file = ''
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nova-whisper-'))
    file = join(dir, 'path')
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(dir, { recursive: true, force: true })
  })

  it('her başlatılışta tahmin edilemeyen yeni bir ön ek üretip saklar', async () => {
    const first = createWhisperPath(file)
    expect(first).toMatch(/^\/[0-9a-f]{32}$/)
    expect(await readFile(file, 'utf8')).toBe(first)
    expect(readWhisperPath(file)).toBe(first)
    expect(createWhisperPath(file)).not.toBe(first)
  })

  it('dosya yoksa ya da bozuksa ön ek kullanmaz', async () => {
    expect(readWhisperPath(file)).toBe('')
    await writeFile(file, '/../load')
    expect(readWhisperPath(file)).toBe('')
  })

  it('geliştirme sunucusunun /whisper isteğini ön ekli yola çevirir', () => {
    const path = createWhisperPath(file)
    expect(whisperProxyPath('/whisper/inference', file)).toBe(`${path}/inference`)
    expect(whisperProxyPath('/whisper/health', file)).toBe(`${path}/health`)
  })

  it('betikler ön ekli adrese bağlanır; WHISPER_URL verilirse o kullanılır', () => {
    vi.stubEnv('WHISPER_URL', undefined)
    const path = createWhisperPath(file)
    expect(whisperUrl(file)).toBe(`${WHISPER_ORIGIN}${path}`)
    vi.stubEnv('WHISPER_URL', 'http://127.0.0.1:9000')
    expect(whisperUrl(file)).toBe('http://127.0.0.1:9000')
  })
})

describe('whisperGuardPlugin', () => {
  // Sahte bir Whisper ve önünde, gerçeğindeki gibi /whisper bağlantısı olan bir geliştirme sunucusu.
  const whisperRequests: string[] = []
  let whisper: Server
  let vite: ViteDevServer
  let app: Server
  let appHost = ''

  beforeAll(async () => {
    whisper = createHttpServer((request, response) => {
      whisperRequests.push(`${request.method} ${request.url}`)
      response.end('ok')
    })
    await new Promise<void>((resolve) => whisper.listen(0, '127.0.0.1', resolve))
    vite = await createViteServer({
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      plugins: [whisperGuardPlugin()],
      server: {
        middlewareMode: true,
        proxy: {
          '/whisper': {
            target: `http://127.0.0.1:${(whisper.address() as AddressInfo).port}`,
            rewrite: (path) => path.replace(/^\/whisper/, '/onek'),
          },
        },
      },
    })
    app = createHttpServer(vite.middlewares)
    await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve))
    appHost = `127.0.0.1:${(app.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await vite.close()
    app.close()
    whisper.close()
  })

  beforeEach(() => {
    whisperRequests.length = 0
  })

  it("uygulamanın kendi sayfasından gelen isteği Whisper'a iletir", async () => {
    const response = await fetch(`http://${appHost}/whisper/health`, {
      headers: { origin: `http://${appHost}`, 'sec-fetch-site': 'same-origin' },
    })
    expect(response.status).toBe(200)
    expect(whisperRequests).toEqual(['GET /onek/health'])
  })

  it("başka bir siteden gönderilen formu Whisper'a iletmeden reddeder", async () => {
    const response = await fetch(`http://${appHost}/whisper/load`, {
      method: 'POST',
      headers: { origin: 'https://ornek.com', 'sec-fetch-site': 'cross-site' },
      body: new URLSearchParams({ model: '/yok' }),
    })
    expect(response.status).toBe(403)
    expect(whisperRequests).toEqual([])
  })

  it('yabancı bir Origin taşıyan isteği reddeder', async () => {
    const response = await fetch(`http://${appHost}/whisper/health`, { headers: { origin: 'https://ornek.com' } })
    expect(response.status).toBe(403)
    expect(whisperRequests).toEqual([])
  })
})
