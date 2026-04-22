'use client'

import { useEffect, useState } from 'react'
import { fetchFromApi } from '@/lib/api'
import type {
  DashboardItem,
  DashboardOverview,
  DateRangeValue,
  MarketForecastResponse,
  MarketPriceResponse,
  TrackedItemOption
} from '@/types/dashboard'
import {
  DEFAULT_REGION_ID,
  OTHER_SLICE_ID,
  PIE_COLORS,
  buildForecastPath,
  buildOverviewPath,
  buildPricePath,
  createEmptyPriceChartData,
  createForecastChartData,
  createOtherPriceChartData,
  createPieChartData,
  createPriceHistoryChartData,
  formatCompactIsk,
  formatNumber,
  formatShare,
  getDateRangeLabel,
  getOverviewErrorMessage,
  getPriceErrorMessage,
  updateDateRangeValue,
  type ChartModel
} from './dashboard-utils'

export interface DashboardOption {
  label: string
  value: string
}

export interface DashboardItemSelectOption {
  isFixedInRegion: boolean
  label: string
  value: string
}

export interface DashboardHeaderModel {
  lastUpdated: string
  plexIskText: string
}

export interface DashboardHubSectionModel {
  chart: ChartModel
  dateRange: DateRangeValue
  labels: string[]
  maxDate?: string
  minDate?: string
  onDateChange: (field: keyof DateRangeValue, value: string) => void
  rangeLabel: string
  values: number[]
}

export interface DashboardItemTurnoverSectionModel {
  activeChartItemId: string | null
  chart: ChartModel
  dateRange: DateRangeValue
  includeOther: boolean
  itemScopeOptions: DashboardOption[]
  legendColors: string[]
  legendIds: string[]
  legendLabels: string[]
  legendValues: number[]
  maxDate?: string
  minDate?: string
  noteText: string
  onDateChange: (field: keyof DateRangeValue, value: string) => void
  onIncludeOtherChange: (checked: boolean) => void
  onItemScopeChange: (scopeId: string) => void
  onLegendItemSelect: (pointId: string) => void
  onTopCountChange: (value: number) => void
  onViewModeChange: (mode: 'top' | 'all') => void
  rangeLabel: string
  selectedItemScopeId: string
  title: string
  topCount: number
  viewMode: 'top' | 'all'
}

export interface DashboardPriceMeta {
  dataPointCount: number
  isFixedPrice: boolean
  r2: number
  trendText: string
  trendUp: boolean
}

export interface DashboardPriceSectionModel {
  chart: ChartModel
  dateRange: DateRangeValue
  detailText: string | null
  isSelectedItemFixedInRegion: boolean
  itemOptions: DashboardItemSelectOption[]
  maxDate?: string
  meta: DashboardPriceMeta | null
  minDate?: string
  onDateChange: (field: keyof DateRangeValue, value: string) => void
  onRegionChange: (regionId: number) => void
  onTypeChange: (typeId: string) => void
  priceError: string | null
  rangeLabel: string
  regionOptions: DashboardOption[]
  selectedRegionId: number
  selectedTypeId: string | null
}

export interface DashboardForcastMeta {
  actualDataPointCount: number
  trainingDateFrom: string | null
  trainingDateTo: string | null
  trainingDataPointCount: number
  isFixedPrice: boolean
  r2: number
  trendText: string
  trendUp: boolean
}

export interface DashboardForcastSectionModel {
  chart: ChartModel
  dateRange: DateRangeValue
  detailText: string | null
  forecastDays: number
  forecastError: string | null
  isSelectedItemFixedInRegion: boolean
  maxDate?: string
  meta: DashboardForcastMeta | null
  minDate?: string
  noteText: string
  onDateChange: (field: keyof DateRangeValue, value: string) => void
  onForecastDaysChange: (value: number | null) => void
}

interface UseDashboardParams {
  onPriceChartFocus?: () => void
}

