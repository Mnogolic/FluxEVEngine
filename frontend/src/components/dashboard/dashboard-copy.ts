import type { Locale } from '@/lib/locale'

interface HeaderSummaryParams {
  lastUpdated: string
  plexIskText: string
}

export interface DashboardCopy {
  actualPoints: (count: number) => string
  allAvailableDates: string
  allItemsViewLabel: string
  bestBadge: string
  bestValidationMae: (label: string) => string
  betweenDates: (from: string, to: string) => string
  chartError: (error: string) => string
  dashboardTitle: string
  dataPoints: (count: number) => string
  dateAxisTitle: string
  dateRange: {
    calendar: (label: string) => string
    clearEndDate: string
    clearStartDate: string
    endDate: string
    from: string
    startDate: string
    to: string
  }
  detailExternalSelection: (name: string) => string
  detailOther: (count: number, turnover: string, share: string, scopeLabel: string) => string
  detailSelectedItem: (name: string, turnover: string, share: string, scopeLabel: string) => string
  emptyForecastLoading: string
  emptyPriceChartLoading: string
  emptyPriceChartNoHistory: string
  emptyPriceChartNoItems: string
  errorPrefix: string
  fixedBadge: string
  fixedInRegionBadge: string
  fixedPriceInRegionBadge: string
  fromDate: (date: string) => string
  forecastAllModelsFailed: (from: string, to: string) => string
  forecastAllModelsHidden: string
  forecastNeedMorePoints: (from: string, to: string) => string
  forecastNoRowsInRange: (rangeLabel: string) => string
  forecastOtherNote: string
  forecastSelectItemNote: string
  forecastTrainedSummary: (from: string, to: string, days: number) => string
  headerSummary: (params: HeaderSummaryParams) => string
  hoverActualLabel: string
  hoverPriceLabel: string
  hoverShareLabel: string
  hoverUsdLabel: string
  hubLabel: string
  hubTurnoverTitle: string
  itemForecastModelsTitle: string
  itemLabel: string
  itemListSummary: (count: number) => string
  itemNotInScopeLabel: string
  itemTurnoverNote: (
    shownCount: number,
    totalCount: number,
    scopeLabel: string,
    otherText: string,
    totalTurnover: string,
    totalTurnoverUsd: string
  ) => string
  itemTurnoverOtherSuffix: (count: number) => string
  itemTurnoverTitleAll: (scopeLabel: string) => string
  itemTurnoverTitleTop: (count: number, scopeLabel: string, includeOther: boolean) => string
  languageToggleLabel: string
  loading: string
  loadingOverview: string
  metaDescription: string
  metaTitle: string
  noData: string
  otherLabel: string
  otherPriceChartText: string
  overviewLoadError: (error: string) => string
  periodLabel: string
  pieCenterHubs: string
  predictDaysLabel: string
  priceAxisTitle: string
  priceHistoryTitle: string
  projectName: string
  regionLabel: string
  retry: string
  topCenterLabel: (count: number) => string
  topItemsViewLabel: string
  topLabel: string
  traceActualPrice: string
  trainRange: (from: string, to: string) => string
  trainingPoints: (count: number) => string
  unknownDashboardError: string
  unknownPriceError: string
  upToDate: (date: string) => string
  viewLabel: string
}

