'use client'

import styles from '@/components/dashboard.module.css'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { PlotlyChart } from '@/components/plotly-chart'
import { DateRangeField } from '@/components/ui/date-range-field'
import type { Locale } from '@/lib/locale'
import { ChartPanelHeader } from './chart-panel-header'
import { PieLegend } from './pie-legend'
import { PIE_COLORS, PLOT_CONFIG } from './dashboard-utils'
import type { DashboardHubSectionModel } from './use-dashboard'

interface HubTurnoverSectionProps {
  locale: Locale
  section: DashboardHubSectionModel
}

export function HubTurnoverSection({ locale, section }: HubTurnoverSectionProps) {
  const copy = getDashboardCopy(locale)

  return (
    <article className="min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px]">
      <div className="justify- flex flex-col">
        <div className="">
          <ChartPanelHeader
            controls={
              <DateRangeField
                locale={locale}
                maxDate={section.maxDate}
                minDate={section.minDate}
                onChange={section.onDateChange}
                range={section.dateRange}
              />
            }
            title={copy.hubTurnoverTitle}
          />
          <div className={styles.chartNote}>
            {copy.periodLabel}: {section.rangeLabel}.
          </div>
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
            locale={locale}
            swatchGap={8}
            valueGap={6}
            values={section.values}
          />
        </div>
      </div>
    </article>
  )
}
