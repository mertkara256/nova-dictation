export type DownloadFormat = 'txt' | 'md'

const MIME_TYPES: Record<DownloadFormat, string> = {
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
}

/** İndirilen dosyanın adı, ör. "nova-dictation-2026-10-15-0930.md". */
export function downloadFileName(format: DownloadFormat, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`
  return `nova-dictation-${day}-${time}.${format}`
}

/** Metni bir dosya olarak bilgisayara indirir. */
export function downloadText(text: string, format: DownloadFormat) {
  const url = URL.createObjectURL(new Blob([text], { type: MIME_TYPES[format] }))
  const link = document.createElement('a')
  link.href = url
  link.download = downloadFileName(format)
  link.click()
  // Geçici adres, indirme başladıktan sonra serbest bırakılır. Safari indirmeyi biraz
  // geç başlattığı için hemen bırakılırsa dosya inmeyebilir; birkaç saniye beklenir.
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
