export interface DashboardItem {
  type_id: number
  name: string
  isk: number
  usd: number
  share: number
  is_fixed_price: boolean
  fixed_region_ids: number[]
}

export interface DashboardItemScope {
  id: string
  label: string
  region_id: number | null
  item_count: number
  total_isk: number
  items: DashboardItem[]
}

export interface RegionOption {
  id: number
  name: string
}

export interface TrackedItemOption {
  id: number
  type_id: number
  name: string
  added_at: string
}

export interface DashboardOverview {
  default_item_scope_id: string
  first_date: string
  hub_labels: string[]
  hub_date_from: string | null
  hub_date_to: string | null
  hub_values_isk: number[]
  hub_values_usd: number[]
  item_date_from: string | null
  item_date_to: string | null
  item_scopes: DashboardItemScope[]
  last_date: string
  plex_isk: number
  regions: RegionOption[]
}

export interface DateRangeValue {
  from: string
  to: string
}

export interface MarketPriceResponse {
  dates: string[]
  values: number[]
  forecast_dates: string[]
  forecast_values: number[]
  slope: number
  r2: number
  is_fixed_price: boolean
}

export interface MarketForecastResponse {
  actual_dates: string[]
  actual_values: number[]
  forecast_dates: string[]
  forecast_values: number[]
  training_date_from: string | null
  training_date_to: string | null
  first_actual_date: string | null
  last_actual_date: string | null
  actual_data_point_count: number
  training_data_point_count: number
  slope: number
  r2: number
  is_fixed_price: boolean
}
