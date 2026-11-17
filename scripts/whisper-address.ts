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

/** Betiklerin Whisper'a doğrudan bağlandığı adres; WHISPER_URL verilmişse o kullanılır. */
export function whisperUrl(file = WHISPER_PATH_FILE): string {
  return process.env.WHISPER_URL ?? `${WHISPER_ORIGIN}${readWhisperPath(file)}`
}
