import { describe, expect, it } from 'vitest'
import { formatUtcYearInput, parseUtcYearInput } from '../state/datetime'
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

  it('ignores removed fields and infers numeric-with-unit job metrics as number facets', () => {
    const result = inferFacets([
      {
        id: 'job-a',
        properties: {
          attempt: 1,
          bbox: 'ignored',
          cpu: '1 core',
          digitalId: 'weed-1',
          duration: '12 s',
          identifier: 'job-a',
          memory: '256 MB',
          nonEO_file: false,
          scenarioId: 'scenario-a',
          target_epsg: '3035',
          updated: '2024-01-01T00:00:00Z',
          year: 2024,
        },
        type: 'Feature',
      },
      {
        id: 'job-b',
        properties: {
          attempt: 2,
          bbox: 'ignored',
          cpu: '4 core',
          digitalId: 'weed-2',
          duration: '42 s',
          identifier: 'job-b',
          memory: '1024 MB',
          nonEO_file: true,
          scenarioId: 'scenario-b',
          target_epsg: '3035',
          updated: '2024-01-02T00:00:00Z',
          year: 2024,
        },
        type: 'Feature',
      },
    ])

    expect(result.facets.map((facet) => facet.field)).toEqual(['cpu', 'duration', 'memory'])
    expect(result.facets.every((facet) => facet.kind === 'number')).toBe(true)
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

  it('maps year-only date filters to UTC year boundaries', () => {
    const yearItems: StacItem[] = [
      {
        id: 'job-2023',
        properties: { created: '2023-12-31T23:59:59Z' },
        type: 'Feature',
      },
      {
        id: 'job-2024',
        properties: { created: '2024-06-01T12:00:00Z' },
        type: 'Feature',
      },
      {
        id: 'job-2025',
        properties: { created: '2025-01-01T00:00:00Z' },
        type: 'Feature',
      },
    ]

    const facets = inferFacets(yearItems).facets
    const filters = createEmptyFilters()
    const fromInput = formatUtcYearInput('2024-01-02T00:00:00Z')
    const toInput = formatUtcYearInput('2024-12-31T23:59:00Z')

    filters.dates.created = {
      from: parseUtcYearInput(fromInput, 'start'),
      to: parseUtcYearInput(toInput, 'end'),
    }

    expect(evaluateItemAgainstFilters(yearItems[0], filters, facets)).toBe(false)
    expect(evaluateItemAgainstFilters(yearItems[1], filters, facets)).toBe(true)
    expect(evaluateItemAgainstFilters(yearItems[2], filters, facets)).toBe(false)
  })

  it('filters cpu values expressed as number-plus-unit strings', () => {
    const metricItems: StacItem[] = [
      {
        id: 'job-1',
        properties: { cpu: '1 core' },
        type: 'Feature',
      },
      {
        id: 'job-2',
        properties: { cpu: '2 core' },
        type: 'Feature',
      },
      {
        id: 'job-3',
        properties: { cpu: '8 core' },
        type: 'Feature',
      },
    ]

    const facets = inferFacets(metricItems).facets
    const filters = createEmptyFilters()
    filters.numbers.cpu = { min: 2, max: 4 }

    expect(evaluateItemAgainstFilters(metricItems[0], filters, facets)).toBe(false)
    expect(evaluateItemAgainstFilters(metricItems[1], filters, facets)).toBe(true)
    expect(evaluateItemAgainstFilters(metricItems[2], filters, facets)).toBe(false)
  })

  it('normalizes mixed memory units before applying number filters', () => {
    const metricItems: StacItem[] = [
      {
        id: 'job-1',
        properties: { memory: '512 MB' },
        type: 'Feature',
      },
      {
        id: 'job-2',
        properties: { memory: '1 GB' },
        type: 'Feature',
      },
      {
        id: 'job-3',
        properties: { memory: '2 GiB' },
        type: 'Feature',
      },
    ]

    const facets = inferFacets(metricItems).facets
    const filters = createEmptyFilters()
    filters.numbers.memory = { min: 700, max: 1500 }

    expect(facets.find((facet) => facet.field === 'memory')).toMatchObject({
      kind: 'number',
      max: 2048,
      min: 512,
      unit: 'mb-seconds',
    })
    expect(evaluateItemAgainstFilters(metricItems[0], filters, facets)).toBe(false)
    expect(evaluateItemAgainstFilters(metricItems[1], filters, facets)).toBe(true)
    expect(evaluateItemAgainstFilters(metricItems[2], filters, facets)).toBe(false)
  })

  it('parses openEO usage-style memory values reported in mb-seconds', () => {
    const usageItems: StacItem[] = [
      {
        id: 'job-1',
        properties: { memory: '19291560 mb-seconds' },
        type: 'Feature',
      },
      {
        id: 'job-2',
        properties: { memory: '41926320 mb-seconds' },
        type: 'Feature',
      },
    ]

    const facets = inferFacets(usageItems).facets

    expect(facets.find((facet) => facet.field === 'memory')).toMatchObject({
      kind: 'number',
      max: 41926320,
      min: 19291560,
      unit: 'mb-seconds',
    })
  })

  it('keeps metric facets when bare numbers and number-plus-unit strings are mixed', () => {
    const result = inferFacets([
      {
        id: 'job-a',
        properties: { cpu: 1 },
        type: 'Feature',
      },
      {
        id: 'job-b',
        properties: { cpu: '2 core' },
        type: 'Feature',
      },
    ])

    expect(result.facets).toHaveLength(1)
    expect(result.facets[0]).toMatchObject({ field: 'cpu', kind: 'number', unit: 'core' })
  })
})
