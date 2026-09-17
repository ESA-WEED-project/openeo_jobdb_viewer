export type ValidationLevel = 'error' | 'warning' | 'info'

export interface ValidationMessage {
  code: string
  level: ValidationLevel
  message: string
}

export type TriState = 'any' | 'true' | 'false'

export interface NumberRangeFilter {
  min?: number
  max?: number
}

export interface DateRangeFilter {
  from?: string
  to?: string
}

export interface AppFilters {
  enums: Record<string, string[]>
  texts: Record<string, string>
  numbers: Record<string, NumberRangeFilter>
  dates: Record<string, DateRangeFilter>
  booleans: Record<string, TriState>
}

export interface HashState {
  collectionUrl: string
  refreshIntervalSeconds: number
  filters: AppFilters
}
