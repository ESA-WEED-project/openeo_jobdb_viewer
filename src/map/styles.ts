import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import Point from 'ol/geom/Point'
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
  FEATURE_TILE_ID_LABEL_GEOMETRY_PROPERTY,
  FEATURE_VISIBLE_PROPERTY,
} from './features'
import { getStatusColor, NEUTRAL_STATUS_KEY } from './status'

const baseStyleCache = new Map<string, Style>()
const hoverStyleCache = new Map<string, Style>()
const tileIdLabelStyleCache = new Map<string, Style>()
export const TILE_ID_LABEL_MAX_RESOLUTION = 320

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

function createTileIdLabelStyle(label: string): Style {
  return new Style({
    geometry: (feature) => {
      const labelGeometry = feature.get(FEATURE_TILE_ID_LABEL_GEOMETRY_PROPERTY)
      return labelGeometry instanceof Point ? labelGeometry : undefined
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
