export const NEUTRAL_STATUS_KEY = '__neutral__'
export const NEUTRAL_STATUS_COLOR = '#5f6f8a'

const KNOWN_STATUS_COLORS: Record<string, string> = {
  created: '#7b8794',
  queued: '#8f63c7',
  running: '#1f78b4',
  downloading: '#0ea5a4',
  finished: '#2e8b57',
  failed: '#d14343',
  cancelled: '#f08a24',
  skipped: '#8c6d4f',
}

export function normalizeStatusValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue.length === 0) {
    return undefined
  }

  switch (normalizedValue) {
    case 'finished':
    case 'succeeded':
      return 'finished'
    case 'error':
    case 'failed':
      return 'failed'
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    case 'created':
    case 'queued':
    case 'running':
    case 'downloading':
    case 'skipped':
      return normalizedValue
    default:
      return normalizedValue
  }
}

function hashStatus(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const hueSegment = hue / 60
  const x = chroma * (1 - Math.abs((hueSegment % 2) - 1))

  let red = 0
  let green = 0
  let blue = 0

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma
    green = x
  } else if (hueSegment < 2) {
    red = x
    green = chroma
  } else if (hueSegment < 3) {
    green = chroma
    blue = x
  } else if (hueSegment < 4) {
    green = x
    blue = chroma
  } else if (hueSegment < 5) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  const match = l - chroma / 2
  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

export function getStatusColor(status: string | undefined, statusEnabled: boolean): string {
  if (!statusEnabled || !status) {
    return NEUTRAL_STATUS_COLOR
  }

  const normalizedStatus = normalizeStatusValue(status)
  if (!normalizedStatus) {
    return NEUTRAL_STATUS_COLOR
  }

  const knownColor = KNOWN_STATUS_COLORS[normalizedStatus]
  if (knownColor) {
    return knownColor
  }

  const hash = hashStatus(normalizedStatus)
  const hue = hash % 360
  const saturation = 55 + (hash % 20)
  const lightness = 42 + (hash % 12)
  return hslToHex(hue, saturation, lightness)
}

export function formatStatusLabel(status: string): string {
  const normalizedStatus = normalizeStatusValue(status)
  if (!normalizedStatus) {
    return 'Unknown'
  }

  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
}
