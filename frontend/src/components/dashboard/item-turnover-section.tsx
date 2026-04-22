'use client'

import styles from '@/components/dashboard.module.css'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { PlotlyChart } from '@/components/plotly-chart'
import { DateRangeField } from '@/components/ui/date-range-field'
import { NumberInputField } from '@/components/ui/number-input-field'
import { SwitchField } from '@/components/ui/switch-field'
import type { Locale } from '@/lib/locale'
import { ChartPanelHeader } from './chart-panel-header'
import { DashboardSelect } from './dashboard-select'
import { formatCompactIsk, PLOT_CONFIG } from './dashboard-utils'
import { PieLegend } from './pie-legend'
import type { DashboardItemTurnoverSectionModel } from './use-dashboard'

interface ItemTurnoverSectionProps {
  locale: Locale
  section: DashboardItemTurnoverSectionModel
}

export function ItemTurnoverSection({ locale, section }: ItemTurnoverSectionProps) {
  const copy = getDashboardCopy(locale)

  return (
    <article className="min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px]">
      <ChartPanelHeader
        controls={
          <div className="flex flex-wrap gap-1">
            <div className="flex flex-wrap items-start gap-3">
              <DateRangeField
                locale={locale}
                maxDate={section.maxDate}
                minDate={section.minDate}
                onChange={section.onDateChange}
                range={section.dateRange}
              />
              <DashboardSelect
                label={copy.hubLabel}
                onChange={section.onItemScopeChange}
                options={section.itemScopeOptions}
                selectedValue={section.selectedItemScopeId}
              />
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <DashboardSelect
                label={copy.viewLabel}
                onChange={(value) => {
                  if (value === 'top' || value === 'all') {
                    section.onViewModeChange(value)
                  }
                }}
                options={[
                  { label: copy.topItemsViewLabel, value: 'top' },
                  { label: copy.allItemsViewLabel, value: 'all' }
                ]}
                selectedValue={section.viewMode}
              />
              <NumberInputField
                isDisabled={section.viewMode === 'all'}
                label={copy.topLabel}
                min={1}
                onChange={(value) => section.onTopCountChange(value ?? 1)}
                value={section.topCount}
              />
              <SwitchField
                isDisabled={section.viewMode === 'all'}
                isSelected={section.includeOther}
                label={copy.otherLabel}
                onValueChange={section.onIncludeOtherChange}
              />
            </div>
          </div>
        }
        title={section.title}
      />
      <div className={styles.chartNote}>
        {copy.periodLabel}: {section.rangeLabel}. {section.noteText}
      </div>
      <div className={styles.chartShell}>
        <div className="px-2">
          <PlotlyChart
            className={styles.pieChart}
            config={PLOT_CONFIG}
            data={section.chart.data}
            layout={section.chart.layout}
            onPointClick={section.onLegendItemSelect}
          />
        </div>
        <details className={styles.legendDetails}>
          <summary className={styles.legendSummary}>
            {copy.itemListSummary(section.legendLabels.length)}
          </summary>
          <PieLegend
            activeId={section.activeChartItemId}
            colors={section.legendColors}
            ids={section.legendIds}
            labels={section.legendLabels}
            locale={locale}
            onItemClick={section.onLegendItemSelect}
            valueFormatter={(value) => formatCompactIsk(value, locale)}
            values={section.legendValues}
          />
        </details>
      </div>
    </article>
  )
}
