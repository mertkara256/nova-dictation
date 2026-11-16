import { type FormEvent, useId, useState } from 'react'
import type { Range } from '../core/document.ts'
import type { SessionRecording } from '../speech/recorder.ts'
import { Panel } from './Panel.tsx'
import { saveTestRecording } from './testRecordings.ts'

/** Biten ve henüz kaydedilmemiş ölçüm kaydı, başladığı andaki metinle birlikte. */
export interface PendingRecording {
  /** Her yeni kayıtta değişir; kart onunla sıfırlanır. */
  id: number
  recording: SessionRecording
  initialText: string
  initialSelection: Range | null
  wakeWord: string
  vocabulary: string[]
}

interface RecordingReviewProps {
  pending: PendingRecording
  /** Uygulamadaki metnin şu anki hali; beklenen metin bundan başlar. */
  resultText: string
  onClose(): void
}

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; file: string }
  | { status: 'failed'; message: string }

/**
 * Ölçüm kaydı bitince metnin olması gereken son halini sorar ve kaydı
 * ~/nova-test-recordings klasörüne yazdırır. Yalnızca geliştirmede kullanılır.
 */
export function RecordingReview({ pending, resultText, onClose }: RecordingReviewProps) {
  const expectedId = useId()
  const nameId = useId()
  // Kullanıcı düzeltmeye başlayana kadar beklenen metin uygulamadaki metni izler;
  // böylece kayıttan sonra gelen son Whisper sonucu da içine girer.
  const [editedText, setEditedText] = useState<string | null>(null)
  const expectedText = editedText ?? resultText
  const [name, setName] = useState('')
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  const seconds = pending.recording.samples.length / pending.recording.sampleRate

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSave({ status: 'saving' })
    try {
      const file = await saveTestRecording(name, pending.recording, {
        initialText: pending.initialText,
        initialSelection: pending.initialSelection,
        wakeWord: pending.wakeWord,
        vocabulary: pending.vocabulary,
        expectedText,
      })
      setSave({ status: 'saved', file })
    } catch {
      setSave({
        status: 'failed',
        message: 'Kayıt yazılamadı. Uygulama “npm run dev” ile mi çalışıyor?',
      })
    }
  }

  return (
    <Panel title={`Ölçüm kaydı (${seconds.toFixed(0)} sn)`} onClose={onClose}>
      {save.status === 'saved' ? (
        <p className="panel-intro">
          Kaydedildi: <code>{save.file}</code>. Ölçmek için: <code>npm run bench</code>
        </p>
      ) : (
        <form className="setting" onSubmit={submit}>
          <label htmlFor={expectedId}>Metnin olması gereken son hali</label>
          <p className="setting-help">
            Yanlış yazılan kelimeleri ve yanlış uygulanan komutları düzelt. Ölçüm, kaydı
            çalıp ortaya çıkan metni bununla karşılaştırır.
          </p>
          <textarea
            id={expectedId}
            className="text-input multiline"
            rows={4}
            value={expectedText}
            onChange={(event) => setEditedText(event.target.value)}
          />
          <div className="setting-row">
            <input
              id={nameId}
              className="text-input"
              aria-label="Kaydın adı"
              placeholder="Ad (isteğe bağlı, ör. e-posta)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="button" disabled={save.status === 'saving'}>
              Kaydet
            </button>
          </div>
          {save.status === 'failed' && <p className="setting-result failed">{save.message}</p>}
        </form>
      )}
    </Panel>
  )
}
