import type { ValidationMessage } from '../state/types'
import type { ItemCollectionResponse, StacCollection, StacItem } from './types'

export interface NormalizeCollectionUrlResult {
  messages: ValidationMessage[]
  normalizedUrl?: string
}

export interface LoadCollectionItemsOptions {
  collectionUrl: string
  signal: AbortSignal
}

export interface LoadCollectionItemsResult {
  collection: StacCollection
  collectionUrl: string
  items: StacItem[]
  itemsUrl: string
  messages: ValidationMessage[]
  pageCount: number
  totalMatched?: number
  totalReturned?: number
}

const DEFAULT_ITEMS_PAGE_SIZE = 500

class ValidationError extends Error {
  constructor(public readonly validationMessage: ValidationMessage) {
    super(validationMessage.message)
    this.name = 'ValidationError'
  }
}

function createValidationError(code: string, message: string): ValidationError {
  return new ValidationError({
    code,
    level: 'error',
    message,
  })
}

function appendLimit(url: string, limit: number): string {
  const nextUrl = new URL(url)
  nextUrl.searchParams.set('limit', String(limit))
  return nextUrl.toString()
}

function readOptionalNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value) => typeof value === 'number' && Number.isFinite(value))
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false
  }

  return contentType.includes('application/json') || contentType.includes('+json')
}

async function fetchJsonObject<T extends object>(url: string, signal: AbortSignal): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal,
    })
  } catch (error) {
    if (signal.aborted) {
      throw error
    }

    if (error instanceof TypeError) {
      throw createValidationError(
        'cors',
        'The request failed before the app received an HTTP response. On static deployments the most likely cause is missing CORS headers: the catalogue did not return an Access-Control-Allow-Origin header allowing this origin. This can also be caused by network, DNS, or offline failures.',
      )
    }

    throw error
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw createValidationError('http-404', `The catalogue responded with 404 Not Found for ${url}.`)
    }

    if (response.status === 401 || response.status === 403) {
      throw createValidationError(
        'http-auth',
        'The catalogue requires authentication or forbids access (401/403). A static GitHub Pages app cannot fix this client-side.',
      )
    }

    if (response.status >= 500) {
      throw createValidationError(
        'http-server',
        `The catalogue server returned ${response.status}. Please try again later or contact the catalogue operator.`,
      )
    }

    throw createValidationError(
      'http-error',
      `The catalogue request failed with HTTP ${response.status} ${response.statusText}.`,
    )
  }

  const contentType = response.headers.get('content-type')
  if (!isJsonContentType(contentType)) {
    throw createValidationError(
      'non-json',
      `The catalogue returned a non-JSON response (${contentType ?? 'unknown content type'}).`,
    )
  }

  const responseBody = (await response.json()) as unknown
  if (typeof responseBody !== 'object' || responseBody === null || Array.isArray(responseBody)) {
    throw createValidationError('invalid-json-shape', 'The catalogue returned JSON, but not a JSON object.')
  }

  return responseBody as T
}

function resolveItemsUrl(collectionUrl: string, collection: StacCollection): string {
  const itemsLink = collection.links?.find((link) => link.rel === 'items' && typeof link.href === 'string')
  return itemsLink ? new URL(itemsLink.href, collectionUrl).toString() : `${collectionUrl}/items`
}

function collectionHasStacShape(collection: StacCollection): boolean {
  if (collection.type === 'Collection') {
    return true
  }

  return typeof collection.id === 'string' && Array.isArray(collection.links)
}

function validateCollection(collectionUrl: string, collection: StacCollection): string {
  if (!collectionHasStacShape(collection)) {
    throw createValidationError(
      'not-collection',
      'The URL returned JSON, but it does not look like a STAC Collection (expected type="Collection", or at least id plus links).',
    )
  }

  return resolveItemsUrl(collectionUrl, collection)
}

function readNextPageUrl(pageUrl: string, page: ItemCollectionResponse): string | undefined {
  const nextLink = page.links?.find((link) => link.rel === 'next' && typeof link.href === 'string')
  return nextLink?.href ? new URL(nextLink.href, pageUrl).toString() : undefined
}

export function normalizeCollectionUrl(rawUrl: string): NormalizeCollectionUrlResult {
  const messages: ValidationMessage[] = []
  const trimmedUrl = rawUrl.trim()

  if (trimmedUrl.length === 0) {
    return {
      messages: [
        {
          code: 'empty-url',
          level: 'error',
          message: 'Enter a STAC collection URL before loading data.',
        },
      ],
    }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmedUrl)
  } catch {
    return {
      messages: [
        {
          code: 'invalid-url',
          level: 'error',
          message: 'The URL must be an absolute http(s) URL.',
        },
      ],
    }
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      messages: [
        {
          code: 'invalid-protocol',
          level: 'error',
          message: 'The URL must use http or https.',
        },
      ],
    }
  }

  if (parsedUrl.pathname.endsWith('/items')) {
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/items$/, '')
    parsedUrl.search = ''
    messages.push({
      code: 'stripped-items',
      level: 'info',
      message: 'The pasted URL pointed at /items, so the app normalised it back to the collection URL.',
    })
  }

  const normalisedPath = parsedUrl.pathname.endsWith('/') && parsedUrl.pathname !== '/'
    ? parsedUrl.pathname.slice(0, -1)
    : parsedUrl.pathname

  if (normalisedPath !== parsedUrl.pathname) {
    messages.push({
      code: 'trimmed-trailing-slash',
      level: 'info',
      message: 'The trailing slash was removed from the collection URL.',
    })
    parsedUrl.pathname = normalisedPath
  }

  return {
    messages,
    normalizedUrl: parsedUrl.toString(),
  }
}

export async function loadCollectionItems(
  options: LoadCollectionItemsOptions,
): Promise<LoadCollectionItemsResult> {
  const normalisedUrlResult = normalizeCollectionUrl(options.collectionUrl)
  const normalizedUrl = normalisedUrlResult.normalizedUrl

  if (!normalizedUrl) {
    throw new ValidationError(normalisedUrlResult.messages[0])
  }

  const collection = await fetchJsonObject<StacCollection>(normalizedUrl, options.signal)
  const itemsUrl = validateCollection(normalizedUrl, collection)
  const messages = [...normalisedUrlResult.messages]

  if (collection.type !== 'Collection') {
    messages.push({
      code: 'missing-type',
      level: 'info',
      message: 'The collection omitted type="Collection", but it still exposed the expected STAC fields.',
    })
  }

  const items: StacItem[] = []
  let nextPageUrl: string | undefined = appendLimit(itemsUrl, DEFAULT_ITEMS_PAGE_SIZE)
  let pageCount = 0
  let totalMatched: number | undefined
  let totalReturned = 0

  while (nextPageUrl) {
    const page = await fetchJsonObject<ItemCollectionResponse>(nextPageUrl, options.signal)
    const features = Array.isArray(page.features) ? page.features : []

    items.push(...features)
    pageCount += 1
    totalMatched ??= readOptionalNumber(page.numberMatched, page.numMatched)
    totalReturned += readOptionalNumber(page.numberReturned, page.numReturned) ?? features.length

    nextPageUrl = readNextPageUrl(nextPageUrl, page)
    if (!nextPageUrl) {
      break
    }
  }

  return {
    collection,
    collectionUrl: normalizedUrl,
    items,
    itemsUrl,
    messages,
    pageCount,
    totalMatched,
    totalReturned,
  }
}
