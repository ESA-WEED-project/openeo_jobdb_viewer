import type { AppFilters, DateRangeFilter, NumberRangeFilter, TriState } from '../state/types'
import { formatUtcYearInput, parseUtcYearInput } from '../state/datetime'
import { FloatingPanel } from './FloatingPanel'
import { ChevronIcon, ResetIcon } from './PanelIcons'
import {
  getEnumValueCounts,
  type BooleanFacetDefinition,
  type DateFacetDefinition,
  type EnumFacetDefinition,
  type FacetDefinition,
  type NumberFacetDefinition,
  type TextFacetDefinition,
} from '../stac/facets'
import type { StacItem } from '../stac/types'

interface FiltersPanelProps {
  facets: FacetDefinition[]
  filters: AppFilters
  items: StacItem[]
  onBooleanChange: (field: string, value: TriState) => void
  onDateChange: (field: string, value: DateRangeFilter) => void
  onEnumToggle: (field: string, value: string) => void
  onNumberChange: (field: string, value: NumberRangeFilter) => void
  onReset: () => void
  onToggleCollapse: () => void
  onTextChange: (field: string, value: string) => void
  panelCollapsed: boolean
  showingCount: number
  sparseFields: string[]
  totalCount: number
}

function EnumFacet({
  facet,
  filters,
  items,
  onEnumToggle,
  facets,
}: {
  facet: EnumFacetDefinition
  facets: FacetDefinition[]
  filters: AppFilters
  items: StacItem[]
  onEnumToggle: (field: string, value: string) => void
}) {
  const selectedValues = filters.enums[facet.field] ?? []
  const counts = getEnumValueCounts(items, facet.field, filters, facets)

  return (
    <fieldset className="facet-group">
      <legend>{facet.field}</legend>
      <div className="enum-options">
        {counts.map(({ count, value }) => {
          const checked = selectedValues.length === 0 || selectedValues.includes(value)
          return (
            <label key={value} className="enum-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onEnumToggle(facet.field, value)}
              />
              <span>{value}</span>
              <span className="option-count">{count}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function TextFacet({
  facet,
  filters,
  onTextChange,
}: {
  facet: TextFacetDefinition
  filters: AppFilters
  onTextChange: (field: string, value: string) => void
}) {
  return (
    <label className="facet-group">
      <span>{facet.field}</span>
      <input
        type="search"
        value={filters.texts[facet.field] ?? ''}
        onChange={(event) => onTextChange(facet.field, event.target.value)}
        placeholder={`Search ${facet.field}`}
      />
    </label>
  )
}

function formatRangeValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function DualRangeSlider({
  field,
  min,
  max,
  valueMin,
  valueMax,
  onChange,
}: {
  field: string
  min: number
  max: number
  valueMin: number
  valueMax: number
  onChange: (value: NumberRangeFilter) => void
}) {
  const span = max - min || 1
  const minPercent = ((valueMin - min) / span) * 100
  const maxPercent = ((valueMax - min) / span) * 100

  return (
    <div className="dual-range">
      <div className="dual-range-labels">
        <span>Min {formatRangeValue(valueMin)}</span>
        <span>Max {formatRangeValue(valueMax)}</span>
      </div>
      <div className="dual-range-track">
        <div
          className="dual-range-track-highlight"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        <input
          type="range"
          className="dual-range-input"
          min={min}
          max={max}
          value={valueMin}
          aria-label={`Minimum ${field}`}
          onChange={(event) => onChange({ min: Math.min(Number(event.target.value), valueMax) })}
        />
        <input
          type="range"
          className="dual-range-input"
          min={min}
          max={max}
          value={valueMax}
          aria-label={`Maximum ${field}`}
          onChange={(event) => onChange({ max: Math.max(Number(event.target.value), valueMin) })}
        />
      </div>
    </div>
  )
}

function NumberFacet({
  facet,
  filters,
  onNumberChange,
}: {
  facet: NumberFacetDefinition
  filters: AppFilters
  onNumberChange: (field: string, value: NumberRangeFilter) => void
}) {
  const value = filters.numbers[facet.field] ?? {}
  const sliderMin = value.min ?? facet.min
  const sliderMax = value.max ?? facet.max

  return (
    <fieldset className="facet-group">
      <legend>{facet.unit ? `${facet.field} (${facet.unit})` : facet.field}</legend>
      <DualRangeSlider
        field={facet.field}
        min={facet.min}
        max={facet.max}
        valueMin={sliderMin}
        valueMax={sliderMax}
        onChange={(nextValue) => onNumberChange(facet.field, { ...value, ...nextValue })}
      />
    </fieldset>
  )
}

function DateFacet({
  facet,
  filters,
  onDateChange,
}: {
  facet: DateFacetDefinition
  filters: AppFilters
  onDateChange: (field: string, value: DateRangeFilter) => void
}) {
  const value = filters.dates[facet.field] ?? {}
  const minYear = formatUtcYearInput(facet.min)
  const maxYear = formatUtcYearInput(facet.max)

  return (
    <fieldset className="facet-group">
      <legend>{facet.field}</legend>
      <div className="range-grid">
        <label>
          <span>From</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={formatUtcYearInput(value.from)}
            min={minYear}
            placeholder={minYear}
            aria-label={`${facet.field} from year`}
            onChange={(event) =>
              onDateChange(facet.field, {
                ...value,
                from: parseUtcYearInput(event.target.value, 'start'),
              })
            }
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={formatUtcYearInput(value.to)}
            placeholder={maxYear}
            aria-label={`${facet.field} to year`}
            onChange={(event) =>
              onDateChange(facet.field, {
                ...value,
                to: parseUtcYearInput(event.target.value, 'end'),
              })
            }
          />
        </label>
      </div>
    </fieldset>
  )
}

function BooleanFacet({
  facet,
  filters,
  onBooleanChange,
}: {
  facet: BooleanFacetDefinition
  filters: AppFilters
  onBooleanChange: (field: string, value: TriState) => void
}) {
  return (
    <label className="facet-group">
      <span>{facet.field}</span>
      <select
        value={filters.booleans[facet.field] ?? 'any'}
        onChange={(event) => onBooleanChange(facet.field, event.target.value as TriState)}
      >
        <option value="any">Any</option>
        <option value="true">True ({facet.trueCount})</option>
        <option value="false">False ({facet.falseCount})</option>
      </select>
    </label>
  )
}

export function FiltersPanel({
  facets,
  filters,
  items,
  onBooleanChange,
  onDateChange,
  onEnumToggle,
  onNumberChange,
  onReset,
  onToggleCollapse,
  onTextChange,
  panelCollapsed,
  showingCount,
  sparseFields,
  totalCount,
}: FiltersPanelProps) {
  return (
    <FloatingPanel
      className="filters-panel"
      collapsed={panelCollapsed}
      title="Filters"
      actions={
        <>
          <button
            type="button"
            className="icon-button"
            onClick={onReset}
            aria-label="Reset filters"
            title="Reset filters"
          >
            <ResetIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onToggleCollapse}
            aria-expanded={!panelCollapsed}
            aria-label={panelCollapsed ? 'Expand filters' : 'Collapse filters'}
            title={panelCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronIcon direction={panelCollapsed ? 'down' : 'up'} />
          </button>
        </>
      }
    >
      <p className="filter-summary">showing {showingCount} of {totalCount} jobs</p>

      <div className="facet-list">
        {facets.map((facet) => {
          switch (facet.kind) {
            case 'enum':
              return (
                <EnumFacet
                  key={facet.field}
                  facet={facet}
                  facets={facets}
                  filters={filters}
                  items={items}
                  onEnumToggle={onEnumToggle}
                />
              )
            case 'text':
              return (
                <TextFacet
                  key={facet.field}
                  facet={facet}
                  filters={filters}
                  onTextChange={onTextChange}
                />
              )
            case 'number':
              return (
                <NumberFacet
                  key={facet.field}
                  facet={facet}
                  filters={filters}
                  onNumberChange={onNumberChange}
                />
              )
            case 'datetime':
              return (
                <DateFacet
                  key={facet.field}
                  facet={facet}
                  filters={filters}
                  onDateChange={onDateChange}
                />
              )
            case 'boolean':
              return (
                <BooleanFacet
                  key={facet.field}
                  facet={facet}
                  filters={filters}
                  onBooleanChange={onBooleanChange}
                />
              )
          }
        })}
      </div>

      {sparseFields.length > 0 ? (
        <details className="sparse-fields">
          <summary>Sparse fields ({sparseFields.length})</summary>
          <ul>
            {sparseFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </FloatingPanel>
  )
}
