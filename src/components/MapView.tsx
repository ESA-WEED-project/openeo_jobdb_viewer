import { useEffect, useMemo, useRef } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import Feature from 'ol/Feature'
import { defaults as defaultControls } from 'ol/control'
import type Geometry from 'ol/geom/Geometry'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { diffPreparedItems } from '../map/diff'
import {
  applyPreparedItemToFeature,
  createFeatureFromPreparedItem,
  FEATURE_HOVERED_PROPERTY,
  FEATURE_ITEM_KEY_PROPERTY,
  FEATURE_SELF_HREF_PROPERTY,
  FEATURE_STAC_ITEM_PROPERTY,
  FEATURE_VISIBLE_PROPERTY,
  type PreparedMapItem,
} from '../map/features'
import { getFeatureStyle } from '../map/styles'
import { evaluateItemAgainstFilters, type FacetDefinition } from '../stac/facets'
import type { AppFilters } from '../state/types'
import type { StacItem } from '../stac/types'
import 'ol/ol.css'

interface MapViewProps {
  collectionUrl: string
  facets: FacetDefinition[]
  filters: AppFilters
  items: PreparedMapItem[]
  onSelect: (item?: { item: StacItem; key: string; selfHref?: string }) => void
  statusEnabled: boolean
}

export function MapView({
  collectionUrl,
  facets,
  filters,
  items,
  onSelect,
  statusEnabled,
}: MapViewProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OlMap | null>(null)
  const vectorSourceRef = useRef<VectorSource<Feature<Geometry>> | null>(null)
  const hoveredFeatureRef = useRef<Feature<Geometry> | null>(null)
  const featureByKeyRef = useRef(new Map<string, Feature<Geometry>>())
  const preparedItemsByKeyRef = useRef(new Map<string, PreparedMapItem>())
  const fittedCollectionUrlRef = useRef<string>()
  const onSelectRef = useRef(onSelect)
  const statusEnabledRef = useRef(statusEnabled)

  const itemsByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    statusEnabledRef.current = statusEnabled
  }, [statusEnabled])

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return
    }

    const vectorSource = new VectorSource<Feature<Geometry>>()
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) =>
        getFeatureStyle(feature as Feature<Geometry>, statusEnabledRef.current),
    })

    const map = new OlMap({
      controls: defaultControls(),
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      target: mapElementRef.current,
      view: new View({
        center: fromLonLat([4.35, 50.85]),
        zoom: 3,
      }),
    })

    vectorSourceRef.current = vectorSource
    mapRef.current = map

    map.on('click', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (candidate) => candidate) as
        | Feature<Geometry>
        | undefined

      if (!feature) {
        onSelectRef.current(undefined)
        return
      }

      const item = feature.get(FEATURE_STAC_ITEM_PROPERTY) as StacItem | undefined
      const key = feature.get(FEATURE_ITEM_KEY_PROPERTY) as string | undefined
      const selfHref = feature.get(FEATURE_SELF_HREF_PROPERTY) as string | undefined

      if (item && key) {
        onSelectRef.current(selfHref ? { item, key, selfHref } : { item, key })
      }
    })

    map.on('pointermove', (event) => {
      if (!mapRef.current) {
        return
      }

      const nextHoveredFeature = map.forEachFeatureAtPixel(event.pixel, (candidate) => candidate) as
        | Feature<Geometry>
        | undefined

      if (hoveredFeatureRef.current && hoveredFeatureRef.current !== nextHoveredFeature) {
        hoveredFeatureRef.current.set(FEATURE_HOVERED_PROPERTY, false)
        hoveredFeatureRef.current.changed()
      }

      if (nextHoveredFeature && hoveredFeatureRef.current !== nextHoveredFeature) {
        nextHoveredFeature.set(FEATURE_HOVERED_PROPERTY, true)
        nextHoveredFeature.changed()
      }

      hoveredFeatureRef.current = nextHoveredFeature ?? null
      const target = map.getTargetElement()
      target.style.cursor = nextHoveredFeature ? 'pointer' : ''
    })

    return () => {
      map.setTarget(undefined)
      mapRef.current = null
      vectorSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    const vectorSource = vectorSourceRef.current
    const map = mapRef.current
    if (!vectorSource || !map) {
      return
    }

    const currentItems = preparedItemsByKeyRef.current
    const diff = diffPreparedItems(currentItems, items)

    if (diff.removed.length > 0) {
      for (const removedKey of diff.removed) {
        const feature = featureByKeyRef.current.get(removedKey)
        if (feature) {
          if (hoveredFeatureRef.current === feature) {
            hoveredFeatureRef.current = null
          }
          vectorSource.removeFeature(feature)
          featureByKeyRef.current.delete(removedKey)
        }
      }
    }

    if (diff.added.length > 0) {
      const features = diff.added.map((item) => {
        const feature = createFeatureFromPreparedItem(item)
        featureByKeyRef.current.set(item.key, feature)
        return feature
      })
      vectorSource.addFeatures(features)
    }

    if (diff.updated.length > 0) {
      diff.updated.forEach((item) => {
        const feature = featureByKeyRef.current.get(item.key)
        const nextItem = itemsByKey.get(item.key)
        if (feature && nextItem) {
          applyPreparedItemToFeature(feature, nextItem)
          feature.changed()
        }
      })
    }

    preparedItemsByKeyRef.current = new Map(items.map((item) => [item.key, item]))

    if (items.length > 0 && fittedCollectionUrlRef.current !== collectionUrl) {
      const extent = vectorSource.getExtent()
      if (extent) {
        map.getView().fit(extent, {
          duration: 250,
          maxZoom: 12,
          padding: [32, 32, 32, 32],
        })
        fittedCollectionUrlRef.current = collectionUrl
      }
    }
  }, [collectionUrl, items, itemsByKey])

  useEffect(() => {
    featureByKeyRef.current.forEach((feature, key) => {
      const item = itemsByKey.get(key)
      if (!item) {
        return
      }

      feature.set(FEATURE_VISIBLE_PROPERTY, evaluateItemAgainstFilters(item.item, filters, facets))
      feature.changed()
    })
  }, [facets, filters, itemsByKey])

  useEffect(() => {
    featureByKeyRef.current.forEach((feature) => feature.changed())
  }, [statusEnabled])

  return (
    <section className="map-panel" aria-label="Interactive job map">
      <div ref={mapElementRef} className="map-canvas" />
    </section>
  )
}