interface UseDashboardResult {
  forcastSection: DashboardForcastSectionModel
  header: DashboardHeaderModel
  hubSection: DashboardHubSectionModel
  isLoadingOverview: boolean
  itemTurnoverSection: DashboardItemTurnoverSectionModel
  overviewError: string | null
  priceSection: DashboardPriceSectionModel
}

function isFixedInRegion(item: Pick<DashboardItem, 'fixed_region_ids'> | null, regionId: number) {
  return Boolean(item?.fixed_region_ids.includes(regionId))
}

function getInheritedPriceRange(itemDateRange: DateRangeValue): DateRangeValue {
  return itemDateRange.from || itemDateRange.to ? { ...itemDateRange } : { from: '', to: '' }
}

export function useDashboard({ onPriceChartFocus }: UseDashboardParams = {}): UseDashboardResult {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [trackedItems, setTrackedItems] = useState<TrackedItemOption[]>([])
  const [hubDateRange, setHubDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [itemDateRange, setItemDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [priceDateRange, setPriceDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [forecastDateRange, setForecastDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [forecastRangeDefaultKey, setForecastRangeDefaultKey] = useState<string | null>(null)
  const [forecastDays, setForecastDays] = useState(7)
  const [selectedItemScopeId, setSelectedItemScopeId] = useState(String(DEFAULT_REGION_ID))
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState(DEFAULT_REGION_ID)
  const [isOtherSelected, setIsOtherSelected] = useState(false)
  const [jitaMode, setJitaMode] = useState<'top' | 'all'>('top')
  const [jitaTopCount, setJitaTopCount] = useState(100)
  const [includeOther, setIncludeOther] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [priceData, setPriceData] = useState<MarketPriceResponse | null>(null)
  const [forecastData, setForecastData] = useState<MarketForecastResponse | null>(null)
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const [isLoadingForecast, setIsLoadingForecast] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadOverview = async () => {
      setIsLoadingOverview(true)
      setOverviewError(null)

      try {
        const nextOverview = await fetchFromApi<DashboardOverview>(
          buildOverviewPath({
            hubDateRange,
            itemDateRange
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
  }, [hubDateRange, itemDateRange])

  useEffect(() => {
    let cancelled = false

    const loadTrackedItems = async () => {
      try {
        const nextTrackedItems = await fetchFromApi<TrackedItemOption[]>('/market/items')
        if (!cancelled) {
          setTrackedItems(nextTrackedItems)
        }
      } catch {
        if (!cancelled) {
          setTrackedItems([])
        }
      }
    }

    void loadTrackedItems()

    return () => {
      cancelled = true
    }
  }, [])

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
            itemDateRange: priceDateRange,
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
  }, [isOtherSelected, priceDateRange, selectedRegionId, selectedTypeId])

  useEffect(() => {
    setForecastDateRange({ from: '', to: '' })
    setForecastRangeDefaultKey(null)
    setForecastData(null)
    setForecastError(null)
  }, [selectedRegionId, selectedTypeId])

  useEffect(() => {
    if (selectedTypeId === null || isOtherSelected) {
      setForecastData(null)
      setForecastError(null)
      setIsLoadingForecast(false)
      return
    }

    let cancelled = false

    const loadForecast = async () => {
      setIsLoadingForecast(true)
      setForecastError(null)

      try {
        const nextForecastData = await fetchFromApi<MarketForecastResponse>(
          buildForecastPath({
            dateRange: forecastDateRange,
            forecastDays,
            regionId: selectedRegionId,
            typeId: selectedTypeId
          })
        )

        if (!cancelled) {
          setForecastData(nextForecastData)
        }
      } catch (error) {
        if (!cancelled) {
          setForecastError(getPriceErrorMessage(error))
          setForecastData(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingForecast(false)
        }
      }
    }

    void loadForecast()

    return () => {
      cancelled = true
    }
  }, [forecastDateRange, forecastDays, isOtherSelected, selectedRegionId, selectedTypeId])

  useEffect(() => {
    if (
      !forecastData?.first_actual_date ||
      !forecastData?.last_actual_date ||
      selectedTypeId === null ||
      isOtherSelected
    ) {
      return
    }

    const nextDefaultKey = `${selectedTypeId}:${selectedRegionId}`
    if (forecastRangeDefaultKey === nextDefaultKey) {
      return
    }

    setForecastDateRange({
      from: forecastData.first_actual_date,
      to: forecastData.last_actual_date
    })
    setForecastRangeDefaultKey(nextDefaultKey)
  }, [
    forecastData?.first_actual_date,
    forecastData?.last_actual_date,
    forecastRangeDefaultKey,
    isOtherSelected,
    selectedRegionId,
    selectedTypeId
  ])

  const itemScopes = overview?.item_scopes ?? []
  const selectedItemScope =
    itemScopes.find((scope) => scope.id === selectedItemScopeId) ?? itemScopes[0] ?? null
  const selectedScopeItems = selectedItemScope?.items ?? []
  const selectedTrackedItem =
    trackedItems.find((item) => item.type_id === selectedTypeId) ??
    selectedScopeItems.find((item) => item.type_id === selectedTypeId) ??
    null
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

  const activeChartItemId = isOtherSliceSelected
    ? OTHER_SLICE_ID
    : selectedTypeId !== null
      ? String(selectedTypeId)
      : null

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
  const forecastMinDate = forecastData?.first_actual_date ?? firstAvailableDate
  const forecastMaxDate = forecastData?.last_actual_date ?? lastAvailableDate
  const isSelectedItemFixedInRegion =
    !isOtherSliceSelected && isFixedInRegion(selectedItem, selectedRegionId)
  const otherTotalIsk = hiddenScopeItems.reduce((sum, item) => sum + item.isk, 0)
  const otherShare = selectedScopeTotalIsk ? (otherTotalIsk / selectedScopeTotalIsk) * 100 : 0
  const emptyPriceChartText = isLoadingPrice
    ? 'Loading chart...'
    : selectedTypeId === null
      ? 'No items in the selected turnover range'
      : 'No market history for this item in the selected region'

  const priceChart = isOtherSliceSelected
    ? createOtherPriceChartData()
    : priceData && priceData.dates.length
      ? createPriceHistoryChartData(priceData)
      : createEmptyPriceChartData(emptyPriceChartText)
  const emptyForecastChartText = isLoadingForecast
    ? 'Loading forecast...'
    : selectedTypeId === null
      ? 'No items in the selected turnover range'
      : 'No market history for this item in the selected region'
  const forcastChart = isOtherSliceSelected
    ? createOtherPriceChartData()
    : forecastData && forecastData.actual_dates.length
      ? createForecastChartData(forecastData)
      : createEmptyPriceChartData(emptyForecastChartText)

  const scopeLocationText =
    selectedScopeRegionId === null ? `across ${selectedScopeLabel}` : `in ${selectedScopeLabel}`
  const scopeTurnoverText = `${selectedScopeLabel} turnover`
  const itemTurnoverTitle =
    jitaMode === 'all'
      ? `All Items by Turnover ${scopeLocationText}`
      : `Top ${boundedTopCount} Items by Turnover ${scopeLocationText}${shouldShowOther ? ' + Other' : ''}`
  const shownCount =
    jitaMode === 'all' ? selectedScopeItemCount : Math.min(boundedTopCount, selectedScopeItemCount)
  const otherText =
    shouldShowOther && hiddenScopeItems.length > 0
      ? ` + Other (${hiddenScopeItems.length} items)`
      : ''
  const hubRangeLabel = getDateRangeLabel(hubDateRange)
  const itemRangeLabel = getDateRangeLabel(itemDateRange)
  const priceRangeLabel = getDateRangeLabel(priceDateRange)
  const forcastRangeLabel = getDateRangeLabel(forecastDateRange)
  const getScopeItemByTypeId = (typeId: number) =>
    selectedScopeItems.find((item) => item.type_id === typeId) ?? null

  const selectItemWithInheritedDates = (nextTypeId: number | null) => {
    setIsOtherSelected(false)
    setPriceDateRange(getInheritedPriceRange(itemDateRange))
    setSelectedTypeId(nextTypeId)
  }

  const selectLegendItem = (pointId: string) => {
    if (pointId === OTHER_SLICE_ID) {
      setIsOtherSelected(true)
      setPriceDateRange(getInheritedPriceRange(itemDateRange))
      setPriceData(null)
      setPriceError(null)
      onPriceChartFocus?.()
      return
    }

    const nextTypeId = Number(pointId)
    if (!Number.isFinite(nextTypeId)) {
      return
    }

    selectItemWithInheritedDates(nextTypeId)
    onPriceChartFocus?.()
  }

  const detailText = isOtherSliceSelected
    ? `Other groups ${hiddenScopeItems.length} hidden items with ${formatCompactIsk(otherTotalIsk)} ISK turnover, or ${formatShare(otherShare)}% of ${scopeTurnoverText}. Open the item list or switch to All items to inspect them individually.`
    : selectedItem
      ? `${selectedItem.name} - ${formatCompactIsk(selectedItem.isk)} ISK turnover - ${formatShare(selectedItem.share)}% of ${scopeTurnoverText}`
      : selectedTrackedItem
        ? `${selectedTrackedItem.name} selected from item list outside current turnover scope.`
        : null

  const priceMeta =
    !priceError && priceData
      ? {
          dataPointCount: priceData.dates.length,
          isFixedPrice: priceData.is_fixed_price,
          r2: priceData.r2,
          trendText: `${priceData.slope >= 0 ? '+' : '-'}${formatCompactIsk(Math.abs(priceData.slope))} ISK/d`,
          trendUp: priceData.slope >= 0
        }
      : null
  const forcastMeta =
    !forecastError && forecastData
      ? {
          actualDataPointCount: forecastData.actual_data_point_count,
          trainingDateFrom: forecastData.training_date_from,
          trainingDateTo: forecastData.training_date_to,
          trainingDataPointCount: forecastData.training_data_point_count,
          isFixedPrice: forecastData.is_fixed_price,
          r2: forecastData.r2,
          trendText: `${forecastData.slope >= 0 ? '+' : '-'}${formatCompactIsk(Math.abs(forecastData.slope))} ISK/d`,
          trendUp: forecastData.slope >= 0
        }
      : null
  const forcastNoteText = isOtherSliceSelected
    ? 'Other combines multiple hidden items, so a single predict overlay is not available.'
    : !forecastData || !forecastData.actual_dates.length
      ? 'Select an item with market history to compare actual prices against predict.'
      : !forecastData.training_date_from || !forecastData.training_date_to
        ? `No market rows were found inside the selected training period ${forcastRangeLabel}, so predict cannot start yet. The actual line stays visible for context.`
        : forecastData.training_data_point_count < 3
          ? `Need at least 3 historical points inside ${forecastData.training_date_from} to ${forecastData.training_date_to} to build predict. The actual line stays visible for comparison.`
          : `Predict is trained on ${forecastData.training_date_from} to ${forecastData.training_date_to} and projects ${forecastDays} day(s) ahead. The actual line stays visible across the full chart.`

  return {
    forcastSection: {
      chart: forcastChart,
      dateRange: forecastDateRange,
      detailText,
      forecastDays,
      forecastError,
      isSelectedItemFixedInRegion,
      maxDate: forecastMaxDate,
      meta: forcastMeta,
      minDate: forecastMinDate,
      noteText: forcastNoteText,
      onDateChange: (field, value) => {
        setForecastDateRange((currentRange) => updateDateRangeValue(currentRange, field, value))
      },
      onForecastDaysChange: (value) => {
        const nextDays = Number(value)
        if (Number.isFinite(nextDays)) {
          setForecastDays(Math.max(1, Math.min(Math.round(nextDays), 90)))
        }
      }
    },
    header: {
      lastUpdated: overview?.last_date ?? 'Loading...',
      plexIskText: overview ? formatNumber(overview.plex_isk) : '...'
    },
    overviewError,
    isLoadingOverview,
    hubSection: {
      chart: hubChart,
      dateRange: hubDateRange,
      labels: overview?.hub_labels ?? [],
      maxDate: lastAvailableDate,
      minDate: firstAvailableDate,
      onDateChange: (field, value) => {
        setHubDateRange((currentRange) => updateDateRangeValue(currentRange, field, value))
      },
      rangeLabel: hubRangeLabel,
      values: overview?.hub_values_isk ?? []
    },
    itemTurnoverSection: {
      activeChartItemId,
      chart: itemScopeChart,
      dateRange: itemDateRange,
      includeOther,
      itemScopeOptions: itemScopes.map((scope) => ({ label: scope.label, value: scope.id })),
      legendColors: itemColors,
      legendIds: itemIds,
      legendLabels: itemLabels,
      legendValues: itemValuesIsk,
      maxDate: lastAvailableDate,
      minDate: firstAvailableDate,
      noteText: `Showing ${shownCount} of ${selectedScopeItemCount} tracked items ${scopeLocationText}${otherText}. Click a sector or item list row to inspect price history. Total turnover: ${formatCompactIsk(selectedScopeTotalIsk)} ISK.`,
      onDateChange: (field, value) => {
        setIsOtherSelected(false)
        setItemDateRange((currentRange) => updateDateRangeValue(currentRange, field, value))
      },
      onIncludeOtherChange: (checked) => {
        setIsOtherSelected(false)
        setIncludeOther(checked)
      },
      onItemScopeChange: (scopeId) => {
        setIsOtherSelected(false)
        setSelectedItemScopeId(scopeId)

        const nextScope = itemScopes.find((scope) => scope.id === scopeId)
        if (nextScope?.region_id !== null && nextScope?.region_id !== undefined) {
          setSelectedRegionId(nextScope.region_id)
        }
      },
      onLegendItemSelect: selectLegendItem,
      onTopCountChange: (value) => {
        setIsOtherSelected(false)
        setJitaTopCount(value)
      },
      onViewModeChange: (mode) => {
        setIsOtherSelected(false)
        setJitaMode(mode)
      },
      rangeLabel: itemRangeLabel,
      selectedItemScopeId,
      title: itemTurnoverTitle,
      topCount: boundedTopCount,
      viewMode: jitaMode
    },
    priceSection: {
      chart: priceChart,
      dateRange: priceDateRange,
      detailText,
      isSelectedItemFixedInRegion,
      itemOptions: trackedItems.map((item) => {
        const scopeItem = getScopeItemByTypeId(item.type_id)
        return {
          isFixedInRegion: isFixedInRegion(scopeItem, selectedRegionId),
          label: scopeItem
            ? `${item.name} - ${formatCompactIsk(scopeItem.isk)} ISK - ${formatShare(scopeItem.share)}%${isFixedInRegion(scopeItem, selectedRegionId) ? ' - FIXED' : ''}`
            : `${item.name} - not in selected turnover scope`,
          value: String(item.type_id)
        }
      }),
      maxDate: lastAvailableDate,
      meta: priceMeta,
      minDate: firstAvailableDate,
      onDateChange: (field, value) => {
        setPriceDateRange((currentRange) => updateDateRangeValue(currentRange, field, value))
      },
      onRegionChange: (regionId) => setSelectedRegionId(regionId),
      onTypeChange: (typeId) => {
        const nextTypeId = Number(typeId)
        if (Number.isFinite(nextTypeId)) {
          selectItemWithInheritedDates(nextTypeId)
        }
      },
      priceError,
      rangeLabel: priceRangeLabel,
      regionOptions: regionOptions.map((region) => ({
        label: region.name,
        value: String(region.id)
      })),
      selectedRegionId,
      selectedTypeId: selectedTypeId !== null ? String(selectedTypeId) : null
    }
  }
}
