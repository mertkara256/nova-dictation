/**
 * Yerel Whisper sunucusunun adresi. Sunucu her başlatılışta rastgele bir yol ön ekiyle
 * açılır (ör. http://127.0.0.1:8178/3f9c…/inference). whisper.cpp her yanıtta bütün
 * sitelere izin veriyor ve /load adresiyle sunucuyu takılı bırakmaya ya da kapatmaya
 * izin veriyor; tarayıcıda açık başka bir site ön eki bilemediği için bu adreslerin
 * hiçbirine ulaşamaz. Ön ek, geliştirme sunucusu ve betikler okuyabilsin diye geçici
 * klasördeki bir dosyaya yazılır.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { isFromAppPage } from './app-page.ts'

export const WHISPER_PORT = 8178
export const WHISPER_ORIGIN = `http://127.0.0.1:${WHISPER_PORT}`
export const WHISPER_PATH_FILE = join(tmpdir(), 'nova-whisper-path')

const PATH_PATTERN = /^\/[0-9a-f]{32}$/

/** Yeni bir ön ek üretir, dosyaya yazar ve döner. */
export function createWhisperPath(file = WHISPER_PATH_FILE): string {
  const path = `/${randomBytes(16).toString('hex')}`
  writeFileSync(file, path, { mode: 0o600 })
  return path
}

/** Son başlatılan Whisper'ın ön eki. Dosya yoksa ön ek de yoktur (elle başlatılmış sunucu). */
export function readWhisperPath(file = WHISPER_PATH_FILE): string {
  try {
    const path = readFileSync(file, 'utf8').trim()
    return PATH_PATTERN.test(path) ? path : ''
  } catch {
    return ''
  }
}

/**
 * Geliştirme sunucusunun /whisper/... isteğini Whisper'daki yola çevirir. Ön ek her
 * istekte yeniden okunur, çünkü Whisper yeniden başlatılınca değişir.
 */
export function whisperProxyPath(requestPath: string, file = WHISPER_PATH_FILE): string {
  return requestPath.replace(/^\/whisper/, readWhisperPath(file))
}

/**
 * Geliştirme sunucusunun /whisper bağlantısı ön eki kendisi eklediği için, başka bir
 * site ön eki bilmeden http://localhost:5173/whisper/load adresine form gönderip
 * Whisper'a ulaşabilirdi. Bu eklenti, uygulamanın kendi sayfasından gelmeyen /whisper
 * isteklerini Whisper'a iletmeden reddeder. Vite eklentilerin eklediği bu ara adımları
 * /whisper bağlantısından önce çalıştırır. Bağlantı /whisper ile başlayan her adresi
 * Whisper'a ilettiği için burada da aynısına bakılır: yalnızca /whisper/ altına bakılsaydı
 * /whisper%2Fload gibi kodlanmış bir eğik çizgi denetimden geçer, Whisper da onu /load
 * olarak çözerdi.
 */
export function whisperGuardPlugin(): Plugin {
  return {
    name: 'nova-whisper-guard',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/whisper') || isFromAppPage(request.headers)) {
          next()
          return
        }
        response.statusCode = 403
        response.end("Whisper'a yalnızca uygulamanın kendi sayfasından ulaşılabilir.")
      })
    },
  }
}

/** Betiklerin Whisper'a doğrudan bağlandığı adres; WHISPER_URL verilmişse o kullanılır. */
export function whisperUrl(file = WHISPER_PATH_FILE): string {
  return process.env.WHISPER_URL ?? `${WHISPER_ORIGIN}${readWhisperPath(file)}`
}
