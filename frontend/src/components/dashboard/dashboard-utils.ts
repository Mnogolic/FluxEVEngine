import type { DateRangeValue, MarketForecastResponse, MarketPriceResponse } from '@/types/dashboard'

export const DEFAULT_REGION_ID = 10000002
export const OTHER_SLICE_ID = 'other'
export const PIE_COLORS = [
  '#58a6ff',
  '#3fb950',
  '#f78166',
  '#d29922',
  '#a371f7',
  '#39c5cf',
  '#ff7b72',
  '#7ee787',
  '#ffa657',
  '#bc8cff',
  '#79c0ff',
  '#56d364',
  '#e3b341',
  '#db6d28',
  '#ff9bce',
  '#1f6feb',
  '#238636',
  '#da3633',
  '#9e6a03',
  '#8957e5',
  '#8b949e'
]

export const PLOT_CONFIG = {
  responsive: true,
  displayModeBar: false
}

const BASE_PIE_LAYOUT = {
  paper_bgcolor: '#161b22',
  plot_bgcolor: '#161b22',
  font: { color: '#c9d1d9', size: 12 },
  margin: { t: 8, b: 8, l: 0, r: 0 },
  showlegend: false,
  uniformtext: { mode: 'hide', minsize: 10 }
}

export interface ChartModel {
  data: Record<string, unknown>[]
  layout: Record<string, unknown>
}

interface PieChartOptions {
  activeId?: string | null
  centerLabel: string
  colors: string[]
  ids?: string[]
  labels: string[]
  textinfo: string
  valuesIsk: number[]
  valuesUsd: number[]
}

export function formatNumber(value: number, digits: number = 0): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })
}

export function formatCompactIsk(value: number): string {
  return value.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  })
}

export function formatShare(value: number): string {
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3
  })
}

export function getOverviewErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown dashboard error'
}

export function getPriceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown price error'
}

export function getDateRangeLabel(range: DateRangeValue): string {
  if (range.from && range.to) {
    return range.from === range.to ? range.from : `${range.from} to ${range.to}`
  }
  if (range.from) {
    return `from ${range.from}`
  }
  if (range.to) {
    return `up to ${range.to}`
  }
  return 'all available dates'
}

export function updateDateRangeValue(
  currentRange: DateRangeValue,
  field: keyof DateRangeValue,
  value: string
): DateRangeValue {
  if (field === 'from') {
    if (value && currentRange.to && value > currentRange.to) {
      return { from: currentRange.to, to: value }
    }
    return { ...currentRange, from: value }
  }

  if (value && currentRange.from && value < currentRange.from) {
    return { from: value, to: currentRange.from }
  }

  return { ...currentRange, to: value }
}

export function buildOverviewPath(options: {
  hubDateRange: DateRangeValue
  itemDateRange: DateRangeValue
}) {
  const params = new URLSearchParams()

  if (options.hubDateRange.from) {
    params.set('hub_date_from', options.hubDateRange.from)
  }
  if (options.hubDateRange.to) {
    params.set('hub_date_to', options.hubDateRange.to)
  }
  if (options.itemDateRange.from) {
    params.set('item_date_from', options.itemDateRange.from)
  }
  if (options.itemDateRange.to) {
    params.set('item_date_to', options.itemDateRange.to)
  }

  const queryString = params.toString()
  return queryString ? `/api/dashboard/overview?${queryString}` : '/api/dashboard/overview'
}

export function buildPricePath(options: {
  itemDateRange: DateRangeValue
  regionId: number
  typeId: number
}) {
  const params = new URLSearchParams()
  params.set('region_id', String(options.regionId))

  if (options.itemDateRange.from) {
    params.set('date_from', options.itemDateRange.from)
  }
  if (options.itemDateRange.to) {
    params.set('date_to', options.itemDateRange.to)
  }

  return `/market/price/${options.typeId}?${params.toString()}`
}

export function buildForecastPath(options: {
  dateRange: DateRangeValue
  forecastDays: number
  regionId: number
  typeId: number
}) {
  const params = new URLSearchParams()
  params.set('region_id', String(options.regionId))
  params.set('forecast_days', String(options.forecastDays))

  if (options.dateRange.from) {
    params.set('date_from', options.dateRange.from)
  }
  if (options.dateRange.to) {
    params.set('date_to', options.dateRange.to)
  }

  return `/market/forecast/${options.typeId}?${params.toString()}`
}

