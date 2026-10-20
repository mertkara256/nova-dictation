import { COMMAND_HELP } from '../commands/help.ts'
import { Panel } from './Panel.tsx'
import { COMMAND_KEY_LABEL, SHORTCUT_HELP } from './shortcuts.ts'

interface CommandHelpProps {
  wakeWord: string
  /** Komut kelimesini değiştirmek için ayarları açar. */
  onChangeWakeWord(): void
  onClose(): void
}

export function CommandHelp({ wakeWord, onChangeWakeWord, onClose }: CommandHelpProps) {
  return (
    <Panel title="Komutlar" onClose={onClose}>
      <p className="panel-intro">
        Her komut “{wakeWord}” ile başlar ve konuşmanın arasında söylenebilir; örneğin “{wakeWord},
        son cümleyi sil”. {COMMAND_KEY_LABEL} basılıyken söylenenler de “{wakeWord}” demeden komut
        sayılır.{' '}
        <button type="button" className="link-button" onClick={onChangeWakeWord}>
          Kelimeyi değiştir
        </button>
      </p>
      {COMMAND_HELP.map((group) => (
        <div key={group.title} className="help-group">
          <h3>{group.title}</h3>
          <dl>
            {group.commands.map(({ say, does }) => (
              <div key={say} className="help-row">
                <dt>{say}</dt>
                <dd>{does}</dd>
              </div>
            ))}
          </dl>
          {group.note && <p className="help-note">{group.note}</p>}
        </div>
      ))}
      <div className="help-group">
        <h3>Klavye kısayolları</h3>
        <dl>
          {SHORTCUT_HELP.map(({ keys, does }) => (
            <div key={keys} className="help-row">
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}
