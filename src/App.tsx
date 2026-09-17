import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DetailsPanel } from './components/DetailsPanel'
import { FiltersPanel } from './components/FiltersPanel'
import { MapView } from './components/MapView'
import { StatusLegend } from './components/StatusLegend'
import { ValidationPanel } from './components/ValidationPanel'
import { prepareItemsForMap } from './map/features'
import {
  countMatchingItems,
  getEnumValueCounts,
  inferFacets,
} from './stac/facets'
import { loadCollectionItems, normalizeCollectionUrl } from './stac/client'
import { createEmptyFilters, createDefaultHashState, EXAMPLE_COLLECTION_URL, readHashState, writeHashState } from './state/hash'
import { readRecentUrls, rememberRecentUrl } from './state/recentUrls'
import type { AppFilters, DateRangeFilter, NumberRangeFilter, TriState, ValidationMessage } from './state/types'
import type { StacCollection, StacItem } from './stac/types'
import './App.css'

const MAX_BACKOFF_SECONDS = 300
const FAILURE_BACKOFF_BASE_SECONDS = 30

interface SelectedItemState {
  item: StacItem
  key: string
  selfHref?: string
}

function hasStatusProperty(items: StacItem[]): boolean {
  return items.some((item) => Object.prototype.hasOwnProperty.call(item.properties, 'status'))
}

function collectionHasGlobalExtent(collection: StacCollection | undefined): boolean {
  const boundingBoxes = collection?.extent?.spatial?.bbox
  return Array.isArray(boundingBoxes)
    ? boundingBoxes.some(
        (bbox) =>
          bbox.length >= 4 &&
          bbox[0] === -180 &&
          bbox[1] === -90 &&
          bbox[2] === 180 &&
          bbox[3] === 90,
      )
    : false
}

function formatClockTime(value: Date | undefined): string | undefined {
  return value
    ? value.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : undefined
}

function cloneFilters(filters: AppFilters): AppFilters {
  return {
    enums: Object.fromEntries(Object.entries(filters.enums).map(([field, values]) => [field, [...values]])),
    texts: { ...filters.texts },
    numbers: Object.fromEntries(Object.entries(filters.numbers).map(([field, range]) => [field, { ...range }])),
    dates: Object.fromEntries(Object.entries(filters.dates).map(([field, range]) => [field, { ...range }])),
    booleans: { ...filters.booleans },
  }
}

function buildValidationMessages(
  collection: StacCollection | undefined,
  items: StacItem[],
  loadMessages: ValidationMessage[],
  mapSummary: ReturnType<typeof prepareItemsForMap>['summary'],
  statusEnabled: boolean,
): ValidationMessage[] {
  if (!collection && loadMessages.length === 0 && items.length === 0) {
    return []
  }

  const messages = [...loadMessages]
  const hasBlockingError = messages.some((message) => message.level === 'error')

  if (hasBlockingError && !collection) {
    return messages
  }

  if (items.length === 0) {
    messages.push({
      code: 'empty-items',
      level: 'warning',
      message: 'The collection returned 0 items.',
    })
  }

  if (mapSummary.missingGeometryCount > 0) {
    messages.push({
      code: 'missing-geometry',
      level: 'warning',
      message: `${mapSummary.missingGeometryCount} of ${items.length} items have no usable geometry (no geometry and no bbox) and are not shown on the map.`,
    })
  }

  if (items.length > 0 && !statusEnabled) {
    messages.push({
      code: 'missing-status',
      level: 'warning',
      message: 'No item has a status property — colour coding is disabled.',
    })
  }

  if (mapSummary.missingIdCount > 0) {
    messages.push({
      code: 'missing-id',
      level: 'warning',
      message: `${mapSummary.missingIdCount} items have no id — falling back to array index; incremental refresh may be unreliable for these.`,
    })
  }

  if (mapSummary.invalidLonLatCount > 0) {
    messages.push({
      code: 'invalid-lon-lat',
      level: 'info',
      message: `${mapSummary.invalidLonLatCount} items contain coordinates outside valid lon/lat ranges.`,
    })
  }

  if (collectionHasGlobalExtent(collection)) {
    messages.push({
      code: 'global-extent',
      level: 'info',
      message: 'The collection extent is the global default [-180,-90,180,90], which is common and harmless.',
    })
  }

  return messages
}

