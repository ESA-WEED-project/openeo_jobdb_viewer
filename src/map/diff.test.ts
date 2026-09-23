import { describe, expect, it } from 'vitest'
import { diffPreparedItems, prepareItem } from './diff'
import type { StacItem } from '../stac/types'

function makeItem(id: string, status: string, updated: string): StacItem {
  return {
    id,
    properties: {
      status,
      updated,
    },
    type: 'Feature',
  }
}

describe('diffPreparedItems', () => {
  it('marks changed items with the same id as updated', () => {
    const currentItem = prepareItem(makeItem('job-1', 'running', '2024-01-01T00:00:00Z'), 0)
    const nextItem = prepareItem(makeItem('job-1', 'finished', '2024-01-02T00:00:00Z'), 0)

    const diff = diffPreparedItems(new Map([[currentItem.key, currentItem]]), [nextItem])

    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.updated.map((item) => item.key)).toEqual(['job-1'])
  })

  it('marks missing items for removal', () => {
    const currentItem = prepareItem(makeItem('job-1', 'running', '2024-01-01T00:00:00Z'), 0)

    const diff = diffPreparedItems(new Map([[currentItem.key, currentItem]]), [])

    expect(diff.added).toHaveLength(0)
    expect(diff.updated).toHaveLength(0)
    expect(diff.removed).toEqual(['job-1'])
  })

  it('extracts tile ids from supported metadata field variants', () => {
    const cases = [
      { expected: '31UFS', field: 'tileID' },
      { expected: '32TMT', field: 'tileid' },
      { expected: '33UVP', field: 'TileID' },
      { expected: '34UFA', field: 'Tileid' },
      { expected: '35UMB', field: 'tile_id' },
      { expected: '36UYC', field: 'tile_ID' },
    ] as const

    cases.forEach(({ expected, field }, index) => {
      expect(
        prepareItem(
          {
            id: `job-${index + 1}`,
            properties: {
              [field]: expected,
            },
            type: 'Feature',
          },
          index,
        ).tileId,
      ).toBe(expected)
    })
  })

  it('trims scalar tile ids and ignores empty or structured values', () => {
    expect(
      prepareItem(
        {
          id: 'job-trimmed',
          properties: {
            tileID: ' 31UFS ',
          },
          type: 'Feature',
        },
        0,
      ).tileId,
    ).toBe('31UFS')

    expect(
      prepareItem(
        {
          id: 'job-empty',
          properties: {
            tileID: '   ',
            tileid: '32TMT',
          },
          type: 'Feature',
        },
        0,
      ).tileId,
    ).toBe('32TMT')

    expect(
      prepareItem(
        {
          id: 'job-invalid',
          properties: {
            tileID: null,
            tileid: [],
            TileID: {},
          },
          type: 'Feature',
        },
        0,
      ).tileId,
    ).toBeUndefined()
  })
})
