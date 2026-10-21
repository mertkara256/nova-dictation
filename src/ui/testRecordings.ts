import type { Range } from '../core/document.ts'
import { encodeWav } from '../speech/audio.ts'
import type { CommandModeChange, SessionRecording } from '../speech/recorder.ts'

/** Geliştirme sunucusunun ölçüm kayıtlarını proje klasörüne yazdığı adres. */
export const TEST_RECORDINGS_URL = '/__test-recordings'

/**
 * Ölçüm kaydının sesle birlikte saklanan bilgileri (test-recordings/<ad>.json).
 * Ölçüm aracı kaydı aynı başlangıçtan çalar ve sonucu `expectedText` ile karşılaştırır.
 */
export interface TestRecordingInfo {
  /** Kayıt başladığında metin ve imleç. */
  initialText: string
  initialSelection: Range | null
  /** Kayıt sırasında kullanılan komut kelimesi. */
  wakeWord: string
  /** Kayıt sırasında Whisper'a verilen özel kelimeler (eski kayıtlarda yok). */
  vocabulary?: string[]
  /** Komut tuşunun basıldığı ve bırakıldığı anlar. */
  commandModeChanges: CommandModeChange[]
  /** Kullanıcının belirttiği, metnin olması gereken son hali. */
  expectedText: string
  recordedAt: string
}

/** Kaydı ve bilgilerini geliştirme sunucusuna gönderir; yazılan dosyanın yolunu döner. */
export async function saveTestRecording(
  name: string,
  recording: SessionRecording,
  info: Omit<TestRecordingInfo, 'commandModeChanges' | 'recordedAt'>,
): Promise<string> {
  const fullInfo: TestRecordingInfo = {
    ...info,
    commandModeChanges: recording.commandModeChanges,
    recordedAt: new Date().toISOString(),
  }
  const body = new FormData()
  body.append('name', name)
  body.append('info', JSON.stringify(fullInfo))
  body.append(
    'audio',
    new Blob([encodeWav(recording.samples, recording.sampleRate)], { type: 'audio/wav' }),
    'kayit.wav',
  )

  const response = await fetch(TEST_RECORDINGS_URL, { method: 'POST', body })
  if (!response.ok) throw new Error(await response.text())
  const { file } = (await response.json()) as { file: string }
  return file
}