function App() {
  const initialHashState = useMemo(() => ({ ...createDefaultHashState(), ...readHashState() }), [])
  const [collectionInput, setCollectionInput] = useState(initialHashState.collectionUrl)
  const [collectionUrl, setCollectionUrl] = useState(initialHashState.collectionUrl)
  const [pageSize, setPageSize] = useState(initialHashState.pageSize)
  const [pageLimit, setPageLimit] = useState(initialHashState.pageLimit)
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    initialHashState.refreshIntervalSeconds,
  )
  const [filters, setFilters] = useState<AppFilters>(initialHashState.filters ?? createEmptyFilters())
  const [recentUrls, setRecentUrls] = useState<string[]>(() => readRecentUrls())
  const [collection, setCollection] = useState<StacCollection>()
  const [items, setItems] = useState<StacItem[]>([])
  const [loadMessages, setLoadMessages] = useState<ValidationMessage[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>()
  const [selectedItem, setSelectedItem] = useState<SelectedItemState>()
  const [loadSequence, setLoadSequence] = useState(0)

  const abortControllerRef = useRef<AbortController>()
  const pollTimeoutRef = useRef<number>()
  const failureCountRef = useRef(0)
  const activeRequestRef = useRef(false)
  const performLoadRef = useRef<(backgroundRefresh: boolean) => Promise<void>>()
  const lastSuccessfulCollectionUrlRef = useRef<string>()

  const preparedMapItemsResult = useMemo(() => prepareItemsForMap(items), [items])
  const facetsResult = useMemo(() => inferFacets(items), [items])
  const statusEnabled = useMemo(() => hasStatusProperty(items), [items])
  const validationMessages = useMemo(
    () =>
      buildValidationMessages(
        collection,
        items,
        loadMessages,
        preparedMapItemsResult.summary,
        statusEnabled,
      ),
    [collection, items, loadMessages, preparedMapItemsResult.summary, statusEnabled],
  )
  const showingCount = useMemo(
    () => countMatchingItems(items, filters, facetsResult.facets),
    [items, filters, facetsResult.facets],
  )
  const statusCounts = useMemo(
    () => getEnumValueCounts(items, 'status', filters, facetsResult.facets),
    [items, filters, facetsResult.facets],
  )

  const syncHashState = useCallback(() => {
    writeHashState({
      collectionUrl,
      filters,
      pageLimit,
      pageSize,
      refreshIntervalSeconds,
    })
  }, [collectionUrl, filters, pageLimit, pageSize, refreshIntervalSeconds])

  useEffect(() => {
    syncHashState()
  }, [syncHashState])

  const clearPollTimer = useCallback(() => {
    if (pollTimeoutRef.current !== undefined) {
      window.clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = undefined
    }
  }, [])

  const scheduleNextPoll = useCallback(
    (delaySeconds: number) => {
      clearPollTimer()
      if (document.visibilityState === 'hidden' || collectionUrl.trim().length === 0) {
        return
      }

      pollTimeoutRef.current = window.setTimeout(() => {
        void performLoadRef.current?.(true)
      }, delaySeconds * 1000)
    },
    [clearPollTimer, collectionUrl],
  )

  const performLoad = useCallback(async (backgroundRefresh: boolean) => {
    if (activeRequestRef.current) {
      if (backgroundRefresh) {
        scheduleNextPoll(refreshIntervalSeconds)
      }
      return
    }

    const normalizedUrlResult = normalizeCollectionUrl(collectionUrl)
    if (!normalizedUrlResult.normalizedUrl) {
      setLoadMessages(normalizedUrlResult.messages)
      setCollection(undefined)
      setItems([])
      setSelectedItem(undefined)
      return
    }

    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    activeRequestRef.current = true

    const isNewCollectionUrl = normalizedUrlResult.normalizedUrl !== lastSuccessfulCollectionUrlRef.current

    if (backgroundRefresh || (items.length > 0 && !isNewCollectionUrl)) {
      setIsRefreshing(true)
    } else {
      setIsInitialLoading(true)
    }

    try {
      const result = await loadCollectionItems({
        collectionUrl,
        pageLimit,
        pageSize,
        signal: abortController.signal,
      })

      if (abortController.signal.aborted) {
        return
      }

      failureCountRef.current = 0
      setIsRetrying(false)
      setCollection(result.collection)
      setItems(result.items)
      setLoadMessages(result.messages)
      setCollectionUrl(result.collectionUrl)
      setCollectionInput(result.collectionUrl)
      setLastUpdatedAt(new Date())
      lastSuccessfulCollectionUrlRef.current = result.collectionUrl
      setRecentUrls(rememberRecentUrl(result.collectionUrl))

      setSelectedItem((currentSelection) => {
        if (!currentSelection) {
          return currentSelection
        }

        const matchingItem = result.items.find((item, index) => {
          const itemId = item.id !== undefined && item.id !== null ? String(item.id) : `__index_${index}`
          return itemId === currentSelection.key
        })

        return matchingItem
          ? {
              item: matchingItem,
              key: currentSelection.key,
              selfHref: matchingItem.links?.find((link) => link.rel === 'self')?.href,
            }
          : undefined
      })

      scheduleNextPoll(refreshIntervalSeconds)
    } catch (error) {
      if (abortController.signal.aborted) {
        return
      }

      if (error instanceof Error && error.name === 'ValidationError' && 'validationMessage' in error) {
        const validationError = error as Error & { validationMessage: ValidationMessage }
        setLoadMessages([validationError.validationMessage])
      } else if (error instanceof Error) {
        setLoadMessages([
          {
            code: 'unexpected-error',
            level: 'error',
            message: error.message,
          },
        ])
      }

      if (backgroundRefresh || items.length > 0) {
        failureCountRef.current += 1
        setIsRetrying(true)
        const backoffDelaySeconds = Math.min(
          MAX_BACKOFF_SECONDS,
          FAILURE_BACKOFF_BASE_SECONDS * 2 ** (failureCountRef.current - 1),
        )
        scheduleNextPoll(backoffDelaySeconds)
      }
    } finally {
      activeRequestRef.current = false
      setIsInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [collectionUrl, items.length, pageLimit, pageSize, refreshIntervalSeconds, scheduleNextPoll])

  useEffect(() => {
    performLoadRef.current = performLoad
  }, [performLoad])

  useEffect(() => {
    void performLoadRef.current?.(false)
    return () => abortControllerRef.current?.abort()
  }, [loadSequence])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearPollTimer()
        return
      }

      void performLoadRef.current?.(true)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [clearPollTimer])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCollectionUrl(collectionInput)
    setFilters(createEmptyFilters())
    clearPollTimer()
    setLoadSequence((value) => value + 1)
  }

  const updateFilters = (nextFilters: AppFilters) => {
    setFilters(cloneFilters(nextFilters))
  }

  const toggleEnumFilter = (field: string, value: string) => {
    const facet = facetsResult.facets.find((entry) => entry.field === field)
    if (!facet || facet.kind !== 'enum') {
      return
    }

    const availableValues = facet.values.map((entry) => entry.value)
    const currentValues = filters.enums[field] ?? []
    const isCurrentlyUnfiltered = currentValues.length === 0
    const effectiveValues = isCurrentlyUnfiltered ? [...availableValues] : [...currentValues]
    const nextValues = effectiveValues.includes(value)
      ? effectiveValues.filter((entry) => entry !== value)
      : [...effectiveValues, value]

    updateFilters({
      ...filters,
      enums: {
        ...filters.enums,
        [field]: nextValues.length === availableValues.length ? [] : nextValues.sort(),
      },
    })
  }

  const updateTextFilter = (field: string, value: string) => {
    updateFilters({
      ...filters,
      texts: {
        ...filters.texts,
        [field]: value,
      },
    })
  }

  const updateNumberFilter = (field: string, value: NumberRangeFilter) => {
    updateFilters({
      ...filters,
      numbers: {
        ...filters.numbers,
        [field]: value,
      },
    })
  }

  const updateDateFilter = (field: string, value: DateRangeFilter) => {
    updateFilters({
      ...filters,
      dates: {
        ...filters.dates,
        [field]: value,
      },
    })
  }

  const updateBooleanFilter = (field: string, value: TriState) => {
    updateFilters({
      ...filters,
      booleans: {
        ...filters.booleans,
        [field]: value,
      },
    })
  }

  const resetFilters = () => setFilters(createEmptyFilters())

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Static STAC collection viewer</p>
          <h1>openEO job map viewer</h1>
          <p className="header-copy">
            Load a STAC collection and inspect openEO job footprints, statuses, filters, and live refreshes.
          </p>
        </div>
        <form className="load-form" onSubmit={handleSubmit}>
          <label>
            <span>STAC collection URL</span>
            <input
              type="url"
              value={collectionInput}
              onChange={(event) => setCollectionInput(event.target.value)}
              placeholder={EXAMPLE_COLLECTION_URL}
            />
          </label>
          <div className="config-grid">
            <label>
              <span>Items per page</span>
              <input
                type="number"
                min={1}
                value={pageSize}
                onChange={(event) => setPageSize(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label>
              <span>Page cap</span>
              <input
                type="number"
                min={1}
                value={pageLimit}
                onChange={(event) => setPageLimit(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label>
              <span>Refresh interval (s)</span>
              <input
                type="number"
                min={5}
                value={refreshIntervalSeconds}
                onChange={(event) => setRefreshIntervalSeconds(Math.max(5, Number(event.target.value) || 5))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Load collection</button>
            <button type="button" onClick={() => void performLoadRef.current?.(true)}>
              Manual refresh
            </button>
            {isRefreshing ? <span className="spinner-badge">Refreshing…</span> : null}
          </div>
          <div className="preset-row">
            <button type="button" className="text-button" onClick={() => setCollectionInput(EXAMPLE_COLLECTION_URL)}>
              Use example URL
            </button>
            {recentUrls.length > 0 ? (
              <div className="recent-urls">
                <span>Recent:</span>
                {recentUrls.map((url) => (
                  <button key={url} type="button" className="text-button" onClick={() => setCollectionInput(url)}>
                    {url}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </form>
      </header>

      <div className="content-grid">
        <aside className="sidebar">
          <ValidationPanel
            lastUpdatedLabel={formatClockTime(lastUpdatedAt)}
            messages={validationMessages}
            retrying={isRetrying}
          />
          <StatusLegend
            counts={statusCounts}
            disabled={!statusEnabled}
            onToggle={(status) => toggleEnumFilter('status', status)}
            selectedValues={filters.enums.status ?? []}
          />
          <FiltersPanel
            facets={facetsResult.facets}
            filters={filters}
            items={items}
            onBooleanChange={updateBooleanFilter}
            onDateChange={updateDateFilter}
            onEnumToggle={toggleEnumFilter}
            onNumberChange={updateNumberFilter}
            onReset={resetFilters}
            onTextChange={updateTextFilter}
            showingCount={showingCount}
            sparseFields={facetsResult.sparseFields}
            totalCount={items.length}
          />
        </aside>

        <main className="main-panel">
          <div className="map-wrapper">
            <MapView
              collectionUrl={collectionUrl}
              facets={facetsResult.facets}
              filters={filters}
              items={preparedMapItemsResult.items}
              onSelect={setSelectedItem}
              statusEnabled={statusEnabled}
            />
            {isInitialLoading ? <div className="map-overlay">Loading collection…</div> : null}
          </div>
        </main>

        <aside className="details-column">
          <DetailsPanel item={selectedItem?.item} itemKey={selectedItem?.key} selfHref={selectedItem?.selfHref} />
        </aside>
      </div>
    </div>
  )
}

export default App
