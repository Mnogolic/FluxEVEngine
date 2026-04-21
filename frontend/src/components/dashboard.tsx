'use client'

import { useEffect, useRef, useState } from 'react'
import styles from '@/components/dashboard.module.css'
import { PlotlyChart } from '@/components/plotly-chart'
import { fetchFromApi } from '@/lib/api'
import type { DashboardOverview, MarketPriceResponse } from '@/types/dashboard'

const DEFAULT_REGION_ID = 10000002
const OTHER_SLICE_ID = 'other'
const PIE_COLORS = [
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
const PLOT_CONFIG = {
  responsive: true,
  displayModeBar: false
}
const BASE_PIE_LAYOUT = {
  paper_bgcolor: '#161b22',
  plot_bgcolor: '#161b22',
  font: { color: '#c9d1d9', size: 12 },
  margin: { t: 8, b: 8, l: 8, r: 8 },
  showlegend: false,
  uniformtext: { mode: 'hide', minsize: 10 }
}

interface PieLegendProps {
  activeId?: string | null
  colors: string[]
  ids?: string[]
  labels: string[]
  valueFormatter?: (value: number) => string
  values: number[]
}

interface DateRangeValue {
  from: string
  to: string
}

interface DateRangeControlsProps {
  maxDate?: string
  minDate?: string
  onChange: (field: keyof DateRangeValue, value: string) => void
  range: DateRangeValue
}

function formatNumber(value: number, digits: number = 0): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })
}

function formatCompactIsk(value: number): string {
  return value.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  })
}

function formatShare(value: number): string {
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3
  })
}

function getShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  return values.map((value) => (total ? (value / total) * 100 : 0))
}

function getOverviewErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown dashboard error'
}

function getPriceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown price error'
}

