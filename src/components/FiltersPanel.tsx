import type { AppFilters, DateRangeFilter, NumberRangeFilter, TriState } from '../state/types'
import { formatUtcDateTimeInput, parseUtcDateTimeInput } from '../state/datetime'
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
  onTextChange: (field: string, value: string) => void
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
  const currentMin = value.min ?? facet.min
  const currentMax = value.max ?? facet.max

  return (
    <fieldset className="facet-group">
      <legend>{facet.field}</legend>
      <div className="range-grid">
        <label>
          <span>Minimum</span>
          <input
            type="number"
            value={currentMin}
            min={facet.min}
            max={currentMax}
            onChange={(event) =>
              onNumberChange(facet.field, {
                ...value,
                min: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>Maximum</span>
          <input
            type="number"
            value={currentMax}
            min={currentMin}
            max={facet.max}
            onChange={(event) =>
              onNumberChange(facet.field, {
                ...value,
                max: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span className="sr-only">Minimum slider for {facet.field}</span>
          <input
            type="range"
            min={facet.min}
            max={facet.max}
            value={currentMin}
            onChange={(event) =>
              onNumberChange(facet.field, {
                ...value,
                min: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span className="sr-only">Maximum slider for {facet.field}</span>
          <input
            type="range"
            min={facet.min}
            max={facet.max}
            value={currentMax}
            onChange={(event) =>
              onNumberChange(facet.field, {
                ...value,
                max: Number(event.target.value),
              })
            }
          />
        </label>
      </div>
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

  return (
    <fieldset className="facet-group">
      <legend>{facet.field}</legend>
      <div className="range-grid">
        <label>
          <span>From</span>
          <input
            type="datetime-local"
            value={formatUtcDateTimeInput(value.from)}
            min={formatUtcDateTimeInput(facet.min)}
            max={formatUtcDateTimeInput(value.to ?? facet.max)}
            onChange={(event) =>
              onDateChange(facet.field, {
                ...value,
                from: parseUtcDateTimeInput(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="datetime-local"
            value={formatUtcDateTimeInput(value.to)}
            min={formatUtcDateTimeInput(value.from ?? facet.min)}
            max={formatUtcDateTimeInput(facet.max)}
            onChange={(event) =>
              onDateChange(facet.field, {
                ...value,
                to: parseUtcDateTimeInput(event.target.value),
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
  onTextChange,
  showingCount,
  sparseFields,
  totalCount,
}: FiltersPanelProps) {
  return (
    <section className="panel filters-panel" aria-labelledby="filters-title">
      <div className="panel-header">
        <h2 id="filters-title">Filters</h2>
        <button type="button" onClick={onReset}>
          Reset filters
        </button>
      </div>
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
    </section>
  )
}
