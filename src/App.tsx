import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DetailsPanel } from './components/DetailsPanel'
import { FiltersPanel } from './components/FiltersPanel'
import { MapView } from './components/MapView'
import { StatusLegend } from './components/StatusLegend'
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
import type { StacItem } from './stac/types'
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

function cloneFilters(filters: AppFilters): AppFilters {
  return {
    enums: Object.fromEntries(Object.entries(filters.enums).map(([field, values]) => [field, [...values]])),
    texts: { ...filters.texts },
    numbers: Object.fromEntries(Object.entries(filters.numbers).map(([field, range]) => [field, { ...range }])),
    dates: Object.fromEntries(Object.entries(filters.dates).map(([field, range]) => [field, { ...range }])),
    booleans: { ...filters.booleans },
  }
}

function App() {
  const initialHashState = useMemo(() => ({ ...createDefaultHashState(), ...readHashState() }), [])
  const [collectionInput, setCollectionInput] = useState(initialHashState.collectionUrl)
  const [collectionUrl, setCollectionUrl] = useState(initialHashState.collectionUrl)
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    initialHashState.refreshIntervalSeconds,
  )
  const [filters, setFilters] = useState<AppFilters>(initialHashState.filters ?? createEmptyFilters())
  const [recentUrls, setRecentUrls] = useState<string[]>(() => readRecentUrls())
  const [items, setItems] = useState<StacItem[]>([])
  const [loadMessages, setLoadMessages] = useState<ValidationMessage[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedItemState>()
  const [loadSequence, setLoadSequence] = useState(0)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [detailsCollapsed, setDetailsCollapsed] = useState(false)

  const abortControllerRef = useRef<AbortController>()
  const pollTimeoutRef = useRef<number>()
  const failureCountRef = useRef(0)
  const activeRequestRef = useRef(false)
  const performLoadRef = useRef<(backgroundRefresh: boolean) => Promise<void>>()
  const lastSuccessfulCollectionUrlRef = useRef<string>()

  const preparedMapItemsResult = useMemo(() => prepareItemsForMap(items), [items])
  const facetsResult = useMemo(() => inferFacets(items), [items])
  const statusEnabled = useMemo(() => hasStatusProperty(items), [items])
  const initialLoadError = useMemo(
    () => (items.length === 0 ? loadMessages.find((message) => message.level === 'error')?.message : undefined),
    [items.length, loadMessages],
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
      refreshIntervalSeconds,
    })
  }, [collectionUrl, filters, refreshIntervalSeconds])

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
    // Ignore the guard once the in-flight request has been aborted (e.g. by an
    // effect cleanup) — its signal flips synchronously, before the async
    // rejection reaches the finally block that would otherwise reset this ref.
    if (activeRequestRef.current && abortControllerRef.current?.signal.aborted !== true) {
      if (backgroundRefresh) {
        scheduleNextPoll(refreshIntervalSeconds)
      }
      return
    }

    const normalizedUrlResult = normalizeCollectionUrl(collectionUrl)
    if (!normalizedUrlResult.normalizedUrl) {
      setLoadMessages(normalizedUrlResult.messages)
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
        signal: abortController.signal,
      })

      if (abortController.signal.aborted) {
        return
      }
      failureCountRef.current = 0
      failureCountRef.current = 0
      failureCountRef.current = 0
      setItems(result.items)
      setCollectionUrl(result.collectionUrl)
      setCollectionInput(result.collectionUrl)
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
    } catch {
      if (abortController.signal.aborted) {
        return
      }

      setLoadMessages([
        {
          code: 'unexpected-error',
          level: 'error',
          message: 'Unable to load the collection. Please check the URL and try again.',
        },
      ])

      if (backgroundRefresh || items.length > 0) {
        failureCountRef.current += 1
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
  }, [collectionUrl, items.length, refreshIntervalSeconds, scheduleNextPoll])

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
        <div className="app-header-copy">
          <h1>WEED openEO processing status viewer</h1>
        </div>
        <form className="load-form" onSubmit={handleSubmit}>
          <label className="url-field">
            <span className="sr-only">STAC collection URL</span>
            <input
              type="url"
              value={collectionInput}
              onChange={(event) => setCollectionInput(event.target.value)}
              placeholder={EXAMPLE_COLLECTION_URL}
            />
          </label>
          <label className="refresh-field">
            <span className="sr-only">Refresh interval (s)</span>
            <input
              type="number"
              min={5}
              value={refreshIntervalSeconds}
              onChange={(event) => setRefreshIntervalSeconds(Math.max(5, Number(event.target.value) || 5))}
            />
            <span className="field-suffix">s</span>
          </label>
          <div className="form-actions">
            <button type="submit">Load collection</button>
            <button type="button" className="secondary-button" onClick={() => void performLoadRef.current?.(true)}>
              Refresh
            </button>
            {isRefreshing ? <span className="spinner-badge">Refreshing…</span> : null}
          </div>
          <div className="preset-row">
            {recentUrls.length > 0 ? (
              <details className="recent-urls">
                <summary>Recent</summary>
                <div className="recent-urls-list">
                  {recentUrls.map((url) => (
                    <button key={url} type="button" className="text-button" onClick={() => setCollectionInput(url)}>
                      {url}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
          {initialLoadError ? (
            <p className="load-feedback" role="alert">
              {initialLoadError}
            </p>
          ) : null}
        </form>
      </header>

      <main className="map-page">
        <div className="map-wrapper">
          <MapView
            collectionUrl={collectionUrl}
            facets={facetsResult.facets}
            filters={filters}
            items={preparedMapItemsResult.items}
            onSelect={(item) => {
              setSelectedItem(item)
              if (item) {
                setDetailsCollapsed(false)
              }
            }}
            statusEnabled={statusEnabled}
          />
          {isInitialLoading ? <div className="map-overlay">Loading collection…</div> : null}

          <div className="map-overlay-column left-column">
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
              onToggleCollapse={() => setFiltersCollapsed((value) => !value)}
              panelCollapsed={filtersCollapsed}
              showingCount={showingCount}
              sparseFields={facetsResult.sparseFields}
              totalCount={items.length}
            />
          </div>

          <div className="map-overlay-column right-column">
            <StatusLegend
              counts={statusCounts}
              disabled={!statusEnabled}
              onToggle={(status) => toggleEnumFilter('status', status)}
              selectedValues={filters.enums.status ?? []}
            />
            {selectedItem ? (
              <DetailsPanel
                item={selectedItem.item}
                itemKey={selectedItem.key}
                onClear={() => setSelectedItem(undefined)}
                onToggleCollapse={() => setDetailsCollapsed((value) => !value)}
                panelCollapsed={detailsCollapsed}
                selfHref={selectedItem.selfHref}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
