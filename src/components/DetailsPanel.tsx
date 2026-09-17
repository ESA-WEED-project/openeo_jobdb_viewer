import type { StacItem } from '../stac/types'

interface DetailsPanelProps {
  item?: StacItem
  itemKey?: string
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

export function DetailsPanel({ item, itemKey, selfHref }: DetailsPanelProps) {
  return (
    <section className="panel details-panel" aria-labelledby="details-title">
      <h2 id="details-title">Selected job</h2>
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
    </section>
  )
}
