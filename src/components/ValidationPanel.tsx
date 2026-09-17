import type { ValidationMessage, ValidationLevel } from '../state/types'

interface ValidationPanelProps {
  lastUpdatedLabel?: string
  messages: ValidationMessage[]
  retrying: boolean
}

const levelTitles: Record<ValidationLevel, string> = {
  error: 'Blocking errors',
  info: 'Info',
  warning: 'Warnings',
}

export function ValidationPanel({
  lastUpdatedLabel,
  messages,
  retrying,
}: ValidationPanelProps) {
  const groupedMessages = {
    error: messages.filter((message) => message.level === 'error'),
    warning: messages.filter((message) => message.level === 'warning'),
    info: messages.filter((message) => message.level === 'info'),
  }

  return (
    <section className="panel validation-panel" aria-labelledby="validation-title">
      <div className="panel-header">
        <h2 id="validation-title">Validation & status</h2>
        <div className="header-status" aria-live="polite">
          {lastUpdatedLabel ? (
            <span className="timestamp-badge">
              last updated {lastUpdatedLabel}
              {retrying ? ' — retrying' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {(['error', 'warning', 'info'] as const).map((level) => {
        const entries = groupedMessages[level]
        if (entries.length === 0) {
          return null
        }

        return (
          <div key={level} className={`message-group message-group-${level}`}>
            <h3>{levelTitles[level]}</h3>
            <ul>
              {entries.map((message) => (
                <li key={message.code}>{message.message}</li>
              ))}
            </ul>
          </div>
        )
      })}

      {messages.length === 0 ? <p>No validation messages.</p> : null}
    </section>
  )
}