function getDateRangeLabel(range: DateRangeValue): string {
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

function updateDateRangeValue(
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

function buildOverviewPath(options: {
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

function buildPricePath(options: {
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

function DateRangeControls({ maxDate, minDate, onChange, range }: DateRangeControlsProps) {
  return (
    <div className={styles.dateRangeControls}>
      <label className={styles.controlLabel}>
        From
        <div className={styles.dateInputWrap}>
          <input
            className={`${styles.controlSelect} ${styles.dateInput}`}
            max={range.to || maxDate}
            min={minDate}
            onChange={(event) => onChange('from', event.target.value)}
            type="date"
            value={range.from}
          />
          {range.from ? (
            <button
              aria-label="Clear start date"
              className={styles.clearDateButton}
              onClick={() => onChange('from', '')}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
      </label>

      <label className={styles.controlLabel}>
        To
        <div className={styles.dateInputWrap}>
          <input
            className={`${styles.controlSelect} ${styles.dateInput}`}
            max={maxDate}
            min={range.from || minDate}
            onChange={(event) => onChange('to', event.target.value)}
            type="date"
            value={range.to}
          />
          {range.to ? (
            <button
              aria-label="Clear end date"
              className={styles.clearDateButton}
              onClick={() => onChange('to', '')}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
      </label>
    </div>
  )
}

function PieLegend({ activeId, colors, ids, labels, valueFormatter, values }: PieLegendProps) {
  const shares = getShares(values)

  return (
    <div className={styles.legendGrid}>
      {labels.map((label, index) => {
        const suffix = valueFormatter ? ` - ${valueFormatter(values[index])}` : ''
        const legendId = ids?.[index] ?? label
        const isActive = activeId !== null && activeId !== undefined && legendId === activeId

        return (
          <div
            className={`${styles.legendItem} ${isActive ? styles.legendItemActive : ''}`}
            key={`${label}-${index}`}
            title={label}
          >
            <span
              className={styles.legendSwatch}
              style={{ background: colors[index % colors.length] }}
            />
            <span className={styles.legendName}>{label}</span>
            <span className={styles.legendShare}>
              {formatShare(shares[index])}%{suffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function createPieChartData(options: {
  activeId?: string | null
  centerLabel: string
  colors: string[]
  ids?: string[]
  labels: string[]
  textinfo: string
  valuesIsk: number[]
  valuesUsd: number[]
}) {
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

export function Dashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [hubDateRange, setHubDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [itemDateRange, setItemDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [priceDateRange, setPriceDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [selectedItemScopeId, setSelectedItemScopeId] = useState(String(DEFAULT_REGION_ID))
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState(DEFAULT_REGION_ID)
  const [isOtherSelected, setIsOtherSelected] = useState(false)
  const [jitaMode, setJitaMode] = useState<'top' | 'all'>('top')
  const [jitaTopCount, setJitaTopCount] = useState(100)
  const [includeOther, setIncludeOther] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [priceData, setPriceData] = useState<MarketPriceResponse | null>(null)
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const priceChartSectionRef = useRef<HTMLElement | null>(null)
  const hubDateFrom = hubDateRange.from
  const hubDateTo = hubDateRange.to
  const itemDateFrom = itemDateRange.from
  const itemDateTo = itemDateRange.to
  const priceDateFrom = priceDateRange.from
  const priceDateTo = priceDateRange.to

  useEffect(() => {
    let cancelled = false

    const loadOverview = async () => {
      setIsLoadingOverview(true)
      setOverviewError(null)

      try {
        const nextOverview = await fetchFromApi<DashboardOverview>(
          buildOverviewPath({
            hubDateRange: { from: hubDateFrom, to: hubDateTo },
            itemDateRange: { from: itemDateFrom, to: itemDateTo }
          })
        )
        if (cancelled) {
          return
        }

        setOverview(nextOverview)
        setIsOtherSelected(false)
        setSelectedItemScopeId((currentScopeId) =>
          nextOverview.item_scopes.some((scope) => scope.id === currentScopeId)
            ? currentScopeId
            : nextOverview.default_item_scope_id
        )
      } catch (error) {
        if (!cancelled) {
          setOverviewError(getOverviewErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOverview(false)
        }
      }
    }

    void loadOverview()

    return () => {
      cancelled = true
    }
  }, [hubDateFrom, hubDateTo, itemDateFrom, itemDateTo])

  useEffect(() => {
    const selectedScope =
      overview?.item_scopes.find((scope) => scope.id === selectedItemScopeId) ??
      overview?.item_scopes[0]

    if (!selectedScope) {
      return
    }

    setSelectedTypeId((currentTypeId) => {
      const currentTypeStillExists = selectedScope.items.some(
        (item) => item.type_id === currentTypeId
      )
      if (currentTypeStillExists) {
        return currentTypeId
      }

      return selectedScope.items[0]?.type_id ?? null
    })
  }, [overview, selectedItemScopeId])

  useEffect(() => {
    if (selectedTypeId === null || isOtherSelected) {
      setPriceData(null)
      setPriceError(null)
      setIsLoadingPrice(false)
      return
    }

    let cancelled = false

    const loadPrice = async () => {
      setIsLoadingPrice(true)
      setPriceError(null)

      try {
        const nextPriceData = await fetchFromApi<MarketPriceResponse>(
          buildPricePath({
            itemDateRange: { from: priceDateFrom, to: priceDateTo },
            regionId: selectedRegionId,
            typeId: selectedTypeId
          })
        )
        if (!cancelled) {
          setPriceData(nextPriceData)
        }
      } catch (error) {
        if (!cancelled) {
          setPriceError(getPriceErrorMessage(error))
          setPriceData(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPrice(false)
        }
      }
    }

    void loadPrice()

    return () => {
      cancelled = true
    }
  }, [isOtherSelected, priceDateFrom, priceDateTo, selectedRegionId, selectedTypeId])

  const itemScopes = overview?.item_scopes ?? []
  const selectedItemScope =
    itemScopes.find((scope) => scope.id === selectedItemScopeId) ?? itemScopes[0] ?? null
  const selectedScopeItems = selectedItemScope?.items ?? []
  const selectedScopeItemCount = selectedItemScope?.item_count ?? 0
  const selectedScopeTotalIsk = selectedItemScope?.total_isk ?? 0
  const selectedScopeLabel = selectedItemScope?.label ?? 'Jita'
  const selectedScopeRegionId = selectedItemScope?.region_id ?? null
  const boundedTopCount = Math.max(
    1,
    Math.min(jitaTopCount || 100, Math.max(selectedScopeItemCount, 1))
  )
  const visibleScopeItems =
    jitaMode === 'all' ? selectedScopeItems : selectedScopeItems.slice(0, boundedTopCount)
  const hiddenScopeItems = jitaMode === 'all' ? [] : selectedScopeItems.slice(boundedTopCount)
  const shouldShowOther = includeOther && jitaMode !== 'all' && hiddenScopeItems.length > 0
  const isOtherSliceSelected = isOtherSelected && shouldShowOther
  let activeChartItemId: string | null = null
  if (isOtherSliceSelected) {
    activeChartItemId = OTHER_SLICE_ID
  } else if (selectedTypeId !== null) {
    activeChartItemId = String(selectedTypeId)
  }
  const itemLabels = visibleScopeItems.map((item) => item.name)
  const itemValuesIsk = visibleScopeItems.map((item) => item.isk)
  const itemValuesUsd = visibleScopeItems.map((item) => item.usd)
  const itemIds = visibleScopeItems.map((item) => String(item.type_id))

  if (shouldShowOther) {
    itemLabels.push('Other')
    itemValuesIsk.push(hiddenScopeItems.reduce((sum, item) => sum + item.isk, 0))
    itemValuesUsd.push(hiddenScopeItems.reduce((sum, item) => sum + item.usd, 0))
    itemIds.push(OTHER_SLICE_ID)
  }

  const itemColors = itemLabels.map((label, index) =>
    label === 'Other' ? '#8b949e' : PIE_COLORS[index % (PIE_COLORS.length - 1)]
  )
  const hubChart = createPieChartData({
    centerLabel: 'Hubs',
    colors: PIE_COLORS,
    labels: overview?.hub_labels ?? [],
    textinfo: 'label+percent',
    valuesIsk: overview?.hub_values_isk ?? [],
    valuesUsd: overview?.hub_values_usd ?? []
  })
  const itemScopeChart = createPieChartData({
    activeId: activeChartItemId,
    centerLabel: selectedScopeRegionId === null ? 'Top 5' : selectedScopeLabel,
    colors: itemColors,
    ids: itemIds,
    labels: itemLabels,
    textinfo: 'percent',
    valuesIsk: itemValuesIsk,
    valuesUsd: itemValuesUsd
  })
  const selectedItem = isOtherSliceSelected
    ? null
    : (selectedScopeItems.find((item) => item.type_id === selectedTypeId) ?? null)
  const regionOptions = overview?.regions ?? []
  const firstAvailableDate = overview?.first_date !== 'N/A' ? overview?.first_date : undefined
  const lastAvailableDate = overview?.last_date !== 'N/A' ? overview?.last_date : undefined
  const isFixedInRegion = (item: { fixed_region_ids: number[] } | null, regionId: number) =>
    Boolean(item?.fixed_region_ids.includes(regionId))
  const isSelectedItemFixedInRegion =
    !isOtherSliceSelected && isFixedInRegion(selectedItem, selectedRegionId)
  const otherTotalIsk = hiddenScopeItems.reduce((sum, item) => sum + item.isk, 0)
  const otherShare = selectedScopeTotalIsk ? (otherTotalIsk / selectedScopeTotalIsk) * 100 : 0
  const emptyPriceChartText = isLoadingPrice
    ? 'Loading chart...'
    : selectedTypeId === null
      ? 'No items in the selected turnover range'
      : 'No market history for this item in the selected region'

  let priceChartData
  if (isOtherSliceSelected) {
    priceChartData = {
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
  } else if (priceData && priceData.dates.length) {
    priceChartData = {
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
        },
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: '7-day forecast',
          x: priceData.forecast_dates,
          y: priceData.forecast_values,
          line: { color: '#f78166', width: 2, dash: 'dash' },
          marker: { size: 6, symbol: 'diamond' },
          hovertemplate: '%{x}<br>Forecast: %{y:.4f} ISK<extra></extra>'
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
  } else {
    priceChartData = {
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
            text: emptyPriceChartText,
            showarrow: false,
            font: { color: '#8b949e', size: 13 },
            x: 0.5,
            y: 0.5
          }
        ]
      }
    }
  }

  const scopeLocationText =
    selectedScopeRegionId === null ? `across ${selectedScopeLabel}` : `in ${selectedScopeLabel}`
  const scopeTurnoverText = `${selectedScopeLabel} turnover`
  const jitaTitle =
    jitaMode === 'all'
      ? `All Items by Turnover ${scopeLocationText}`
      : `Top ${boundedTopCount} Items by Turnover ${scopeLocationText}${shouldShowOther ? ' + Other' : ''}`
  const shownCount =
    jitaMode === 'all' ? selectedScopeItemCount : Math.min(boundedTopCount, selectedScopeItemCount)
  const otherText =
    shouldShowOther && hiddenScopeItems.length > 0
      ? ` + Other (${hiddenScopeItems.length} items)`
      : ''
  const priceTrendClass = priceData && priceData.slope >= 0 ? styles.trendUp : styles.trendDown
  const priceTrendText =
    priceData && priceData.slope >= 0
      ? `up +${priceData.slope.toFixed(4)} ISK/day`
      : `down ${priceData?.slope.toFixed(4) ?? '0.0000'} ISK/day`
  const hubRangeLabel = getDateRangeLabel(hubDateRange)
  const itemRangeLabel = getDateRangeLabel(itemDateRange)
  const priceRangeLabel = getDateRangeLabel(priceDateRange)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>FluxEV Engine - Market Overview</h1>
      <p className={styles.subTitle}>
        Data from ESI Tranquility · Last update: {overview?.last_date ?? 'Loading...'} · PLEX:{' '}
        {overview ? formatNumber(overview.plex_isk) : '...'} ISK
      </p>

      {overviewError ? (
        <section className={`${styles.status} ${styles.errorBox}`}>
          Failed to load dashboard overview: {overviewError}
          <div>
            <button
              className={styles.retryButton}
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.charts}>
        <article className={styles.chartBox}>
          <div className={styles.chartHead}>
            <h2>Trade Turnover by Hub (ISK)</h2>
            <DateRangeControls
              maxDate={lastAvailableDate}
              minDate={firstAvailableDate}
              onChange={(field, value) => {
                setHubDateRange((currentRange) => updateDateRangeValue(currentRange, field, value))
              }}
              range={hubDateRange}
            />
          </div>
          <div className={styles.chartNote}>Period: {hubRangeLabel}.</div>
          <div className={styles.chartShell}>
            <PlotlyChart
              className={styles.pieChart}
              config={PLOT_CONFIG}
              data={hubChart.data}
              layout={hubChart.layout}
            />
            <PieLegend
              colors={PIE_COLORS}
              labels={overview?.hub_labels ?? []}
              values={overview?.hub_values_isk ?? []}
            />
          </div>
        </article>

        <article className={styles.chartBox}>
          <div className={styles.chartHead}>
            <h2>{jitaTitle}</h2>
            <div className={styles.chartControls}>
              <DateRangeControls
                maxDate={lastAvailableDate}
                minDate={firstAvailableDate}
                onChange={(field, value) => {
                  setIsOtherSelected(false)
                  setItemDateRange((currentRange) =>
                    updateDateRangeValue(currentRange, field, value)
                  )
                }}
                range={itemDateRange}
              />
              <label className={styles.controlLabel}>
                Hub
                <select
                  className={styles.controlSelect}
                  onChange={(event) => {
                    setIsOtherSelected(false)
                    const nextScopeId = event.target.value
                    setSelectedItemScopeId(nextScopeId)

                    const nextScope = itemScopes.find((scope) => scope.id === nextScopeId)
                    if (nextScope?.region_id !== null && nextScope?.region_id !== undefined) {
                      setSelectedRegionId(nextScope.region_id)
                    }
                  }}
                  value={selectedItemScopeId}
                >
                  {itemScopes.map((scope) => (
                    <option key={scope.id} value={scope.id}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.controlLabel}>
                View
                <select
                  className={styles.controlSelect}
                  onChange={(event) => {
                    setIsOtherSelected(false)
                    setJitaMode(event.target.value as 'top' | 'all')
                  }}
                  value={jitaMode}
                >
                  <option value="top">Top items</option>
                  <option value="all">All items</option>
                </select>
              </label>
              <label className={styles.controlLabel}>
                Top
                <input
                  className={`${styles.controlNumber} ${styles.topCountInput}`}
                  disabled={jitaMode === 'all'}
                  min={1}
                  onChange={(event) => {
                    setIsOtherSelected(false)
                    setJitaTopCount(Number(event.target.value))
                  }}
                  type="number"
                  value={boundedTopCount}
                />
              </label>
              <label className={`${styles.controlLabel} ${styles.toggleLabel}`}>
                <input
                  checked={includeOther}
                  className={styles.toggleInput}
                  disabled={jitaMode === 'all'}
                  onChange={(event) => {
                    setIsOtherSelected(false)
                    setIncludeOther(event.target.checked)
                  }}
                  type="checkbox"
                />
                Other
              </label>
            </div>
          </div>
          <div className={styles.chartNote}>
            Period: {itemRangeLabel}. Showing {shownCount} of {selectedScopeItemCount} tracked items{' '}
            {scopeLocationText}
            {otherText}. Click a sector to inspect price history. Total turnover:{' '}
            {formatCompactIsk(selectedScopeTotalIsk)} ISK.
          </div>
          <div className={styles.chartShell}>
            <PlotlyChart
              className={styles.pieChart}
              config={PLOT_CONFIG}
              data={itemScopeChart.data}
              layout={itemScopeChart.layout}
              onPointClick={(pointId) => {
                const inheritedPriceRange =
                  itemDateRange.from || itemDateRange.to
                    ? { ...itemDateRange }
                    : { from: '', to: '' }

                if (pointId === OTHER_SLICE_ID) {
                  setIsOtherSelected(true)
                  setPriceDateRange(inheritedPriceRange)
                  setPriceData(null)
                  setPriceError(null)
                  priceChartSectionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  })
                  return
                }

                const nextTypeId = Number(pointId)
                if (!Number.isFinite(nextTypeId)) {
                  return
                }

                setIsOtherSelected(false)
                setPriceDateRange(inheritedPriceRange)
                setSelectedTypeId(nextTypeId)
                priceChartSectionRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
                })
              }}
            />
            <details className={styles.legendDetails}>
              <summary className={styles.legendSummary}>Item list ({itemLabels.length})</summary>
              <PieLegend
                activeId={activeChartItemId}
                colors={itemColors}
                ids={itemIds}
                labels={itemLabels}
                valueFormatter={formatCompactIsk}
                values={itemValuesIsk}
              />
            </details>
          </div>
        </article>

        <article className={`${styles.chartBox} ${styles.wide}`} ref={priceChartSectionRef}>
          <div className={styles.chartHead}>
            <h2>Selected Item Price History + 7-day Forecast</h2>
            <DateRangeControls
              maxDate={lastAvailableDate}
              minDate={firstAvailableDate}
              onChange={(field, value) => {
                setPriceDateRange((currentRange) =>
                  updateDateRangeValue(currentRange, field, value)
                )
              }}
              range={priceDateRange}
            />
          </div>
          <div className={styles.chartNote}>Period: {priceRangeLabel}.</div>
          <div className={styles.selectorRow}>
            <select
              className={`${styles.controlSelect} ${styles.itemSelect}`}
              onChange={(event) => {
                setIsOtherSelected(false)
                setSelectedTypeId(Number(event.target.value))
              }}
              value={selectedTypeId ?? undefined}
            >
              {selectedScopeItems.map((item) => (
                <option
                  key={item.type_id}
                  style={isFixedInRegion(item, selectedRegionId) ? { color: '#ffa657' } : undefined}
                  value={item.type_id}
                >
                  {item.name} - {formatCompactIsk(item.isk)} ISK - {formatShare(item.share)}%
                  {isFixedInRegion(item, selectedRegionId) ? ' - FIXED' : ''}
                </option>
              ))}
            </select>
            <select
              className={`${styles.controlSelect} ${styles.regionSelect}`}
              onChange={(event) => setSelectedRegionId(Number(event.target.value))}
              value={selectedRegionId}
            >
              {regionOptions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            <span className={styles.meta}>
              {priceError ? `Chart error: ${priceError}` : null}
              {!priceError && priceData ? (
                <span className={styles.chartMeta}>
                  {priceData.is_fixed_price ? (
                    <span className={styles.fixedBadge}>FIXED</span>
                  ) : null}
                  <span className={priceTrendClass}>{priceTrendText}</span>
                  <span>|</span>
                  <span>R2 = {priceData.r2}</span>
                  <span>|</span>
                  <span>{priceData.dates.length} data points</span>
                </span>
              ) : null}
              {!priceError && !priceData && !isLoadingPrice ? 'No data' : null}
            </span>
          </div>

          <div className={styles.itemDetail}>
            {isOtherSliceSelected ? (
              <span>
                Other groups {hiddenScopeItems.length} hidden items with{' '}
                {formatCompactIsk(otherTotalIsk)} ISK turnover, or {formatShare(otherShare)}% of{' '}
                {scopeTurnoverText}. Open the item list or switch to All items to inspect them
                individually.
              </span>
            ) : null}
            {selectedItem ? (
              <span>
                {selectedItem.name} - {formatCompactIsk(selectedItem.isk)} ISK turnover -{' '}
                {formatShare(selectedItem.share)}% of {scopeTurnoverText}
              </span>
            ) : null}
            {isSelectedItemFixedInRegion ? (
              <span className={styles.fixedBadge}>FIXED PRICE IN THIS REGION</span>
            ) : null}
          </div>

          <PlotlyChart
            className={styles.priceChart}
            config={PLOT_CONFIG}
            data={priceChartData.data}
            layout={priceChartData.layout}
          />
        </article>
      </section>

      {isLoadingOverview ? (
        <section className={styles.status}>Loading dashboard overview...</section>
      ) : null}
    </main>
  )
}
