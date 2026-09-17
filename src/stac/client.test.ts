import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCollectionItems } from './client'

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadCollectionItems', () => {
  it('follows relative next links and falls back to features.length when numberReturned is absent', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'jobs',
          links: [],
          type: 'Collection',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          features: [
            {
              id: 'job-1',
              properties: {
                status: 'queued',
              },
              type: 'Feature',
            },
          ],
          links: [{ href: '?cursor=2', rel: 'next' }],
          type: 'FeatureCollection',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          features: [
            {
              id: 'job-2',
              properties: {
                status: 'running',
              },
              type: 'Feature',
            },
          ],
          numReturned: 1,
          type: 'FeatureCollection',
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await loadCollectionItems({
      collectionUrl: 'https://example.test/collections/jobs',
      signal: new AbortController().signal,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.test/collections/jobs/items?limit=500',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://example.test/collections/jobs/items?cursor=2',
      expect.any(Object),
    )
    expect(result.items.map((item) => item.id)).toEqual(['job-1', 'job-2'])
    expect(result.totalReturned).toBe(2)
    expect(result.pageCount).toBe(2)
  })

  it('keeps fetching until pagination ends', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'jobs',
          links: [],
          type: 'Collection',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          features: [
            {
              id: 'job-1',
              properties: {},
              type: 'Feature',
            },
          ],
          links: [{ href: '?cursor=2', rel: 'next' }],
          type: 'FeatureCollection',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          features: [
            {
              id: 'job-2',
              properties: {},
              type: 'Feature',
            },
          ],
          type: 'FeatureCollection',
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await loadCollectionItems({
      collectionUrl: 'https://example.test/collections/jobs',
      signal: new AbortController().signal,
    })

    expect(result.pageCount).toBe(2)
    expect(result.items.map((item) => item.id)).toEqual(['job-1', 'job-2'])
  })
})
