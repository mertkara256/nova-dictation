import { mkdir, writeFile } from 'node:fs/promises'
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Ölçüm kayıtlarının yazıldığı klasör. Ses kayıtları bilgisayardan çıkmasın diye
 * proje klasörünün dışında, ev klasöründedir: git'e eklenemez, iCloud ya da
 * OneDrive'ın Masaüstü ve Belgeler eşitlemesine de girmez.
 */
export const TEST_RECORDINGS_DIR = join(homedir(), 'nova-test-recordings')

/**
 * Geliştirme sunucusuna, uygulamadan gönderilen ölçüm kayıtlarını
 * ~/nova-test-recordings klasörüne yazan bir adres ekler. Yalnızca `npm run dev`
 * sırasında çalışır; yayına hazır sürümde bu adres yoktur.
 */
export function testRecordingsPlugin(): Plugin {
  return {
    name: 'nova-test-recordings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__test-recordings', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end()
          return
        }
        if (!isFromAppPage(request.headers)) {
          response.statusCode = 403
          response.end('Kayıt yalnızca uygulamanın kendi sayfasından gönderilebilir.')
          return
        }
        try {
          const file = await saveRecording(TEST_RECORDINGS_DIR, await readForm(request))
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ file: join(TEST_RECORDINGS_DIR, file) }))
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : 'Kayıt yazılamadı.')
        }
      })
    },
  }
}

/** Geliştirme sunucusunun açıldığı bilgisayar içi adresler. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * İsteğin uygulamanın kendi sayfasından gelip gelmediği. Geliştirme sunucusu açıkken
 * başka bir sitenin tarayıcı üzerinden bu adrese form gönderip ev klasörüne dosya
 * yazdırmasını engeller. Tarayıcılar başka bir siteden gönderilen istekte bunu
 * `Sec-Fetch-Site` ve `Origin` başlıklarıyla belirtir. Origin'in bilgisayar içi bir
 * adres olması da aranır: bilgisayara yönlendirilmiş yabancı bir alan adından gelen
 * istek, tarayıcıya göre aynı sitedendir. Tarayıcı dışından gelen isteklerde
 * (ör. curl) bu başlıklar yoktur.
 */
export function isFromAppPage(headers: IncomingHttpHeaders): boolean {
  const site = headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin') return false
  if (headers.origin === undefined) return true
  try {
    const origin = new URL(headers.origin)
    return LOCAL_HOSTNAMES.has(origin.hostname) && origin.host === headers.host
  } catch {
    return false
  }
}

/**
 * Sesi ve bilgilerini klasöre <tarih-saat>-<ad>.wav ve .json olarak yazar;
 * ses dosyasının adını döner.
 */
export async function saveRecording(dir: string, form: FormData, now = new Date()): Promise<string> {
  const audio = form.get('audio')
  const info = form.get('info')
  if (!(audio instanceof Blob) || typeof info !== 'string') {
    throw new Error('Kayıtta ses ya da bilgi eksik.')
  }
  const name = slug(String(form.get('name') ?? ''))
  const base = name ? `${timestamp(now)}-${name}` : timestamp(now)

  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${base}.wav`), Buffer.from(await audio.arrayBuffer()))
  await writeFile(join(dir, `${base}.json`), `${JSON.stringify(JSON.parse(info), null, 2)}\n`)
  return `${base}.wav`
}

async function readForm(request: IncomingMessage): Promise<FormData> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': request.headers['content-type'] ?? '' },
    body: Buffer.concat(chunks),
  }).formData()
}

/** Dosya adında kullanılacak tarih ve saat, ör. "2026-10-17-0930". */
function timestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** Kullanıcının verdiği adı dosya adına uygun hale getirir ("E-posta 1" → "e-posta-1"). */
function slug(name: string) {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
