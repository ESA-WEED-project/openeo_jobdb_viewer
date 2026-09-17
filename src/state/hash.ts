import type { AppFilters, DateRangeFilter, HashState, NumberRangeFilter, TriState } from './types'

export const EXAMPLE_COLLECTION_URL =
  'https://catalogue.weed.apex.esa.int/collections/test_bert-v101-jobdb'

export const DEFAULT_REFRESH_INTERVAL_SECONDS = 30
const REMOVED_FILTER_FIELDS = new Set(['bbox', 'target_epsg', 'id'])

export function createEmptyFilters(): AppFilters {
  return {
    enums: {},
    texts: {},
    numbers: {},
    dates: {},
    booleans: {},
  }
}

export function cloneFilters(filters: AppFilters): AppFilters {
  return {
    enums: Object.fromEntries(
      Object.entries(filters.enums).map(([field, values]) => [field, [...values]]),
    ),
    texts: { ...filters.texts },
    numbers: Object.fromEntries(
      Object.entries(filters.numbers).map(([field, range]) => [field, { ...range }]),
    ),
    dates: Object.fromEntries(
      Object.entries(filters.dates).map(([field, range]) => [field, { ...range }]),
    ),
    booleans: { ...filters.booleans },
  }
}

export function createDefaultHashState(): HashState {
  return {
    collectionUrl: EXAMPLE_COLLECTION_URL,
    refreshIntervalSeconds: DEFAULT_REFRESH_INTERVAL_SECONDS,
    filters: createEmptyFilters(),
  }
}

function isTriState(value: string): value is TriState {
  return value === 'any' || value === 'true' || value === 'false'
}

function stripRemovedFilterFields<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([field]) => !REMOVED_FILTER_FIELDS.has(field)),
  )
}

function sanitizeNumberFilter(value: unknown): NumberRangeFilter {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const range = value as Record<string, unknown>
  const sanitized: NumberRangeFilter = {}

  if (typeof range.min === 'number' && Number.isFinite(range.min)) {
    sanitized.min = range.min
  }

  if (typeof range.max === 'number' && Number.isFinite(range.max)) {
    sanitized.max = range.max
  }

  return sanitized
}

function sanitizeDateFilter(value: unknown): DateRangeFilter {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const range = value as Record<string, unknown>
  const sanitized: DateRangeFilter = {}

  if (typeof range.from === 'string' && range.from.length > 0) {
    sanitized.from = range.from
  }

  if (typeof range.to === 'string' && range.to.length > 0) {
    sanitized.to = range.to
  }

  return sanitized
}

function sanitizeFilters(rawFilters: unknown): AppFilters {
  if (typeof rawFilters !== 'object' || rawFilters === null) {
    return createEmptyFilters()
  }

  const filters = rawFilters as Record<string, unknown>

  const enums =
    typeof filters.enums === 'object' && filters.enums !== null
      ? Object.fromEntries(
          Object.entries(filters.enums as Record<string, unknown>).map(([field, value]) => [
            field,
            Array.isArray(value)
              ? value.filter((entry): entry is string => typeof entry === 'string')
              : [],
          ]),
        )
      : {}

  const texts =
    typeof filters.texts === 'object' && filters.texts !== null
      ? Object.fromEntries(
          Object.entries(filters.texts as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {}

  const numbers =
    typeof filters.numbers === 'object' && filters.numbers !== null
      ? Object.fromEntries(
          Object.entries(filters.numbers as Record<string, unknown>).map(([field, value]) => [
            field,
            sanitizeNumberFilter(value),
          ]),
        )
      : {}

  const dates =
    typeof filters.dates === 'object' && filters.dates !== null
      ? Object.fromEntries(
          Object.entries(filters.dates as Record<string, unknown>).map(([field, value]) => [
            field,
            sanitizeDateFilter(value),
          ]),
        )
      : {}

  const booleans =
    typeof filters.booleans === 'object' && filters.booleans !== null
      ? Object.fromEntries(
          Object.entries(filters.booleans as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
            .filter((entry): entry is [string, TriState] => isTriState(entry[1])),
        )
      : {}

  return {
    enums: stripRemovedFilterFields(enums),
    texts: stripRemovedFilterFields(texts),
    numbers: stripRemovedFilterFields(numbers),
    dates: stripRemovedFilterFields(dates),
    booleans: stripRemovedFilterFields(booleans),
  }
}

function compactFilters(filters: AppFilters): AppFilters {
  return {
    enums: stripRemovedFilterFields(
      Object.fromEntries(Object.entries(filters.enums).filter(([, values]) => values.length > 0)),
    ),
    texts: stripRemovedFilterFields(
      Object.fromEntries(Object.entries(filters.texts).filter(([, value]) => value.trim().length > 0)),
    ),
    numbers: stripRemovedFilterFields(
      Object.fromEntries(
        Object.entries(filters.numbers).filter(
          ([, value]) => value.min !== undefined || value.max !== undefined,
        ),
      ),
    ),
    dates: stripRemovedFilterFields(
      Object.fromEntries(
        Object.entries(filters.dates).filter(
          ([, value]) => value.from !== undefined || value.to !== undefined,
        ),
      ),
    ),
    booleans: stripRemovedFilterFields(
      Object.fromEntries(Object.entries(filters.booleans).filter(([, value]) => value !== 'any')),
    ),
  }
}

export function hasActiveFilters(filters: AppFilters): boolean {
  const compactedFilters = compactFilters(filters)

  return (
    Object.keys(compactedFilters.enums).length > 0 ||
    Object.keys(compactedFilters.texts).length > 0 ||
    Object.keys(compactedFilters.numbers).length > 0 ||
    Object.keys(compactedFilters.dates).length > 0 ||
    Object.keys(compactedFilters.booleans).length > 0
  )
}

export function readHashState(): Partial<HashState> {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash

  if (rawHash.length === 0) {
    return {}
  }

  const params = new URLSearchParams(rawHash)
  const rawFilters = params.get('filters')
  let parsedFilters: AppFilters = createEmptyFilters()

  if (rawFilters) {
    try {
      parsedFilters = sanitizeFilters(JSON.parse(rawFilters) as unknown)
    } catch {
      parsedFilters = createEmptyFilters()
    }
  }

  return {
    collectionUrl: params.get('url') ?? undefined,
    refreshIntervalSeconds:
      (() => {
        const rawValue = params.get('refreshIntervalSeconds')
        const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : NaN
        return Number.isFinite(parsedValue) && parsedValue > 0
          ? parsedValue
          : DEFAULT_REFRESH_INTERVAL_SECONDS
      })(),
    filters: parsedFilters,
  }
}

export function writeHashState(state: HashState): void {
  const params = new URLSearchParams()

  if (state.collectionUrl.trim().length > 0) {
    params.set('url', state.collectionUrl)
  }

  params.set('refreshIntervalSeconds', String(state.refreshIntervalSeconds))

  const compactedFilters = compactFilters(state.filters)
  if (hasActiveFilters(compactedFilters)) {
    params.set('filters', JSON.stringify(compactedFilters))
  }

  const nextHash = params.toString()
  const currentHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash

  if (currentHash !== nextHash) {
    const nextUrl =
      nextHash.length > 0
        ? `${window.location.pathname}${window.location.search}#${nextHash}`
        : `${window.location.pathname}${window.location.search}`
    window.history.replaceState(null, '', nextUrl)
  }
}
