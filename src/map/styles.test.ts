import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import { describe, expect, it } from 'vitest'
import { createFeatureFromPreparedItem } from './features'
import { prepareItem } from './diff'
import { getFeatureStyle, TILE_ID_LABEL_MAX_RESOLUTION } from './styles'

describe('getFeatureStyle', () => {
  it('renders tile id labels inside non-rectangular polygon features', () => {
    const feature = createFeatureFromPreparedItem({
      ...prepareItem(
        {
          id: 'job-1',
          properties: {
            TileID: '31UFS',
          },
          type: 'Feature',
        },
        0,
      ),
      geometry: new Polygon([
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ]),
    })

    const styles = getFeatureStyle(feature, true, 100)

    expect(Array.isArray(styles)).toBe(true)
    if (!Array.isArray(styles)) {
      throw new Error('Expected tile ID label styles to be returned')
    }

    expect(styles).toHaveLength(2)
    expect(styles[1].getText()?.getText()).toBe('31UFS')

    const labelGeometry = styles[1].getGeometryFunction()?.(feature)
    expect(labelGeometry).toBeInstanceOf(Point)

    const coordinates = (labelGeometry as Point).getCoordinates()
    expect(coordinates).not.toEqual([5, 5])
    expect(feature.getGeometry()?.containsXY(coordinates[0], coordinates[1])).toBe(true)
  })

  it('hides tile id labels when zoomed too far out', () => {
    const feature = createFeatureFromPreparedItem({
      ...prepareItem(
        {
          id: 'job-1',
          properties: {
            tileID: '31UFS',
          },
          type: 'Feature',
        },
        0,
      ),
      geometry: new Point([4, 5]),
    })

    const styles = getFeatureStyle(feature, true, 1000)

    expect(Array.isArray(styles)).toBe(false)
  })

  it('keeps tile id labels visible at the zoom threshold boundary', () => {
    const feature = createFeatureFromPreparedItem({
      ...prepareItem(
        {
          id: 'job-1',
          properties: {
            tileID: '31UFS',
          },
          type: 'Feature',
        },
        0,
      ),
      geometry: new Point([4, 5]),
    })

    const styles = getFeatureStyle(feature, true, TILE_ID_LABEL_MAX_RESOLUTION)

    expect(Array.isArray(styles)).toBe(true)
  })
})
