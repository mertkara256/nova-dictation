import type { IncomingHttpHeaders } from 'node:http'

/** Geliştirme sunucusunun açıldığı bilgisayar içi adresler. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * İsteğin uygulamanın kendi sayfasından gelip gelmediği. Geliştirme sunucusu açıkken
 * başka bir sitenin tarayıcı üzerinden onun adreslerine istek göndermesini engeller
 * (ör. ev klasörüne kayıt yazdırmak ya da Whisper'ın /load adresine ulaşmak).
 * Tarayıcılar başka bir siteden gönderilen istekte bunu `Sec-Fetch-Site` ve `Origin`
 * başlıklarıyla belirtir. Origin'in bilgisayar içi bir adres olması da aranır:
 * bilgisayara yönlendirilmiş yabancı bir alan adından gelen istek, tarayıcıya göre aynı
 * sitedendir. Tarayıcı dışından gelen isteklerde (ör. curl) bu başlıklar yoktur.
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
