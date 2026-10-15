import { type FormEvent, useId, useState } from 'react'
import { DEFAULT_WAKE_WORD, MAX_WAKE_WORD_LETTERS, checkWakeWord } from '../commands/wakeWord.ts'
import { Panel } from './Panel.tsx'

interface SettingsProps {
  wakeWord: string
  onWakeWordChange(word: string): void
  onClose(): void
}

/** Ayarlar paneli: şimdilik yalnızca komut kelimesi seçilir. */
export function Settings({ wakeWord, onWakeWordChange, onClose }: SettingsProps) {
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
          kullanmadığın bir kelime seç; örneğin bir isim.
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
    </Panel>
  )
}
