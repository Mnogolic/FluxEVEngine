'use client'

import styles from '@/components/dashboard.module.css'
import { PlotlyChart } from '@/components/plotly-chart'
import { ChartPanelHeader } from './chart-panel-header'
import { DashboardDateRange } from './dashboard-date-range'
import { PieLegend } from './pie-legend'
import { PIE_COLORS, PLOT_CONFIG } from './dashboard-utils'
import type { DashboardHubSectionModel } from './use-dashboard'

interface HubTurnoverSectionProps {
  section: DashboardHubSectionModel
}

export function HubTurnoverSection({ section }: HubTurnoverSectionProps) {
  return (
    <article className="min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px]">
      <div className="justify- flex flex-col">
        <div className="">
          <ChartPanelHeader
            controls={
              <DashboardDateRange
                maxDate={section.maxDate}
                minDate={section.minDate}
                onChange={section.onDateChange}
                range={section.dateRange}
              />
            }
            title="Trade Turnover by Hub (ISK)"
          />
          <div className={styles.chartNote}>Period: {section.rangeLabel}.</div>
          <div className={styles.chartShell}>
            <PlotlyChart
              className={styles.pieChart}
              config={PLOT_CONFIG}
              data={section.chart.data}
              layout={section.chart.layout}
            />
          </div>
        </div>
        <div>
          <PieLegend
            colors={PIE_COLORS}
            labels={section.labels}
            swatchGap={8}
            valueGap={6}
            values={section.values}
          />
        </div>
      </div>
    </article>
  )
}
