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
      pageLimit: 10,
      pageSize: 500,
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

  it('honours pageLimit and warns when more pages are available', async () => {
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

    vi.stubGlobal('fetch', fetchMock)

    const result = await loadCollectionItems({
      collectionUrl: 'https://example.test/collections/jobs',
      pageLimit: 1,
      pageSize: 100,
      signal: new AbortController().signal,
    })

    expect(result.hitPageCap).toBe(true)
    expect(result.pageCount).toBe(1)
    expect(result.messages.some((message) => message.code === 'page-cap')).toBe(true)
  })
})
