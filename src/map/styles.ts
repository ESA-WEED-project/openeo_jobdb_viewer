import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import CircleStyle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import {
  FEATURE_HOVERED_PROPERTY,
  FEATURE_NORMALIZED_STATUS_PROPERTY,
  FEATURE_STATUS_PROPERTY,
  FEATURE_VISIBLE_PROPERTY,
} from './features'
import { getStatusColor, NEUTRAL_STATUS_KEY } from './status'

const baseStyleCache = new Map<string, Style>()
const hoverStyleCache = new Map<string, Style>()

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

export function getFeatureStyle(
  feature: Feature<Geometry>,
  statusEnabled: boolean,
): Style | Style[] {
  if (feature.get(FEATURE_VISIBLE_PROPERTY) === false) {
    return []
  }

  const hovered = feature.get(FEATURE_HOVERED_PROPERTY) === true
  const statusKey = readStatusKey(feature, statusEnabled)
  const cache = hovered ? hoverStyleCache : baseStyleCache
  const cachedStyle = cache.get(statusKey)

  if (cachedStyle) {
    return cachedStyle
  }

  const color = getStatusColor(statusKey, statusEnabled)
  const style = createStyle(color, hovered)
  cache.set(statusKey, style)
  return style
}
