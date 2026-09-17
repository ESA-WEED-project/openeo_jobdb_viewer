import type { AppFilters, DateRangeFilter, NumberRangeFilter, TriState } from '../state/types'
import type { JsonValue, StacItem } from './types'

export type FacetKind = 'enum' | 'text' | 'number' | 'datetime' | 'boolean'

export interface FacetValueCount {
  count: number
  value: string
}

interface BaseFacetDefinition {
  field: string
  kind: FacetKind
  presentCount: number
}

export interface EnumFacetDefinition extends BaseFacetDefinition {
  kind: 'enum'
  values: FacetValueCount[]
}

export interface TextFacetDefinition extends BaseFacetDefinition {
  kind: 'text'
}

export interface NumberFacetDefinition extends BaseFacetDefinition {
  kind: 'number'
  max: number
  min: number
}

export interface DateFacetDefinition extends BaseFacetDefinition {
  kind: 'datetime'
  max: string
  min: string
}

export interface BooleanFacetDefinition extends BaseFacetDefinition {
  kind: 'boolean'
  falseCount: number
  trueCount: number
}

export type FacetDefinition =
  | BooleanFacetDefinition
  | DateFacetDefinition
  | EnumFacetDefinition
  | NumberFacetDefinition
  | TextFacetDefinition

export interface FacetInferenceResult {
  facets: FacetDefinition[]
  sparseFields: string[]
}

interface FieldAccumulator {
  falseCount: number
  hasArrayOrObjectValue: boolean
  numericMax?: number
  numericMin?: number
  presentCount: number
  stringCounts: Map<string, number>
  stringValues: string[]
  trueCount: number
  types: Set<'boolean' | 'number' | 'string'>
}

function createFieldAccumulator(): FieldAccumulator {
  return {
    falseCount: 0,
    hasArrayOrObjectValue: false,
    presentCount: 0,
    stringCounts: new Map(),
    stringValues: [],
    trueCount: 0,
    types: new Set(),
  }
}

function isScalarString(value: JsonValue | undefined): value is string {
  return typeof value === 'string'
}

function isIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function facetSortOrder(field: string): number {
  if (field === 'status') {
    return 0
  }

  if (field === 'datetime') {
    return 1
  }

  if (field === 'created') {
    return 2
  }

  if (field === 'updated') {
    return 3
  }

  return 4
}

export function inferFacets(items: StacItem[]): FacetInferenceResult {
  if (items.length === 0) {
    return { facets: [], sparseFields: [] }
  }

  const fields = new Map<string, FieldAccumulator>()

  for (const item of items) {
    for (const [field, rawValue] of Object.entries(item.properties)) {
      const accumulator = fields.get(field) ?? createFieldAccumulator()
      fields.set(field, accumulator)

      if (rawValue === undefined || rawValue === null) {
        continue
      }

      accumulator.presentCount += 1

      if (Array.isArray(rawValue) || typeof rawValue === 'object') {
        accumulator.hasArrayOrObjectValue = true
        continue
      }

      if (typeof rawValue === 'string') {
        accumulator.types.add('string')
        accumulator.stringValues.push(rawValue)
        accumulator.stringCounts.set(rawValue, (accumulator.stringCounts.get(rawValue) ?? 0) + 1)
        continue
      }

      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        accumulator.types.add('number')
        accumulator.numericMin =
          accumulator.numericMin === undefined ? rawValue : Math.min(accumulator.numericMin, rawValue)
        accumulator.numericMax =
          accumulator.numericMax === undefined ? rawValue : Math.max(accumulator.numericMax, rawValue)
        continue
      }

      if (typeof rawValue === 'boolean') {
        accumulator.types.add('boolean')
        if (rawValue) {
          accumulator.trueCount += 1
        } else {
          accumulator.falseCount += 1
        }
      }
    }
  }

  const sparseFields: string[] = []
  const facets: FacetDefinition[] = []
  const presenceThreshold = Math.max(1, Math.ceil(items.length * 0.05))

  for (const [field, accumulator] of fields.entries()) {
    if (accumulator.presentCount < presenceThreshold) {
      sparseFields.push(field)
      continue
    }

    if (accumulator.hasArrayOrObjectValue) {
      continue
    }

    if (accumulator.types.size !== 1) {
      continue
    }

    if (accumulator.types.has('boolean')) {
      facets.push({
        field,
        kind: 'boolean',
        presentCount: accumulator.presentCount,
        falseCount: accumulator.falseCount,
        trueCount: accumulator.trueCount,
      })
      continue
    }

    if (accumulator.types.has('number')) {
      if (accumulator.numericMin === undefined || accumulator.numericMax === undefined) {
        continue
      }

      facets.push({
        field,
        kind: 'number',
        presentCount: accumulator.presentCount,
        max: accumulator.numericMax,
        min: accumulator.numericMin,
      })
      continue
    }

    if (accumulator.types.has('string')) {
      const allValuesLookLikeDates =
        accumulator.stringValues.length > 0 && accumulator.stringValues.every((value) => isIsoDateTime(value))

      if (allValuesLookLikeDates) {
        const sortedValues = [...accumulator.stringValues].sort((left, right) =>
          Date.parse(left) - Date.parse(right),
        )
        facets.push({
          field,
          kind: 'datetime',
          presentCount: accumulator.presentCount,
          max: sortedValues[sortedValues.length - 1],
          min: sortedValues[0],
        })
        continue
      }

      const distinctValues = [...accumulator.stringCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([value, count]) => ({ count, value }))

      facets.push({
        field,
        kind: distinctValues.length <= 25 ? 'enum' : 'text',
        presentCount: accumulator.presentCount,
        ...(distinctValues.length <= 25 ? { values: distinctValues } : {}),
      } as FacetDefinition)
    }
  }

  facets.sort((left, right) => {
    const orderDifference = facetSortOrder(left.field) - facetSortOrder(right.field)
    return orderDifference !== 0 ? orderDifference : left.field.localeCompare(right.field)
  })

  sparseFields.sort((left, right) => left.localeCompare(right))

  return { facets, sparseFields }
}

