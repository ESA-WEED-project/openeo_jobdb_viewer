export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

export interface JsonObject {
  [key: string]: JsonValue | undefined
}

export type Position = [number, number] | [number, number, number]

export interface PointGeometry {
  type: 'Point'
  coordinates: Position
}

export interface MultiPointGeometry {
  type: 'MultiPoint'
  coordinates: Position[]
}

export interface LineStringGeometry {
  type: 'LineString'
  coordinates: Position[]
}

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export type StacGeometry =
  | PointGeometry
  | MultiPointGeometry
  | LineStringGeometry
  | PolygonGeometry
  | MultiPolygonGeometry

export interface StacLink extends JsonObject {
  href: string
  rel?: string
  type?: string
  title?: string
}

export interface StacCollectionExtentSpatial extends JsonObject {
  bbox?: number[][]
}

export interface StacCollectionExtent extends JsonObject {
  spatial?: StacCollectionExtentSpatial
}

export interface StacCollection extends JsonObject {
  type?: string
  id?: string
  title?: string
  description?: string
  links?: StacLink[]
  extent?: StacCollectionExtent
}

export interface StacItem {
  type?: string
  id?: string | number
  bbox?: number[]
  geometry?: StacGeometry | null
  properties: Record<string, JsonValue | undefined>
  links?: StacLink[]
}

export interface ItemCollectionResponse {
  type?: string
  features?: StacItem[]
  links?: StacLink[]
  numberMatched?: number
  numMatched?: number
  numberReturned?: number
  numReturned?: number
}
