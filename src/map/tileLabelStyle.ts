import Point from 'ol/geom/Point'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import Text from 'ol/style/Text'

export function createTileIdLabelStyle(label: string, geometry: Point): Style {
  return new Style({
    geometry,
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
