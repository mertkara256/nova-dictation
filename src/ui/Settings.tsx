import { type FormEvent, useId, useState } from 'react'
import { DEFAULT_WAKE_WORD, MAX_WAKE_WORD_LETTERS, checkWakeWord } from '../commands/wakeWord.ts'
import { Panel } from './Panel.tsx'
import { checkVocabulary } from './vocabularySetting.ts'

interface SettingsProps {
  wakeWord: string
  onWakeWordChange(word: string): void
  /** Özel kelimeler; yalnızca bunları destekleyen konuşma tanıma servislerinde verilir. */
  vocabulary?: { words: string[]; onChange(words: string[]): void }
  /** Ölçüm kayıtları; yalnızca geliştirmede ve kayıt yapılabilen servislerde verilir. */
  testRecording?: { enabled: boolean; onChange(enabled: boolean): void }
  onClose(): void
  onOpenSetup?(): void
  setupDisabled?: boolean
}

/** Ayarlar paneli: komut kelimesi, özel kelimeler ve (geliştirmede) ölçüm kayıtları. */
export function Settings({
  wakeWord,
  onWakeWordChange,
  vocabulary,
  testRecording,
  onClose,
  onOpenSetup,
  setupDisabled,
}: SettingsProps) {
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
      {onOpenSetup && (
        <p className="panel-intro">
          <button type="button" className="link-button" disabled={setupDisabled} onClick={onOpenSetup}>
            İlk kullanım rehberi
          </button>
        </p>
      )}
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
      {vocabulary && <VocabularySetting {...vocabulary} />}
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

interface VocabularySettingProps {
  words: string[]
  onChange(words: string[]): void
}

/** Whisper'a ipucu olarak verilen özel kelimeler (isimler, terimler). */
function VocabularySetting({ words, onChange }: VocabularySettingProps) {
  const inputId = useId()
  const saved = words.join(', ')
  const [input, setInput] = useState(saved)
  const [result, setResult] = useState<{ message: string; failed?: boolean } | null>(null)

  function save(event: FormEvent) {
    event.preventDefault()
    const check = checkVocabulary(input)
    if (!check.ok) {
      setResult({ message: check.error, failed: true })
      return
    }
    onChange(check.words)
    setInput(check.words.join(', '))
    setResult({
      message:
        check.words.length > 0
          ? `Kaydedildi: ${check.words.length} kelime ya da ifade.`
          : 'Liste temizlendi.',
    })
  }

  return (
    <form className="setting setting-separated" onSubmit={save}>
      <label htmlFor={inputId}>Özel kelimeler</label>
      <p className="setting-help">
        Sık kullandığın isimler ve terimler; örneğin kişi, şirket ya da ürün adları. Virgülle ya
        da alt alta yaz. Whisper bunları bu yazımla yazmaya yatkın olur.
      </p>
      <textarea
        id={inputId}
        className="text-input multiline"
        rows={3}
        placeholder="Ayşe Hanım, Kubernetes, Nova Dictation"
        value={input}
        onChange={(event) => {
          setInput(event.target.value)
          setResult(null)
        }}
      />
      <div className="setting-row">
        <button
          type="submit"
          className="button"
          aria-label="Özel kelimeleri kaydet"
          disabled={input === saved}
        >
          Kaydet
        </button>
      </div>
      {result && (
        <p className={result.failed ? 'setting-result failed' : 'setting-result'} role="status">
          {result.message}
        </p>
      )}
    </form>
  )
}