export function createPieChartData(options: PieChartOptions): ChartModel {
  const pointIds = options.ids ?? options.labels
  const isActiveSlice = (pointId: string) =>
    options.activeId !== null && options.activeId !== undefined && pointId === options.activeId

  return {
    data: [
      {
        type: 'pie',
        labels: options.labels,
        values: options.valuesIsk,
        ids: pointIds,
        hole: 0.42,
        sort: false,
        direction: 'clockwise',
        marker: {
          colors: options.colors,
          line: {
            color: pointIds.map((pointId) => (isActiveSlice(pointId) ? '#f7e463' : '#161b22')),
            width: pointIds.map((pointId) => (isActiveSlice(pointId) ? 5 : 2))
          }
        },
        pull: pointIds.map((pointId) => (isActiveSlice(pointId) ? 0.06 : 0)),
        textinfo: options.textinfo,
        textposition: 'inside',
        insidetextorientation: 'radial',
        textfont: { color: '#ffffff', size: 11 },
        customdata: options.valuesUsd,
        hovertemplate:
          '<b>%{label}</b><br>ISK: %{value:,.0f}<br>USD: $%{customdata:,.2f}<br>Share: %{percent}<extra></extra>',
        texttemplate:
          options.textinfo === 'label+percent'
            ? '%{label}<br>%{percent}'
            : options.textinfo === 'percent'
              ? '%{percent}'
              : undefined
      }
    ],
    layout: {
      ...BASE_PIE_LAYOUT,
      height: 430,
      annotations: [
        {
          text: options.centerLabel,
          showarrow: false,
          font: { color: '#8b949e', size: 12 },
          x: 0.5,
          y: 0.5
        }
      ]
    }
  }
}

export function createOtherPriceChartData(): ChartModel {
  return {
    data: [],
    layout: {
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#c9d1d9', size: 12 },
      height: 420,
      xaxis: { visible: false },
      yaxis: { visible: false },
      annotations: [
        {
          text: 'Other is an aggregate of hidden items and has no single price history',
          showarrow: false,
          font: { color: '#8b949e', size: 13 },
          x: 0.5,
          y: 0.5
        }
      ]
    }
  }
}

export function createPriceHistoryChartData(priceData: MarketPriceResponse): ChartModel {
  return {
    data: [
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Actual price',
        x: priceData.dates,
        y: priceData.values,
        line: {
          color: priceData.is_fixed_price ? '#ffa657' : '#58a6ff',
          width: 2
        },
        marker: { size: 4 },
        hovertemplate: '%{x}<br>Price: %{y:.4f} ISK<extra></extra>'
      }
    ],
    layout: {
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#c9d1d9', size: 12 },
      margin: { t: 36, b: 64, l: 74, r: 18 },
      height: 420,
      xaxis: {
        title: 'Date',
        gridcolor: '#21262d',
        tickangle: -45,
        automargin: true
      },
      yaxis: { title: 'Price (ISK)', gridcolor: '#21262d', automargin: true },
      legend: { orientation: 'h', y: 1.12, x: 0 }
    }
  }
}

export function createForecastChartData(forecastData: MarketForecastResponse): ChartModel {
  const traces: Record<string, unknown>[] = [
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Actual price',
      x: forecastData.actual_dates,
      y: forecastData.actual_values,
      line: {
        color: forecastData.is_fixed_price ? '#ffa657' : '#58a6ff',
        width: 2
      },
      marker: { size: 4 },
      hovertemplate: '%{x}<br>Actual: %{y:.4f} ISK<extra></extra>'
    }
  ]

  if (forecastData.forecast_dates.length && forecastData.forecast_values.length) {
    traces.push({
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Predict',
      x: forecastData.forecast_dates,
      y: forecastData.forecast_values,
      line: { color: '#f78166', width: 2.5, dash: 'dash' },
      marker: { size: 6, symbol: 'diamond' },
      hovertemplate: '%{x}<br>Predict: %{y:.4f} ISK<extra></extra>'
    })
  }

  return {
    data: traces,
    layout: {
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#c9d1d9', size: 12 },
      margin: { t: 36, b: 64, l: 74, r: 18 },
      height: 420,
      xaxis: {
        title: 'Date',
        gridcolor: '#21262d',
        tickangle: -45,
        automargin: true
      },
      yaxis: { title: 'Price (ISK)', gridcolor: '#21262d', automargin: true },
      legend: { orientation: 'h', y: 1.12, x: 0 }
    }
  }
}

export function createEmptyPriceChartData(text: string): ChartModel {
  return {
    data: [],
    layout: {
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#c9d1d9', size: 12 },
      height: 420,
      xaxis: { visible: false },
      yaxis: { visible: false },
      annotations: [
        {
          text,
          showarrow: false,
          font: { color: '#8b949e', size: 13 },
          x: 0.5,
          y: 0.5
        }
      ]
    }
  }
}
