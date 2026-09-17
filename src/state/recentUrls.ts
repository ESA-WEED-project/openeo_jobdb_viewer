const RECENT_URLS_STORAGE_KEY = 'openeo-jobdb-viewer:recent-urls'
const MAX_RECENT_URLS = 6

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readRecentUrls(): string[] {
  if (!isLocalStorageAvailable()) {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_URLS_STORAGE_KEY)
    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue) as unknown
    return Array.isArray(parsedValue)
      ? parsedValue.filter((entry): entry is string => typeof entry === 'string')
      : []
  } catch {
    return []
  }
}

export function rememberRecentUrl(url: string): string[] {
  if (!isLocalStorageAvailable()) {
    return []
  }

  const trimmedUrl = url.trim()
  if (trimmedUrl.length === 0) {
    return readRecentUrls()
  }

  const nextUrls = [trimmedUrl, ...readRecentUrls().filter((entry) => entry !== trimmedUrl)].slice(
    0,
    MAX_RECENT_URLS,
  )

  window.localStorage.setItem(RECENT_URLS_STORAGE_KEY, JSON.stringify(nextUrls))
  return nextUrls
}