const DASHBOARD_COPY: Record<Locale, DashboardCopy> = {
  en: {
    actualPoints: (count) => `${count} actual pts`,
    allAvailableDates: 'all available dates',
    allItemsViewLabel: 'All items',
    bestBadge: 'BEST',
    bestValidationMae: (label) => `Best validation MAE: ${label}`,
    betweenDates: (from, to) => (from === to ? from : `${from} to ${to}`),
    chartError: (error) => `Chart error: ${error}`,
    dashboardTitle: 'FluxEVEngine - Market Overview',
    dataPoints: (count) => `${count} pts`,
    dateAxisTitle: 'Date',
    dateRange: {
      calendar: (label) => `${label} calendar`,
      clearEndDate: 'Clear end date',
      clearStartDate: 'Clear start date',
      endDate: 'End date',
      from: 'From',
      startDate: 'Start date',
      to: 'To'
    },
    detailExternalSelection: (name) =>
      `${name} selected from the item list outside the current turnover scope.`,
    detailOther: (count, turnover, share, scopeLabel) =>
      `Other groups ${count} hidden items with ${turnover} ISK turnover, or ${share}% of ${scopeLabel} turnover. Open the item list or switch to All items to inspect them individually.`,
    detailSelectedItem: (name, turnover, share, scopeLabel) =>
      `${name} - ${turnover} ISK turnover - ${share}% of ${scopeLabel} turnover`,
    emptyForecastLoading: 'Loading forecast...',
    emptyPriceChartLoading: 'Loading chart...',
    emptyPriceChartNoHistory: 'No market history for this item in the selected region',
    emptyPriceChartNoItems: 'No items in the selected turnover range',
    errorPrefix: 'Error',
    fixedBadge: 'FIXED',
    fixedInRegionBadge: 'FIXED IN REGION',
    fixedPriceInRegionBadge: 'FIXED PRICE IN THIS REGION',
    fromDate: (date) => `from ${date}`,
    forecastAllModelsFailed: (from, to) =>
      `The selected models could not build a forecast on ${from} to ${to}. Check the method badges for details.`,
    forecastAllModelsHidden:
      'All forecast models are hidden right now. The actual line stays visible until you switch at least one model back on.',
    forecastNeedMorePoints: (from, to) =>
      `Need more historical points inside ${from} to ${to} to build the selected models. The actual line stays visible for comparison.`,
    forecastNoRowsInRange: (rangeLabel) =>
      `No market rows were found inside the selected training period ${rangeLabel}, so forecast cannot start yet. The actual line stays visible for context.`,
    forecastOtherNote:
      'Other combines multiple hidden items, so a single forecast overlay is not available.',
    forecastSelectItemNote:
      'Select an item with market history to compare actual prices against forecast.',
    forecastTrainedSummary: (from, to, days) =>
      `Forecast is trained on ${from} to ${to} and projects ${days} day(s) ahead. All enabled methods share the same training dates for a fair comparison.`,
    headerSummary: ({ lastUpdated, plexIskText }) =>
      `Data from ESI Tranquility | Last update: ${lastUpdated} | PLEX: ${plexIskText} ISK`,
    hoverActualLabel: 'Actual',
    hoverPriceLabel: 'Price',
    hoverShareLabel: 'Share',
    hoverUsdLabel: 'USD',
    hubLabel: 'Hub',
    hubTurnoverTitle: 'Trade Turnover by Hub (ISK)',
    itemForecastModelsTitle: 'Item Forecast Models',
    itemLabel: 'Item',
    itemListSummary: (count) => `Item list (${count})`,
    itemNotInScopeLabel: 'not in selected turnover scope',
    itemTurnoverNote: (
      shownCount,
      totalCount,
      scopeLabel,
      otherText,
      totalTurnover,
      totalTurnoverUsd
    ) =>
      `Showing ${shownCount} of ${totalCount} tracked items (${scopeLabel})${otherText}. Click a sector or item list row to inspect price history. Total turnover: ${totalTurnover} ISK (${totalTurnoverUsd}).`,
    itemTurnoverOtherSuffix: (count) => ` + Other (${count} items)`,
    itemTurnoverTitleAll: (scopeLabel) => `All Items by Turnover (${scopeLabel})`,
    itemTurnoverTitleTop: (count, scopeLabel, includeOther) =>
      `Top ${count} Items by Turnover (${scopeLabel})${includeOther ? ' + Other' : ''}`,
    languageToggleLabel: 'Interface language',
    loading: 'Loading...',
    loadingOverview: 'Loading dashboard overview...',
    metaDescription: 'Market dashboard for FluxEVEngine',
    metaTitle: 'FluxEVEngine',
    noData: 'No data',
    otherLabel: 'Other',
    otherPriceChartText: 'Other is an aggregate of hidden items and has no single price history',
    overviewLoadError: (error) => `Failed to load dashboard overview: ${error}`,
    periodLabel: 'Period',
    pieCenterHubs: 'Hubs',
    predictDaysLabel: 'Forecast days',
    priceAxisTitle: 'Price (ISK)',
    priceHistoryTitle: 'Selected Item Price History',
    projectName: 'FluxEVEngine',
    regionLabel: 'Region',
    retry: 'Retry',
    topCenterLabel: (count) => `Top ${count}`,
    topItemsViewLabel: 'Top items',
    topLabel: 'Top',
    traceActualPrice: 'Actual price',
    trainRange: (from, to) => `Train ${from} to ${to}`,
    trainingPoints: (count) => `${count} train pts`,
    unknownDashboardError: 'Unknown dashboard error',
    unknownPriceError: 'Unknown price error',
    upToDate: (date) => `up to ${date}`,
    viewLabel: 'View'
  },
  ru: {
    actualPoints: (count) => `${count} факт. точек`,
    allAvailableDates: 'все доступные даты',
    allItemsViewLabel: 'Все предметы',
    bestBadge: 'ЛУЧШИЙ',
    bestValidationMae: (label) => `Лучшая валидация MAE: ${label}`,
    betweenDates: (from, to) => (from === to ? from : `${from} - ${to}`),
    chartError: (error) => `Ошибка графика: ${error}`,
    dashboardTitle: 'FluxEVEngine - Обзор рынка',
    dataPoints: (count) => `${count} точек`,
    dateAxisTitle: 'Дата',
    dateRange: {
      calendar: (label) => `Календарь: ${label.toLowerCase()}`,
      clearEndDate: 'Очистить конечную дату',
      clearStartDate: 'Очистить начальную дату',
      endDate: 'Конечная дата',
      from: 'От',
      startDate: 'Начальная дата',
      to: 'До'
    },
    detailExternalSelection: (name) =>
      `${name} выбран из списка предметов вне текущего диапазона оборота.`,
    detailOther: (count, turnover, share, scopeLabel) =>
      `Прочее объединяет ${count} скрытых предметов с оборотом ${turnover} ISK, это ${share}% от оборота ${scopeLabel}. Откройте список предметов или переключитесь на режим "Все предметы", чтобы посмотреть их отдельно.`,
    detailSelectedItem: (name, turnover, share, scopeLabel) =>
      `${name} - ${turnover} ISK оборота - ${share}% от оборота ${scopeLabel}`,
    emptyForecastLoading: 'Загрузка прогноза...',
    emptyPriceChartLoading: 'Загрузка графика...',
    emptyPriceChartNoHistory: 'Для этого предмета нет истории рынка в выбранном регионе',
    emptyPriceChartNoItems: 'В выбранном диапазоне оборота нет предметов',
    errorPrefix: 'Ошибка',
    fixedBadge: 'ФИКС',
    fixedInRegionBadge: 'ФИКС В РЕГИОНЕ',
    fixedPriceInRegionBadge: 'ФИКСИРОВАННАЯ ЦЕНА В ЭТОМ РЕГИОНЕ',
    fromDate: (date) => `от ${date}`,
    forecastAllModelsFailed: (from, to) =>
      `Выбранные модели не смогли построить прогноз на интервале ${from} - ${to}. Подробности смотрите в бейджах методов.`,
    forecastAllModelsHidden:
      'Сейчас скрыты все модели прогноза. Фактическая линия останется видимой, пока вы не включите хотя бы одну модель обратно.',
    forecastNeedMorePoints: (from, to) =>
      `Нужно больше исторических точек в интервале ${from} - ${to}, чтобы построить выбранные модели. Фактическая линия остаётся для сравнения.`,
    forecastNoRowsInRange: (rangeLabel) =>
      `В выбранном обучающем периоде ${rangeLabel} не найдено рыночных строк, поэтому прогноз пока не может стартовать. Фактическая линия оставлена для контекста.`,
    forecastOtherNote:
      'Раздел "Прочее" объединяет несколько скрытых предметов, поэтому единый прогноз для него недоступен.',
    forecastSelectItemNote:
      'Выберите предмет с историей рынка, чтобы сравнить фактические цены с прогнозом.',
    forecastTrainedSummary: (from, to, days) =>
      `Прогноз обучен на интервале ${from} - ${to} и строится на ${days} дн. вперёд. Все включённые методы используют один и тот же обучающий период для корректного сравнения.`,
    headerSummary: ({ lastUpdated, plexIskText }) =>
      `Данные из ESI Tranquility | Последнее обновление: ${lastUpdated} | PLEX: ${plexIskText} ISK`,
    hoverActualLabel: 'Факт',
    hoverPriceLabel: 'Цена',
    hoverShareLabel: 'Доля',
    hoverUsdLabel: 'USD',
    hubLabel: 'Хаб',
    hubTurnoverTitle: 'Торговый оборот по хабам (ISK)',
    itemForecastModelsTitle: 'Модели прогноза по предмету',
    itemLabel: 'Предмет',
    itemListSummary: (count) => `Список предметов (${count})`,
    itemNotInScopeLabel: 'вне выбранного диапазона оборота',
    itemTurnoverNote: (
      shownCount,
      totalCount,
      scopeLabel,
      otherText,
      totalTurnover,
      totalTurnoverUsd
    ) =>
      `Показано ${shownCount} из ${totalCount} отслеживаемых предметов (${scopeLabel})${otherText}. Нажмите на сектор или строку в списке, чтобы посмотреть историю цены. Общий оборот: ${totalTurnover} ISK (${totalTurnoverUsd}).`,
    itemTurnoverOtherSuffix: (count) => ` + Прочее (${count} шт.)`,
    itemTurnoverTitleAll: (scopeLabel) => `Все предметы по обороту (${scopeLabel})`,
    itemTurnoverTitleTop: (count, scopeLabel, includeOther) =>
      `Топ-${count} предметов по обороту (${scopeLabel})${includeOther ? ' + Прочее' : ''}`,
    languageToggleLabel: 'Язык интерфейса',
    loading: 'Загрузка...',
    loadingOverview: 'Загрузка обзора дашборда...',
    metaDescription: 'Рыночный дашборд FluxEVEngine',
    metaTitle: 'FluxEVEngine',
    noData: 'Нет данных',
    otherLabel: 'Прочее',
    otherPriceChartText:
      'Раздел "Прочее" агрегирует скрытые предметы и не имеет единой истории цены',
    overviewLoadError: (error) => `Не удалось загрузить обзор дашборда: ${error}`,
    periodLabel: 'Период',
    pieCenterHubs: 'Хабы',
    predictDaysLabel: 'Дней прогноза',
    priceAxisTitle: 'Цена (ISK)',
    priceHistoryTitle: 'История цен выбранного предмета',
    projectName: 'FluxEVEngine',
    regionLabel: 'Регион',
    retry: 'Повторить',
    topCenterLabel: (count) => `Топ ${count}`,
    topItemsViewLabel: 'Топ предметов',
    topLabel: 'Топ',
    traceActualPrice: 'Фактическая цена',
    trainRange: (from, to) => `Обучение: ${from} - ${to}`,
    trainingPoints: (count) => `${count} обуч. точек`,
    unknownDashboardError: 'Неизвестная ошибка дашборда',
    unknownPriceError: 'Неизвестная ошибка цены',
    upToDate: (date) => `до ${date}`,
    viewLabel: 'Режим'
  }
}

export function getDashboardCopy(locale: Locale): DashboardCopy {
  return DASHBOARD_COPY[locale]
}
