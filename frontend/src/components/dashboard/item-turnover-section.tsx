'use client'

import styles from '@/components/dashboard.module.css'
import { PlotlyChart } from '@/components/plotly-chart'
import { ChartPanelHeader } from './chart-panel-header'
import { DashboardDateRange } from './dashboard-date-range'
import { DashboardNumberInput } from './dashboard-number-input'
import { DashboardSelect } from './dashboard-select'
import { DashboardSwitch } from './dashboard-switch'
import { formatCompactIsk, PLOT_CONFIG } from './dashboard-utils'
import { PieLegend } from './pie-legend'
import type { DashboardItemTurnoverSectionModel } from './use-dashboard'

interface ItemTurnoverSectionProps {
  section: DashboardItemTurnoverSectionModel
}

export function ItemTurnoverSection({ section }: ItemTurnoverSectionProps) {
  return (
    <article className="min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px]">
      <ChartPanelHeader
        controls={
          <div className="flex flex-wrap items-center justify-baseline gap-3">
            <DashboardDateRange
              className="shrink-0"
              maxDate={section.maxDate}
              minDate={section.minDate}
              onChange={section.onDateChange}
              range={section.dateRange}
            />
            <DashboardSelect
              label="Hub"
              onChange={section.onItemScopeChange}
              options={section.itemScopeOptions}
              selectedValue={section.selectedItemScopeId}
            />
            <DashboardSelect
              label="View"
              onChange={(value) => {
                if (value === 'top' || value === 'all') {
                  section.onViewModeChange(value)
                }
              }}
              options={[
                { label: 'Top items', value: 'top' },
                { label: 'All items', value: 'all' }
              ]}
              selectedValue={section.viewMode}
            />
            <DashboardNumberInput
              isDisabled={section.viewMode === 'all'}
              label="Top"
              min={1}
              onChange={(value) => section.onTopCountChange(value ?? 1)}
              value={section.topCount}
            />
            <DashboardSwitch
              isDisabled={section.viewMode === 'all'}
              isSelected={section.includeOther}
              label="Other"
              onValueChange={section.onIncludeOtherChange}
            />
          </div>
        }
        title={section.title}
      />
      <div className={styles.chartNote}>
        Period: {section.rangeLabel}. {section.noteText}
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
            Item list ({section.legendLabels.length})
          </summary>
          <PieLegend
            activeId={section.activeChartItemId}
            colors={section.legendColors}
            ids={section.legendIds}
            labels={section.legendLabels}
            onItemClick={section.onLegendItemSelect}
            valueFormatter={formatCompactIsk}
            values={section.legendValues}
          />
        </details>
      </div>
    </article>
  )
}
