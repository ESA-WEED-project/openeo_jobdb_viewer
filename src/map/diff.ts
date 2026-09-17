import { normalizeStatusValue } from './status'
import type { StacItem } from '../stac/types'

export interface PreparedItem {
  key: string
  fingerprint: string
  hadFallbackId: boolean
  item: StacItem
  normalizedStatus?: string
  rawStatus?: string
  selfHref?: string
}

export interface FeatureDiffResult {
  added: PreparedItem[]
  removed: string[]
  updated: PreparedItem[]
}

function stableStringifyObject(value: object): string {
  const sortedEntries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return `{${sortedEntries
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`)
    .join(',')}}`
}

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  return stableStringifyObject(value as object)
}

function readRawStatus(item: StacItem): string | undefined {
  const rawStatus = item.properties.status

  if (
    rawStatus === undefined ||
    rawStatus === null ||
    typeof rawStatus === 'object' ||
    Array.isArray(rawStatus)
  ) {
    return undefined
  }

  return String(rawStatus)
}

function readSelfHref(item: StacItem): string | undefined {
  const selfLink = item.links?.find((link) => link.rel === 'self')
  return selfLink?.href
}

export function deriveItemKey(item: StacItem, index: number): { hadFallbackId: boolean; key: string } {
  const rawId = item.id

  if (rawId === undefined || rawId === null || String(rawId).trim().length === 0) {
    return {
      hadFallbackId: true,
      key: `__index_${index}`,
    }
  }

  return {
    hadFallbackId: false,
    key: String(rawId),
  }
}

export function createItemFingerprint(item: StacItem): string {
  return stableStringify({
    bbox: item.bbox,
    geometry: item.geometry,
    links: item.links,
    properties: item.properties,
    type: item.type,
  })
}

export function prepareItem(item: StacItem, index: number): PreparedItem {
  const { hadFallbackId, key } = deriveItemKey(item, index)
  const rawStatus = readRawStatus(item)

  return {
    key,
    fingerprint: createItemFingerprint(item),
    hadFallbackId,
    item,
    normalizedStatus: normalizeStatusValue(rawStatus),
    rawStatus,
    selfHref: readSelfHref(item),
  }
}

export function diffPreparedItems<T extends PreparedItem>(
  currentItems: Map<string, T>,
  nextItems: T[],
): { added: T[]; removed: string[]; updated: T[] } {
  const nextItemsByKey = new Map(nextItems.map((item) => [item.key, item]))
  const removed = [...currentItems.keys()].filter((key) => !nextItemsByKey.has(key))
  const added: T[] = []
  const updated: T[] = []

  for (const nextItem of nextItems) {
    const currentItem = currentItems.get(nextItem.key)

    if (!currentItem) {
      added.push(nextItem)
      continue
    }

    if (currentItem.fingerprint !== nextItem.fingerprint) {
      updated.push(nextItem)
    }
  }

  return {
    added,
    removed,
    updated,
  }
}
