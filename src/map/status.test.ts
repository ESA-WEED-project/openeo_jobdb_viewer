import { describe, expect, it } from 'vitest'
import { getStatusColor, normalizeStatusValue } from './status'

describe('normalizeStatusValue', () => {
  it('preserves requested status keywords', () => {
    expect(normalizeStatusValue('Downloading')).toBe('downloading')
    expect(normalizeStatusValue('Error_openeo')).toBe('error_openeo')
    expect(normalizeStatusValue('Finished')).toBe('finished')
    expect(normalizeStatusValue('Not_started')).toBe('not_started')
    expect(normalizeStatusValue('Running')).toBe('running')
    expect(normalizeStatusValue('Queued_for_start')).toBe('queued_for_start')
  })
})

describe('getStatusColor', () => {
  it('uses the requested legend colors for known statuses', () => {
    expect(getStatusColor('Downloading', true)).toBe('#86efac')
    expect(getStatusColor('Error_openeo', true)).toBe('#dc2626')
    expect(getStatusColor('Finished', true)).toBe('#166534')
    expect(getStatusColor('Not_started', true)).toBe('#a16207')
    expect(getStatusColor('Running', true)).toBe('#1e3a8a')
    expect(getStatusColor('Queued_for_start', true)).toBe('#7dd3fc')
  })
})
