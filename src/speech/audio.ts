/**
 * Akan sesi parça parça daha düşük bir örnekleme hızına indiren bir dönüştürücü
 * oluşturur (ör. 48 kHz → 16 kHz). Bir parçadan artan örnekleri sonrakine
 * taşıdığı için parça sınırlarında ses kaybolmaz. Her çıktı örneği, karşılık
 * geldiği giriş aralığının ortalamasıdır.
 */
export function createResampler(
  fromRate: number,
  toRate: number,
): (input: Float32Array) => Float32Array {
  if (toRate > fromRate) throw new Error('Örnekleme hızı yalnızca düşürülebilir.')
  const ratio = fromRate / toRate
  let pending = new Float32Array(0)

  return (input) => {
    if (ratio === 1) return input
    const data = new Float32Array(pending.length + input.length)
    data.set(pending)
    data.set(input, pending.length)

    const output = new Float32Array(Math.floor(data.length / ratio))
    for (let i = 0; i < output.length; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.floor((i + 1) * ratio)
      let sum = 0
      for (let j = start; j < end; j++) sum += data[j]
      output[i] = sum / (end - start)
    }
    pending = data.slice(Math.floor(output.length * ratio))
    return output
  }
}

/** Ses bloklarını tek bir kayıtta birleştirir. */
export function concatAudio(chunks: Float32Array[]): Float32Array {
  const output = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

/** Bir ses kaydının tamamını daha düşük bir örnekleme hızına indirir. */
export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  return createResampler(fromRate, toRate)(input)
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
