import { type FormEvent, useId, useState } from 'react'
import { DEFAULT_WAKE_WORD, MAX_WAKE_WORD_LETTERS, checkWakeWord } from '../commands/wakeWord.ts'
import { Panel } from './Panel.tsx'

interface SettingsProps {
  wakeWord: string
  onWakeWordChange(word: string): void
  /** Ölçüm kayıtları; yalnızca geliştirmede ve kayıt yapılabilen servislerde verilir. */
  testRecording?: { enabled: boolean; onChange(enabled: boolean): void }
  onClose(): void
}

/** Ayarlar paneli: komut kelimesi ve (geliştirmede) ölçüm kayıtları. */
export function Settings({ wakeWord, onWakeWordChange, testRecording, onClose }: SettingsProps) {
  const inputId = useId()
  const [input, setInput] = useState(wakeWord)
  const [result, setResult] = useState<{ message: string; failed?: boolean } | null>(null)

  function apply(word: string) {
    onWakeWordChange(word)
    setInput(word)
    setResult({ message: `Kaydedildi. Artık “${word}, son cümleyi sil” diyebilirsin.` })
  }

  function save(event: FormEvent) {
    event.preventDefault()
    const check = checkWakeWord(input)
    if (check.ok) apply(check.word)
    else setResult({ message: check.error, failed: true })
  }

  return (
    <Panel title="Ayarlar" onClose={onClose}>
      <form className="setting" onSubmit={save}>
        <label htmlFor={inputId}>Komut kelimesi</label>
        <p className="setting-help">
          Komutlardan önce söylediğin kelime. Kolayca söyleyebildiğin ama konuşurken pek
          kullanmadığın bir kelime seç; örneğin bir isim. En az 5 harfli kelimelerde konuşma
          tanımanın küçük yazım hataları da tolere edilir.
        </p>
        <div className="setting-row">
          <input
            id={inputId}
            className="text-input"
            value={input}
            maxLength={MAX_WAKE_WORD_LETTERS}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setInput(event.target.value)
              setResult(null)
            }}
          />
          <button type="submit" className="button" disabled={input.trim() === wakeWord}>
            Kaydet
          </button>
        </div>
        {result && (
          <p className={result.failed ? 'setting-result failed' : 'setting-result'} role="status">
            {result.message}
          </p>
        )}
        {wakeWord !== DEFAULT_WAKE_WORD && (
          <button
            type="button"
            className="link-button setting-reset"
            onClick={() => apply(DEFAULT_WAKE_WORD)}
          >
            Varsayılana dön (“{DEFAULT_WAKE_WORD}”)
          </button>
        )}
      </form>
      {testRecording && (
        <div className="setting setting-separated">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={testRecording.enabled}
              onChange={(event) => testRecording.onChange(event.target.checked)}
            />
            Ölçüm için kaydet
          </label>
          <p className="setting-help">
            Açıkken her mikrofon kullanımı ses olarak kaydedilir; mikrofon kapanınca metnin
            olması gereken halini yazıp kaydedersin. Kayıtlar <code>test-recordings/</code>{' '}
            klasörüne yazılır, git'e eklenmez ve <code>npm run bench</code> ile hız ve doğruluk
            ölçümünde kullanılır. Bu seçenek yalnızca geliştirme sırasında görünür.
          </p>
        </div>
      )}
    </Panel>
  )
}