function readStringValue(item: StacItem, field: string): string | undefined {
  const rawValue = item.properties[field]
  if (rawValue === undefined || rawValue === null || Array.isArray(rawValue) || typeof rawValue === 'object') {
    return undefined
  }

  return String(rawValue)
}

function passesEnumFilter(item: StacItem, field: string, selectedValues: string[]): boolean {
  if (selectedValues.length === 0) {
    return true
  }

  const value = readStringValue(item, field)
  return value !== undefined ? selectedValues.includes(value) : false
}

function passesTextFilter(item: StacItem, field: string, query: string): boolean {
  if (query.trim().length === 0) {
    return true
  }

  const value = readStringValue(item, field)
  return value !== undefined ? value.toLowerCase().includes(query.trim().toLowerCase()) : false
}

function passesNumberFilter(item: StacItem, field: string, range: NumberRangeFilter): boolean {
  if (range.min === undefined && range.max === undefined) {
    return true
  }

  const rawValue = item.properties[field]
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return false
  }

  if (range.min !== undefined && rawValue < range.min) {
    return false
  }

  if (range.max !== undefined && rawValue > range.max) {
    return false
  }

  return true
}

function passesDateFilter(item: StacItem, field: string, range: DateRangeFilter): boolean {
  if (!range.from && !range.to) {
    return true
  }

  const rawValue = item.properties[field]
  if (!isScalarString(rawValue)) {
    return false
  }

  const timestamp = Date.parse(rawValue)
  if (!Number.isFinite(timestamp)) {
    return false
  }

  if (range.from) {
    const fromTimestamp = Date.parse(range.from)
    if (Number.isFinite(fromTimestamp) && timestamp < fromTimestamp) {
      return false
    }
  }

  if (range.to) {
    const toTimestamp = Date.parse(range.to)
    if (Number.isFinite(toTimestamp) && timestamp > toTimestamp) {
      return false
    }
  }

  return true
}

function passesBooleanFilter(item: StacItem, field: string, value: TriState): boolean {
  if (value === 'any') {
    return true
  }

  const rawValue = item.properties[field]
  if (typeof rawValue !== 'boolean') {
    return false
  }

  return value === 'true' ? rawValue : !rawValue
}

export function evaluateItemAgainstFilters(
  item: StacItem,
  filters: AppFilters,
  facets: FacetDefinition[],
  ignoredField?: string,
): boolean {
  for (const facet of facets) {
    if (facet.field === ignoredField) {
      continue
    }

    switch (facet.kind) {
      case 'enum': {
        const selectedValues = filters.enums[facet.field] ?? []
        if (!passesEnumFilter(item, facet.field, selectedValues)) {
          return false
        }
        break
      }
      case 'text': {
        const query = filters.texts[facet.field] ?? ''
        if (!passesTextFilter(item, facet.field, query)) {
          return false
        }
        break
      }
      case 'number': {
        const range = filters.numbers[facet.field] ?? {}
        if (!passesNumberFilter(item, facet.field, range)) {
          return false
        }
        break
      }
      case 'datetime': {
        const range = filters.dates[facet.field] ?? {}
        if (!passesDateFilter(item, facet.field, range)) {
          return false
        }
        break
      }
      case 'boolean': {
        const value = filters.booleans[facet.field] ?? 'any'
        if (!passesBooleanFilter(item, facet.field, value)) {
          return false
        }
        break
      }
    }
  }

  return true
}

export function countMatchingItems(
  items: StacItem[],
  filters: AppFilters,
  facets: FacetDefinition[],
): number {
  return items.filter((item) => evaluateItemAgainstFilters(item, filters, facets)).length
}

export function getEnumValueCounts(
  items: StacItem[],
  field: string,
  filters: AppFilters,
  facets: FacetDefinition[],
): FacetValueCount[] {
  const counts = new Map<string, number>()
  const selectedValues = filters.enums[field] ?? []

  for (const item of items) {
    if (!evaluateItemAgainstFilters(item, filters, facets, field)) {
      continue
    }

    const value = readStringValue(item, field)
    if (value !== undefined) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  for (const selectedValue of selectedValues) {
    if (!counts.has(selectedValue)) {
      counts.set(selectedValue, 0)
    }
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ count, value }))
}
