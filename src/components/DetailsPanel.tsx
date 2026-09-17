import type { StacItem } from '../stac/types'
import { FloatingPanel } from './FloatingPanel'
import { ChevronIcon, CloseIcon } from './PanelIcons'

interface DetailsPanelProps {
  item?: StacItem
  itemKey?: string
  onClear: () => void
  onToggleCollapse: () => void
  panelCollapsed: boolean
  selfHref?: string
}

function renderValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return '—'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

export function DetailsPanel({
  item,
  itemKey,
  onClear,
  onToggleCollapse,
  panelCollapsed,
  selfHref,
}: DetailsPanelProps) {
  return (
    <FloatingPanel
      className="details-panel"
      collapsed={panelCollapsed}
      title={item ? `Selected job${item.id !== undefined ? ` · ${String(item.id)}` : ''}` : 'Selected job'}
      actions={
        <>
          <button
            type="button"
            className="icon-button"
            onClick={onToggleCollapse}
            aria-expanded={!panelCollapsed}
            aria-label={panelCollapsed ? 'Expand selected job' : 'Collapse selected job'}
            title={panelCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronIcon direction={panelCollapsed ? 'down' : 'up'} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClear}
            aria-label="Close selected job"
            title="Close"
          >
            <CloseIcon />
          </button>
        </>
      }
    >
      {!item ? <p>Click a feature on the map to inspect all of its properties.</p> : null}

      {item ? (
        <>
          <dl className="detail-summary">
            <div>
              <dt>Feature key</dt>
              <dd>{itemKey ?? '—'}</dd>
            </div>
            <div>
              <dt>Item id</dt>
              <dd>{item.id !== undefined ? String(item.id) : '—'}</dd>
            </div>
            <div>
              <dt>Self link</dt>
              <dd>
                {selfHref ? (
                  <a href={selfHref} target="_blank" rel="noreferrer">
                    Open STAC item
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>

          <table className="details-table">
            <caption className="sr-only">All selected item properties</caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(item.properties).map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{key}</th>
                  <td>{renderValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </FloatingPanel>
  )
}
