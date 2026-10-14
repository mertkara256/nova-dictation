/**
 * Ses örneklerini daha düşük bir örnekleme hızına indirir (ör. 48 kHz → 16 kHz).
 * Her çıktı örneği, karşılık geldiği giriş aralığının ortalamasıdır.
 */
export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  if (toRate > fromRate) throw new Error('Örnekleme hızı yalnızca düşürülebilir.')

  const ratio = fromRate / toRate
  const output = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    output[i] = sum / (end - start)
  }
  return output
}

/** Tek kanallı ses örneklerini 16 bit PCM WAV dosyasına dönüştürür. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt bölümünün boyutu
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // tek kanal
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // saniyedeki bayt
  view.setUint16(32, 2, true) // örnek başına bayt
  view.setUint16(34, 16, true) // örnek başına bit
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return buffer
}
