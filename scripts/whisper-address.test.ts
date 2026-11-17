import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WHISPER_ORIGIN, createWhisperPath, readWhisperPath, whisperProxyPath, whisperUrl } from './whisper-address.ts'

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
