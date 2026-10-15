import { COMMAND_HELP } from '../commands/help.ts'
import { Panel } from './Panel.tsx'
import { SHORTCUT_HELP } from './shortcuts.ts'

export function CommandHelp({ onClose }: { onClose(): void }) {
  return (
    <Panel title="Komutlar" onClose={onClose}>
      <p className="panel-intro">
        Her komut “Nova” ile başlar ve konuşmanın arasında söylenebilir; örneğin “Nova, son
        cümleyi sil”.
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
