import { describe, expect, it } from 'vitest'
import { createEmptyFilters } from '../state/hash'
import { evaluateItemAgainstFilters, inferFacets } from './facets'
import type { StacItem } from './types'

const items: StacItem[] = [
  {
    id: 'job-1',
    properties: {
      created: '2024-01-01T00:00:00Z',
      cpu: 1,
      status: 'queued',
      tileID: '31UFS',
    },
    type: 'Feature',
  },
  {
    id: 'job-2',
    properties: {
      created: '2024-01-02T00:00:00Z',
      cpu: 3,
      status: 'running',
      tileID: '31UFS',
    },
    type: 'Feature',
  },
  {
    id: 'job-3',
    properties: {
      created: '2024-01-03T00:00:00Z',
      cpu: 5,
      status: 'finished',
      tileID: '32TMT',
    },
    type: 'Feature',
  },
]

describe('inferFacets', () => {
  it('infers enum, number, and datetime facets in the expected order', () => {
    const result = inferFacets(items)

    expect(result.facets.map((facet) => facet.field)).toEqual(['status', 'created', 'cpu', 'tileID'])
    expect(result.facets.find((facet) => facet.field === 'status')?.kind).toBe('enum')
    expect(result.facets.find((facet) => facet.field === 'created')?.kind).toBe('datetime')
    expect(result.facets.find((facet) => facet.field === 'cpu')?.kind).toBe('number')
  })
})

describe('evaluateItemAgainstFilters', () => {
  it('combines enum and date filters with AND logic', () => {
    const facets = inferFacets(items).facets
    const filters = createEmptyFilters()
    filters.enums.status = ['running']
    filters.dates.created = { from: '2024-01-02T00:00:00Z', to: '2024-01-02T23:59:59Z' }

    expect(evaluateItemAgainstFilters(items[0], filters, facets)).toBe(false)
    expect(evaluateItemAgainstFilters(items[1], filters, facets)).toBe(true)
    expect(evaluateItemAgainstFilters(items[2], filters, facets)).toBe(false)
  })
})
