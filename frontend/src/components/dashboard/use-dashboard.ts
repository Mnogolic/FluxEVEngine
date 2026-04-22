'use client'

import { useEffect, useState } from 'react'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { fetchFromApi } from '@/lib/api'
import type { Locale } from '@/lib/locale'
import type {
  DashboardItem,
  DashboardOverview,
  DateRangeValue,
  MarketForecastComparisonResponse,
  MarketPriceResponse,
  TrackedItemOption
} from '@/types/dashboard'
import {
  DEFAULT_REGION_ID,
  DEFAULT_FORECAST_METHOD_IDS,
  OTHER_SLICE_ID,
  PIE_COLORS,
  buildForecastComparePath,
  buildOverviewPath,
  buildPricePath,
  createEmptyPriceChartData,
  createForecastChartData,
  createOtherPriceChartData,
  createPieChartData,
  createPriceHistoryChartData,
  formatCompactIsk,
  formatCompactUsd,
  formatNumber,
  formatShare,
  getForecastMethodStyle,
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
  bestMethodLabel: string | null
  methods: DashboardForcastMethodMeta[]
}

export interface DashboardForcastMethodMeta {
  color: string
  error: string | null
  id: string
  isBest: boolean
  label: string
  status: 'ok' | 'error'
  validationMae: number | null
  warning: string | null
}

export interface DashboardForcastMethodToggle {
  color: string
  id: string
  isSelected: boolean
  label: string
  onSelectedChange: (checked: boolean) => void
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
  methodToggles: DashboardForcastMethodToggle[]
  minDate?: string
  noteText: string
  onDateChange: (field: keyof DateRangeValue, value: string) => void
  onForecastDaysChange: (value: number | null) => void
}

