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

/** Ses bloğunun ortalama seviyesi (RMS); 0 sessizlik, 1 en yüksek. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
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

/**
 * Bir ses kaydının tamamını istenen örnekleme hızına çevirir. Hız düşürülürken
 * aralıkların ortalaması alınır; eski Bluetooth kulaklıklardaki gibi daha düşük
 * bir hızdan (ör. 8 kHz) gelen ses, komşu örnekler arasında doğrusal ara
 * değerlemeyle yükseltilir.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate <= fromRate) return createResampler(fromRate, toRate)(input)
  const output = new Float32Array(Math.floor((input.length * toRate) / fromRate))
  const step = fromRate / toRate
  for (let i = 0; i < output.length; i++) {
    const position = i * step
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    output[i] = input[left] + (input[right] - input[left]) * (position - left)
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

/**
 * 16 bit PCM WAV verisini tek kanallı örneklere çevirir; çok kanallı sesin
 * ortalaması alınır. Tanımadığı bölümleri (ör. macOS'un eklediği FLLR) atlar.
 */
export function decodeWav(data: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const readText = (offset: number) => String.fromCharCode(...data.subarray(offset, offset + 4))
  if (readText(0) !== 'RIFF' || readText(8) !== 'WAVE') throw new Error('WAV dosyası değil.')

  let channels = 1
  let sampleRate = 0
  let offset = 12
  while (offset + 8 <= data.length) {
    const id = readText(offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      if (view.getUint16(body, true) !== 1 || view.getUint16(body + 14, true) !== 16) {
        throw new Error('Yalnızca 16 bit PCM WAV desteklenir.')
      }
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
    } else if (id === 'data') {
      const frames = Math.floor(size / 2 / channels)
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        let sum = 0
        for (let c = 0; c < channels; c++) sum += view.getInt16(body + (i * channels + c) * 2, true)
        samples[i] = sum / channels / 32768
      }
      return { samples, sampleRate }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('Ses verisi bulunamadı.')
}
