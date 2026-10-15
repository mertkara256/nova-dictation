import { COMMAND_HELP } from '../commands/help.ts'

interface CommandHelpProps {
  onClose(): void
}

export function CommandHelp({ onClose }: CommandHelpProps) {
  return (
    <section className="help" aria-labelledby="help-title">
      <header className="help-header">
        <h2 id="help-title">Komutlar</h2>
        <button type="button" className="link-button" onClick={onClose}>
          Kapat
        </button>
      </header>
      <p className="help-intro">
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
    </section>
  )
}