interface UseDashboardParams {
  locale: Locale
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

const INITIAL_FORECAST_METHOD_SELECTION = DEFAULT_FORECAST_METHOD_IDS.reduce<
  Record<string, boolean>
>((selection, methodId) => {
  selection[methodId] = true
  return selection
}, {})

export function useDashboard({
  locale,
  onPriceChartFocus
}: UseDashboardParams): UseDashboardResult {
  const copy = getDashboardCopy(locale)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [trackedItems, setTrackedItems] = useState<TrackedItemOption[]>([])
  const [hubDateRange, setHubDateRange] = useState<DateRangeValue>({
    from: '',
    to: ''
  })
  const [itemDateRange, setItemDateRange] = useState<DateRangeValue>({
    from: '',
    to: ''
  })
  const [priceDateRange, setPriceDateRange] = useState<DateRangeValue>({
    from: '',
    to: ''
  })
  const [forecastDateRange, setForecastDateRange] = useState<DateRangeValue>({
    from: '',
    to: ''
  })
  const [forecastRangeDefaultKey, setForecastRangeDefaultKey] = useState<string | null>(null)
  const [forecastDays, setForecastDays] = useState(7)
  const [forecastMethodSelection, setForecastMethodSelection] = useState<Record<string, boolean>>(
    INITIAL_FORECAST_METHOD_SELECTION
  )
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
  const [forecastData, setForecastData] = useState<MarketForecastComparisonResponse | null>(null)
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const [isLoadingForecast, setIsLoadingForecast] = useState(false)
  const enabledForecastMethodIds = DEFAULT_FORECAST_METHOD_IDS.filter(
    (methodId) => forecastMethodSelection[methodId]
  )
  const enabledForecastMethodKey = enabledForecastMethodIds.join(',')

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
          setOverviewError(getOverviewErrorMessage(error, locale))
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
  }, [hubDateRange, itemDateRange, locale])

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
          setPriceError(getPriceErrorMessage(error, locale))
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
  }, [isOtherSelected, locale, priceDateRange, selectedRegionId, selectedTypeId])

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
      const activeForecastMethodIds = enabledForecastMethodKey
        ? enabledForecastMethodKey.split(',')
        : []

      setIsLoadingForecast(true)
      setForecastError(null)

      try {
        const nextForecastData = await fetchFromApi<MarketForecastComparisonResponse>(
          buildForecastComparePath({
            dateRange: forecastDateRange,
            forecastDays,
            methodIds: activeForecastMethodIds,
            regionId: selectedRegionId,
            typeId: selectedTypeId
          })
        )

        if (!cancelled) {
          setForecastData(nextForecastData)
        }
      } catch (error) {
        if (!cancelled) {
          setForecastError(getPriceErrorMessage(error, locale))
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
  }, [
    enabledForecastMethodKey,
    forecastDateRange,
    forecastDays,
    isOtherSelected,
    locale,
    selectedRegionId,
    selectedTypeId
  ])

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
  const selectedScopeTotalUsd = selectedScopeItems.reduce((sum, item) => sum + item.usd, 0)
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
    itemLabels.push(copy.otherLabel)
    itemValuesIsk.push(hiddenScopeItems.reduce((sum, item) => sum + item.isk, 0))
    itemValuesUsd.push(hiddenScopeItems.reduce((sum, item) => sum + item.usd, 0))
    itemIds.push(OTHER_SLICE_ID)
  }

  const itemColors = itemLabels.map((label, index) =>
    label === copy.otherLabel ? '#8b949e' : PIE_COLORS[index % (PIE_COLORS.length - 1)]
  )

  const hubChart = createPieChartData({
    centerLabel: copy.pieCenterHubs,
    colors: PIE_COLORS,
    labels: overview?.hub_labels ?? [],
    locale,
    textinfo: 'label+percent',
    valuesIsk: overview?.hub_values_isk ?? [],
    valuesUsd: overview?.hub_values_usd ?? []
  })

  const itemScopeChart = createPieChartData({
    activeId: activeChartItemId,
    centerLabel: selectedScopeRegionId === null ? copy.topCenterLabel(5) : selectedScopeLabel,
    colors: itemColors,
    ids: itemIds,
    labels: itemLabels,
    locale,
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
    ? copy.emptyPriceChartLoading
    : selectedTypeId === null
      ? copy.emptyPriceChartNoItems
      : copy.emptyPriceChartNoHistory

  const priceChart = isOtherSliceSelected
    ? createOtherPriceChartData(locale)
    : priceData && priceData.dates.length
      ? createPriceHistoryChartData(priceData, locale)
      : createEmptyPriceChartData(emptyPriceChartText)
  const emptyForecastChartText = isLoadingForecast
    ? copy.emptyForecastLoading
    : selectedTypeId === null
      ? copy.emptyPriceChartNoItems
      : copy.emptyPriceChartNoHistory
  const forcastChart = isOtherSliceSelected
    ? createOtherPriceChartData(locale)
    : forecastData && forecastData.actual_dates.length
      ? createForecastChartData(forecastData, enabledForecastMethodIds, locale)
      : createEmptyPriceChartData(emptyForecastChartText)

  const itemTurnoverTitle =
    jitaMode === 'all'
      ? copy.itemTurnoverTitleAll(selectedScopeLabel)
      : copy.itemTurnoverTitleTop(boundedTopCount, selectedScopeLabel, shouldShowOther)
  const shownCount =
    jitaMode === 'all' ? selectedScopeItemCount : Math.min(boundedTopCount, selectedScopeItemCount)
  const otherText =
    shouldShowOther && hiddenScopeItems.length > 0
      ? copy.itemTurnoverOtherSuffix(hiddenScopeItems.length)
      : ''
  const hubRangeLabel = getDateRangeLabel(hubDateRange, locale)
  const itemRangeLabel = getDateRangeLabel(itemDateRange, locale)
  const priceRangeLabel = getDateRangeLabel(priceDateRange, locale)
  const forcastRangeLabel = getDateRangeLabel(forecastDateRange, locale)
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
    ? copy.detailOther(
        hiddenScopeItems.length,
        formatCompactIsk(otherTotalIsk, locale),
        formatShare(otherShare, locale),
        selectedScopeLabel
      )
    : selectedItem
      ? copy.detailSelectedItem(
          selectedItem.name,
          formatCompactIsk(selectedItem.isk, locale),
          formatShare(selectedItem.share, locale),
          selectedScopeLabel
        )
      : selectedTrackedItem
        ? copy.detailExternalSelection(selectedTrackedItem.name)
        : null

  const priceMeta =
    !priceError && priceData
      ? {
          dataPointCount: priceData.dates.length,
          isFixedPrice: priceData.is_fixed_price,
          r2: priceData.r2,
          trendText: `${priceData.slope >= 0 ? '+' : '-'}${formatCompactIsk(Math.abs(priceData.slope), locale)} ISK/d`,
          trendUp: priceData.slope >= 0
        }
      : null
  const activeForecastMethods =
    forecastData?.methods.filter((method) => enabledForecastMethodIds.includes(method.method)) ?? []
  const forecastMethodMeta: DashboardForcastMethodMeta[] = activeForecastMethods.map((method) => {
    const style = getForecastMethodStyle(method.method)
    return {
      color: style.color,
      error: method.error,
      id: method.method,
      isBest:
        method.status === 'ok' && forecastData?.best_method_by_validation_mae === method.method,
      label: method.method_label,
      status: method.status,
      validationMae: method.metrics.validation_mae ?? null,
      warning: method.warning
    }
  })
  const forcastMeta =
    !forecastError && forecastData
      ? {
          actualDataPointCount: forecastData.actual_data_point_count,
          trainingDateFrom: forecastData.training_date_from,
          trainingDateTo: forecastData.training_date_to,
          trainingDataPointCount: forecastData.training_data_point_count,
          isFixedPrice: forecastData.is_fixed_price,
          bestMethodLabel:
            forecastMethodMeta.find((method) => method.isBest)?.label ??
            (forecastData.best_method_by_validation_mae
              ? getForecastMethodStyle(forecastData.best_method_by_validation_mae).label
              : null),
          methods: forecastMethodMeta
        }
      : null
  const forcastNoteText = isOtherSliceSelected
    ? copy.forecastOtherNote
    : !forecastData || !forecastData.actual_dates.length
      ? copy.forecastSelectItemNote
      : !forecastData.training_date_from || !forecastData.training_date_to
        ? copy.forecastNoRowsInRange(forcastRangeLabel)
        : enabledForecastMethodIds.length === 0
          ? copy.forecastAllModelsHidden
          : forecastData.training_data_point_count < 3
            ? copy.forecastNeedMorePoints(
                forecastData.training_date_from,
                forecastData.training_date_to
              )
            : activeForecastMethods.every((method) => method.status === 'error')
              ? copy.forecastAllModelsFailed(
                  forecastData.training_date_from,
                  forecastData.training_date_to
                )
              : copy.forecastTrainedSummary(
                  forecastData.training_date_from,
                  forecastData.training_date_to,
                  forecastDays
                )
  const forecastMethodToggles: DashboardForcastMethodToggle[] = DEFAULT_FORECAST_METHOD_IDS.map(
    (methodId) => {
      const style = getForecastMethodStyle(methodId)
      return {
        color: style.color,
        id: methodId,
        isSelected: Boolean(forecastMethodSelection[methodId]),
        label: style.label,
        onSelectedChange: (checked) => {
          setForecastMethodSelection((currentSelection) => ({
            ...currentSelection,
            [methodId]: checked
          }))
        }
      }
    }
  )

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
      methodToggles: forecastMethodToggles,
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
      lastUpdated: overview?.last_date ?? copy.loading,
      plexIskText: overview ? formatNumber(overview.plex_isk, locale) : '...'
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
      itemScopeOptions: itemScopes.map((scope) => ({
        label: scope.label,
        value: scope.id
      })),
      legendColors: itemColors,
      legendIds: itemIds,
      legendLabels: itemLabels,
      legendValues: itemValuesIsk,
      maxDate: lastAvailableDate,
      minDate: firstAvailableDate,
      noteText: copy.itemTurnoverNote(
        shownCount,
        selectedScopeItemCount,
        selectedScopeLabel,
        otherText,
        formatCompactIsk(selectedScopeTotalIsk, locale),
        formatCompactUsd(selectedScopeTotalUsd, locale)
      ),
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
            ? `${item.name} - ${formatCompactIsk(scopeItem.isk, locale)} ISK - ${formatShare(scopeItem.share, locale)}%${isFixedInRegion(scopeItem, selectedRegionId) ? ` - ${copy.fixedBadge}` : ''}`
            : `${item.name} - ${copy.itemNotInScopeLabel}`,
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
