import type {
  DateRangeValue,
  MarketForecastComparisonResponse,
  MarketPriceResponse
} from '@/types/dashboard'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { getIntlLocale, type Locale } from '@/lib/locale'

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

export interface ForecastMethodStyle {
  color: string
  dash: 'dash' | 'dot' | 'longdash' | 'solid'
  label: string
  markerSymbol: 'diamond' | 'square' | 'triangle-up' | 'circle'
}

export const FORECAST_METHOD_STYLES: Record<string, ForecastMethodStyle> = {
  linear: {
    color: '#f78166',
    dash: 'dash',
    label: 'Linear',
    markerSymbol: 'diamond'
  },
  holt_winters: {
    color: '#3fb950',
    dash: 'solid',
    label: 'Holt-Winters',
    markerSymbol: 'square'
  },
  arima: {
    color: '#d29922',
    dash: 'dot',
    label: 'ARIMA',
    markerSymbol: 'triangle-up'
  },
  autoreg: {
    color: '#a371f7',
    dash: 'longdash',
    label: 'AutoReg',
    markerSymbol: 'circle'
  }
}

export const DEFAULT_FORECAST_METHOD_IDS = Object.keys(FORECAST_METHOD_STYLES)

interface PieChartOptions {
  activeId?: string | null
  centerLabel: string
  colors: string[]
  ids?: string[]
  labels: string[]
  locale: Locale
  textinfo: string
  valuesIsk: number[]
  valuesUsd: number[]
}

export function formatNumber(value: number, locale: Locale, digits: number = 0): string {
  return value.toLocaleString(getIntlLocale(locale), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })
}

export function formatCompactIsk(value: number, locale: Locale): string {
  return value.toLocaleString(getIntlLocale(locale), {
    notation: 'compact',
    maximumFractionDigits: 2
  })
}

export function formatCompactUsd(value: number, locale: Locale): string {
  return value.toLocaleString(getIntlLocale(locale), {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2
  })
}

export function formatShare(value: number, locale: Locale): string {
  return Number(value).toLocaleString(getIntlLocale(locale), {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3
  })
}

export function getOverviewErrorMessage(error: unknown, locale: Locale): string {
  return error instanceof Error ? error.message : getDashboardCopy(locale).unknownDashboardError
}

export function getPriceErrorMessage(error: unknown, locale: Locale): string {
  return error instanceof Error ? error.message : getDashboardCopy(locale).unknownPriceError
}

export function getDateRangeLabel(range: DateRangeValue, locale: Locale): string {
  const copy = getDashboardCopy(locale)

  if (range.from && range.to) {
    return copy.betweenDates(range.from, range.to)
  }
  if (range.from) {
    return copy.fromDate(range.from)
  }
  if (range.to) {
    return copy.upToDate(range.to)
  }
  return copy.allAvailableDates
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

export function buildForecastComparePath(options: {
  dateRange: DateRangeValue
  forecastDays: number
  methodIds: string[]
  regionId: number
  typeId: number
  validationDays?: number
}) {
  const params = new URLSearchParams()
  params.set('region_id', String(options.regionId))
  params.set('forecast_days', String(options.forecastDays))
  params.set('validation_days', String(options.validationDays ?? Math.min(options.forecastDays, 7)))
  params.set('methods', options.methodIds.join(','))

  if (options.dateRange.from) {
    params.set('date_from', options.dateRange.from)
  }
  if (options.dateRange.to) {
    params.set('date_to', options.dateRange.to)
  }

  return `/market/forecast/compare/${options.typeId}?${params.toString()}`
}

export function getForecastMethodStyle(methodId: string): ForecastMethodStyle {
  return (
    FORECAST_METHOD_STYLES[methodId] ?? {
      color: '#8b949e',
      dash: 'dash',
      label: methodId,
      markerSymbol: 'diamond'
    }
  )
}

export function createPieChartData(options: PieChartOptions): ChartModel {
  const copy = getDashboardCopy(options.locale)
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
        hovertemplate: `<b>%{label}</b><br>ISK: %{value:,.0f}<br>${copy.hoverUsdLabel}: $%{customdata:,.2f}<br>${copy.hoverShareLabel}: %{percent}<extra></extra>`,
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

export function createOtherPriceChartData(locale: Locale): ChartModel {
  const copy = getDashboardCopy(locale)

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
          text: copy.otherPriceChartText,
          showarrow: false,
          font: { color: '#8b949e', size: 13 },
          x: 0.5,
          y: 0.5
        }
      ]
    }
  }
}

export function createPriceHistoryChartData(
  priceData: MarketPriceResponse,
  locale: Locale
): ChartModel {
  const copy = getDashboardCopy(locale)

  return {
    data: [
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: copy.traceActualPrice,
        x: priceData.dates,
        y: priceData.values,
        line: {
          color: priceData.is_fixed_price ? '#ffa657' : '#58a6ff',
          width: 2
        },
        marker: { size: 4 },
        hovertemplate: `%{x}<br>${copy.hoverPriceLabel}: %{y:.4f} ISK<extra></extra>`
      }
    ],
    layout: {
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#c9d1d9', size: 12 },
      margin: { t: 36, b: 64, l: 74, r: 18 },
      height: 420,
      xaxis: {
        title: copy.dateAxisTitle,
        gridcolor: '#21262d',
        tickangle: -45,
        automargin: true
      },
      yaxis: { title: copy.priceAxisTitle, gridcolor: '#21262d', automargin: true },
      legend: { orientation: 'h', y: 1.12, x: 0 }
    }
  }
}

export function createForecastChartData(
  forecastData: MarketForecastComparisonResponse,
  enabledMethodIds: string[],
  locale: Locale
): ChartModel {
  const copy = getDashboardCopy(locale)
  const traces: Record<string, unknown>[] = [
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: copy.traceActualPrice,
      x: forecastData.actual_dates,
      y: forecastData.actual_values,
      line: {
        color: forecastData.is_fixed_price ? '#ffa657' : '#58a6ff',
        width: 2
      },
      marker: { size: 4 },
      hovertemplate: `%{x}<br>${copy.hoverActualLabel}: %{y:.4f} ISK<extra></extra>`
    }
  ]

  for (const methodResult of forecastData.methods) {
    if (
      methodResult.status !== 'ok' ||
      !enabledMethodIds.includes(methodResult.method) ||
      !methodResult.forecast_dates.length ||
      !methodResult.forecast_values.length
    ) {
      continue
    }

    const style = getForecastMethodStyle(methodResult.method)
    traces.push({
      type: 'scatter',
      mode: 'lines+markers',
      name: methodResult.method_label,
      x: methodResult.forecast_dates,
      y: methodResult.forecast_values,
      line: { color: style.color, width: 2.5, dash: style.dash },
      marker: { size: 6, symbol: style.markerSymbol },
      hovertemplate: `%{x}<br>${methodResult.method_label}: %{y:.4f} ISK<extra></extra>`
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
        title: copy.dateAxisTitle,
        gridcolor: '#21262d',
        tickangle: -45,
        automargin: true
      },
      yaxis: { title: copy.priceAxisTitle, gridcolor: '#21262d', automargin: true },
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
