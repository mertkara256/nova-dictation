import { useState } from 'react'
import { COMMAND_HELP } from '../commands/help.ts'
import { toLowerTr } from '../core/text.ts'
import { Panel } from './Panel.tsx'
import { COMMAND_KEY_LABEL, SHORTCUT_HELP } from './shortcuts.ts'

const SHORTCUTS_TITLE = 'Klavye kısayolları'

interface CommandHelpProps {
  wakeWord: string
  /** ⌃ ile komut verilebiliyor mu? Tarayıcının tanımasında verilemez. */
  commandKey: boolean
  /** Komut kelimesini değiştirmek için ayarları açar. */
  onChangeWakeWord(): void
  onClose(): void
}

export function CommandHelp({ wakeWord, commandKey, onChangeWakeWord, onClose }: CommandHelpProps) {
  const [query, setQuery] = useState('')
  const matches = createMatcher(query)
  const groups = COMMAND_HELP.map((group) => ({
    ...group,
    commands: group.commands.filter(({ say, does }) => matches(group.title, say, does)),
  })).filter((group) => group.commands.length > 0)
  const shortcuts = SHORTCUT_HELP.filter(
    (shortcut) => (commandKey || !shortcut.commandKey) && matches(SHORTCUTS_TITLE, shortcut.keys, shortcut.does),
  )

  return (
    <Panel title="Komutlar" onClose={onClose}>
      <p className="panel-intro">
        Her komut “{wakeWord}” ile başlar ve konuşmanın arasında söylenebilir; örneğin “{wakeWord},
        son cümleyi sil”.{' '}
        {commandKey && (
          <>
            <kbd>{COMMAND_KEY_LABEL}</kbd> basılıyken söylenenler de “{wakeWord}” demeden komut sayılır.{' '}
          </>
        )}
        <button type="button" className="link-button" onClick={onChangeWakeWord}>
          Kelimeyi değiştir
        </button>
      </p>
      <input
        type="search"
        className="text-input help-search"
        placeholder="Komut ara…"
        aria-label="Komut ara"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Esc önce aramayı temizlesin; paneli kapatan genel kısayola ulaşmasın.
          if (event.key === 'Escape' && query) {
            event.stopPropagation()
            setQuery('')
          }
        }}
      />
      {groups.length === 0 && shortcuts.length === 0 && (
        <p className="panel-intro">“{query.trim()}” ile eşleşen komut yok.</p>
      )}
      {groups.map((group) => (
        <div key={group.title} className="help-group">
          <h3>{group.title}</h3>
          <dl>
            {group.commands.map(({ say, does }) => (
              <div key={say} className="help-row">
                <dt>
                  {/* Aynı işi yapan söyleyişler ayrı etiketlerde; satır sonu araya düşer. */}
                  <ul className="phrases">
                    {say.split(' · ').map((phrase) => (
                      <li key={phrase}>{phrase}</li>
                    ))}
                  </ul>
                </dt>
                <dd>{does}</dd>
              </div>
            ))}
          </dl>
          {group.note && <p className="help-note">{group.note}</p>}
        </div>
      ))}
      {shortcuts.length > 0 && (
        <div className="help-group">
          <h3>{SHORTCUTS_TITLE}</h3>
          <dl>
            {shortcuts.map(({ keys, does }) => (
              <div key={keys} className="help-row">
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{does}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Panel>
  )
}

/**
 * Sorgudaki her kelime satırın başlığında, söyleyişlerinde ya da açıklamasında
 * geçiyorsa satır eşleşir. Büyük/küçük harf ve Türkçe karakter farkı gözetilmez:
 * "sec" yazınca "seç" de bulunur.
 */
function createMatcher(query: string) {
  const words = searchable(query).split(/\s+/).filter(Boolean)
  return (...texts: string[]) => {
    const target = searchable(texts.join(' '))
    return words.every((word) => target.includes(word))
  }
}

function searchable(text: string) {
  return toLowerTr(text).normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ı', 'i')
}
