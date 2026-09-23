import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import type Geometry from 'ol/geom/Geometry'
import type { GeometryObject } from 'geojson'
import { prepareItem, type PreparedItem } from './diff'
import { createRepresentativePoint } from './labelGeometry'
import type { StacGeometry, StacItem } from '../stac/types'

const geoJsonFormat = new GeoJSON()

export const FEATURE_FINGERPRINT_PROPERTY = 'fingerprint'
export const FEATURE_ITEM_KEY_PROPERTY = 'itemKey'
export const FEATURE_STAC_ITEM_PROPERTY = 'stacItem'
export const FEATURE_STATUS_PROPERTY = 'status'
export const FEATURE_NORMALIZED_STATUS_PROPERTY = 'normalizedStatus'
export const FEATURE_SELF_HREF_PROPERTY = 'selfHref'
export const FEATURE_TILE_ID_PROPERTY = 'tileId'
export const FEATURE_TILE_ID_LABEL_GEOMETRY_PROPERTY = 'tileIdLabelGeometry'
export const FEATURE_VISIBLE_PROPERTY = 'visible'
export const FEATURE_HOVERED_PROPERTY = 'hovered'

export interface PreparedMapItem extends PreparedItem {
  geometry: Geometry
}

export interface MapPreparationSummary {
  invalidLonLatCount: number
  missingGeometryCount: number
  missingIdCount: number
}

export interface PreparedMapItemsResult {
  items: PreparedMapItem[]
  summary: MapPreparationSummary
}

function bboxToPolygon(bbox: number[] | undefined): StacGeometry | undefined {
  if (!bbox || bbox.length < 4) {
    return undefined
  }

  const [minX, minY, maxX, maxY] = bbox

  if (
    minX === undefined ||
    minY === undefined ||
    maxX === undefined ||
    maxY === undefined ||
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return undefined
  }

  return {
    type: 'Polygon',
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ],
    ],
  }
}

function flattenCoordinates(geometry: StacGeometry): number[][] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates]
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates
    case 'Polygon':
      return geometry.coordinates.flat()
    case 'MultiPolygon':
      return geometry.coordinates.flat(2)
  }
}

export function geometryHasOutOfRangeLonLat(geometry: StacGeometry): boolean {
  return flattenCoordinates(geometry).some(([longitude, latitude]) => {
    if (longitude === undefined || latitude === undefined) {
      return false
    }

    return longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90
  })
}

function createGeometry(item: StacItem): Geometry | undefined {
  const geometry = item.geometry ?? bboxToPolygon(item.bbox)

  if (!geometry) {
    return undefined
  }

  return geoJsonFormat.readGeometry(geometry as GeometryObject, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })
}

export function prepareItemsForMap(items: StacItem[]): PreparedMapItemsResult {
  const summary: MapPreparationSummary = {
    invalidLonLatCount: 0,
    missingGeometryCount: 0,
    missingIdCount: 0,
  }

  const preparedItems: PreparedMapItem[] = []

  items.forEach((item, index) => {
    const preparedItem = prepareItem(item, index)

    if (preparedItem.hadFallbackId) {
      summary.missingIdCount += 1
    }

    const sourceGeometry = item.geometry ?? bboxToPolygon(item.bbox)
    if (!sourceGeometry) {
      summary.missingGeometryCount += 1
      return
    }

    if (geometryHasOutOfRangeLonLat(sourceGeometry)) {
      summary.invalidLonLatCount += 1
    }

    const geometry = createGeometry(item)
    if (!geometry) {
      summary.missingGeometryCount += 1
      return
    }

    preparedItems.push({
      ...preparedItem,
      geometry,
    })
  })

  return {
    items: preparedItems,
    summary,
  }
}

export function createFeatureFromPreparedItem(item: PreparedMapItem): Feature<Geometry> {
  const feature = new Feature<Geometry>({
    geometry: item.geometry,
  })

  applyPreparedItemToFeature(feature, item)
  feature.set(FEATURE_VISIBLE_PROPERTY, true)
  feature.set(FEATURE_HOVERED_PROPERTY, false)
  return feature
}

export function applyPreparedItemToFeature(
  feature: Feature<Geometry>,
  item: PreparedMapItem,
): void {
  feature.setId(item.key)
  feature.setGeometry(item.geometry)
  feature.setProperties(
    {
      [FEATURE_FINGERPRINT_PROPERTY]: item.fingerprint,
      [FEATURE_ITEM_KEY_PROPERTY]: item.key,
      [FEATURE_NORMALIZED_STATUS_PROPERTY]: item.normalizedStatus,
      [FEATURE_SELF_HREF_PROPERTY]: item.selfHref,
      [FEATURE_STAC_ITEM_PROPERTY]: item.item,
      [FEATURE_STATUS_PROPERTY]: item.rawStatus,
      [FEATURE_TILE_ID_PROPERTY]: item.tileId,
      [FEATURE_TILE_ID_LABEL_GEOMETRY_PROPERTY]: createRepresentativePoint(item.geometry),
    },
    false,
  )
}
