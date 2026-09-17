import { formatStatusLabel, getStatusColor } from '../map/status'
import type { FacetValueCount } from '../stac/facets'

interface StatusLegendProps {
  counts: FacetValueCount[]
  disabled: boolean
  onToggle: (status: string) => void
  selectedValues: string[]
}

export function StatusLegend({
  counts,
  disabled,
  onToggle,
  selectedValues,
}: StatusLegendProps) {
  return (
    <section className="panel legend-panel" aria-labelledby="legend-title">
      <h2 id="legend-title">Status legend</h2>
      {disabled ? <p>Status colour coding is disabled because the loaded items have no status field.</p> : null}
      {counts.length === 0 ? <p>No status values found in the loaded items.</p> : null}

      <ul className="legend-list">
        {counts.map(({ count, value }) => {
          const selected = selectedValues.length === 0 || selectedValues.includes(value)
          return (
            <li key={value}>
              <button
                type="button"
                className={`legend-entry ${selected ? 'is-selected' : 'is-muted'}`}
                onClick={() => onToggle(value)}
                disabled={disabled}
                aria-pressed={selected}
              >
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: getStatusColor(value, !disabled) }}
                  aria-hidden="true"
                ></span>
                <span className="legend-label">{formatStatusLabel(value)}</span>
                <span className="legend-count">{count}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
