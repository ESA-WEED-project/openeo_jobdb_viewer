import type Feature from 'ol/Feature'
import { getCenter } from 'ol/extent'
import type Geometry from 'ol/geom/Geometry'
import LineString from 'ol/geom/LineString'
import MultiLineString from 'ol/geom/MultiLineString'
import MultiPoint from 'ol/geom/MultiPoint'
import MultiPolygon from 'ol/geom/MultiPolygon'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import CircleStyle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import Text from 'ol/style/Text'
import {
  FEATURE_HOVERED_PROPERTY,
  FEATURE_NORMALIZED_STATUS_PROPERTY,
  FEATURE_STATUS_PROPERTY,
  FEATURE_TILE_ID_PROPERTY,
  FEATURE_VISIBLE_PROPERTY,
} from './features'
import { getStatusColor, NEUTRAL_STATUS_KEY } from './status'

const baseStyleCache = new Map<string, Style>()
const hoverStyleCache = new Map<string, Style>()
const tileIdLabelStyleCache = new Map<string, Style>()
const TILE_ID_LABEL_MAX_RESOLUTION = 320

function hexToRgba(hexColor: string, alpha: number): string {
  const normalizedColor = hexColor.replace('#', '')
  const paddedColor = normalizedColor.length === 3
    ? normalizedColor
        .split('')
        .map((entry) => `${entry}${entry}`)
        .join('')
    : normalizedColor

  const red = Number.parseInt(paddedColor.slice(0, 2), 16)
  const green = Number.parseInt(paddedColor.slice(2, 4), 16)
  const blue = Number.parseInt(paddedColor.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function createStyle(color: string, hovered: boolean): Style {
  return new Style({
    fill: new Fill({
      color: hexToRgba(color, hovered ? 0.34 : 0.2),
    }),
    stroke: new Stroke({
      color,
      width: hovered ? 3 : 2,
    }),
    image: new CircleStyle({
      radius: hovered ? 7 : 5,
      fill: new Fill({ color }),
      stroke: new Stroke({
        color: '#ffffff',
        width: 1,
      }),
    }),
  })
}

function findClosestPointToExtentCenter(points: Point[], geometry: Geometry): Point | undefined {
  const [centerX, centerY] = getCenter(geometry.getExtent())

  return points.reduce<Point | undefined>((closestPoint, candidatePoint) => {
    if (!closestPoint) {
      return candidatePoint
    }

    const [closestX, closestY] = closestPoint.getCoordinates()
    const [candidateX, candidateY] = candidatePoint.getCoordinates()
    const closestDistance = (closestX - centerX) ** 2 + (closestY - centerY) ** 2
    const candidateDistance = (candidateX - centerX) ** 2 + (candidateY - centerY) ** 2
    return candidateDistance < closestDistance ? candidatePoint : closestPoint
  }, undefined)
}

function createRepresentativePoint(geometry: Geometry): Point {
  if (geometry instanceof Point) {
    return geometry
  }

  if (geometry instanceof Polygon) {
    return geometry.getInteriorPoint()
  }

  if (geometry instanceof MultiPolygon) {
    return (
      findClosestPointToExtentCenter(geometry.getInteriorPoints().getPoints(), geometry) ??
      new Point(getCenter(geometry.getExtent()))
    )
  }

  if (geometry instanceof LineString) {
    return new Point(geometry.getCoordinateAt(0.5))
  }

  if (geometry instanceof MultiLineString) {
    const line = geometry.getLineString(0)
    return line ? new Point(line.getCoordinateAt(0.5)) : new Point(getCenter(geometry.getExtent()))
  }

  if (geometry instanceof MultiPoint) {
    return (
      findClosestPointToExtentCenter(geometry.getPoints(), geometry) ??
      new Point(getCenter(geometry.getExtent()))
    )
  }

  return new Point(getCenter(geometry.getExtent()))
}

function createTileIdLabelStyle(label: string): Style {
  return new Style({
    geometry: (feature) => {
      const geometry = feature.getGeometry()
      return geometry ? createRepresentativePoint(geometry) : undefined
    },
    text: new Text({
      fill: new Fill({
        color: '#111827',
      }),
      font: '600 12px sans-serif',
      overflow: true,
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.95)',
        width: 3,
      }),
      text: label,
      textAlign: 'center',
    }),
    zIndex: 10,
  })
}

function readStatusKey(feature: Feature<Geometry>, statusEnabled: boolean): string {
  if (!statusEnabled) {
    return NEUTRAL_STATUS_KEY
  }

  const normalizedStatus = feature.get(FEATURE_NORMALIZED_STATUS_PROPERTY)
  if (typeof normalizedStatus === 'string' && normalizedStatus.length > 0) {
    return normalizedStatus
  }

  const rawStatus = feature.get(FEATURE_STATUS_PROPERTY)
  return typeof rawStatus === 'string' && rawStatus.length > 0 ? rawStatus : NEUTRAL_STATUS_KEY
}

function readTileId(feature: Feature<Geometry>): string | undefined {
  const rawTileId = feature.get(FEATURE_TILE_ID_PROPERTY)
  return typeof rawTileId === 'string' && rawTileId.length > 0 ? rawTileId : undefined
}

export function getFeatureStyle(
  feature: Feature<Geometry>,
  statusEnabled: boolean,
  resolution = 0,
): Style | Style[] {
  if (feature.get(FEATURE_VISIBLE_PROPERTY) === false) {
    return []
  }

  const hovered = feature.get(FEATURE_HOVERED_PROPERTY) === true
  const statusKey = readStatusKey(feature, statusEnabled)
  const cache = hovered ? hoverStyleCache : baseStyleCache
  const baseStyle = cache.get(statusKey) ?? createStyle(getStatusColor(statusKey, statusEnabled), hovered)
  if (!cache.has(statusKey)) {
    cache.set(statusKey, baseStyle)
  }

  const tileId = readTileId(feature)
  if (!tileId || resolution > TILE_ID_LABEL_MAX_RESOLUTION) {
    return baseStyle
  }

  const labelStyle =
    tileIdLabelStyleCache.get(tileId) ??
    (() => {
      const style = createTileIdLabelStyle(tileId)
      tileIdLabelStyleCache.set(tileId, style)
      return style
    })()
  return [baseStyle, labelStyle]
}
