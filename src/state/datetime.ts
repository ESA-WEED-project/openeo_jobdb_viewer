export function formatUtcYearInput(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getUTCFullYear()
  return String(year)
}

export function parseUtcYearInput(value: string, boundary: 'start' | 'end'): string | undefined {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return undefined
  }

  if (!/^\d{4}$/.test(trimmedValue)) {
    return undefined
  }

  return boundary === 'start'
    ? `${trimmedValue}-01-01T00:00:00Z`
    : `${trimmedValue}-12-31T23:59:59Z`
}
