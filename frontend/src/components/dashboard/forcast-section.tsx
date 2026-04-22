'use client'

import styles from '@/components/dashboard.module.css'
import { PlotlyChart } from '@/components/plotly-chart'
import { ChartPanelHeader } from './chart-panel-header'
import { DashboardDateRange } from './dashboard-date-range'
import { DashboardNumberInput } from './dashboard-number-input'
import { PLOT_CONFIG } from './dashboard-utils'
import type { DashboardForcastSectionModel } from './use-dashboard'

interface ForcastSectionProps {
  section: DashboardForcastSectionModel
}

export function ForcastSection({ section }: ForcastSectionProps) {
  return (
    <article className="col-span-1 min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px] xl:col-span-2">
      <ChartPanelHeader
        controls={
          <div className="flex shrink-0 flex-wrap items-end gap-3">
            <DashboardDateRange
              className="shrink-0"
              maxDate={section.maxDate}
              minDate={section.minDate}
              onChange={section.onDateChange}
              range={section.dateRange}
            />
            <DashboardNumberInput
              label="Predict days"
              max={90}
              min={1}
              onChange={section.onForecastDaysChange}
              value={section.forecastDays}
            />
          </div>
        }
        title="Item Forecast Models"
      />
      <div className={styles.chartNote}>{section.noteText}</div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className={styles.meta}>
          {section.forecastError ? `Chart error: ${section.forecastError}` : null}
          {!section.forecastError && section.meta ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {section.meta.isFixedPrice ? <span className={styles.fixedBadge}>FIXED</span> : null}
              {section.meta.trainingDateFrom && section.meta.trainingDateTo ? (
                <span>
                  Train {section.meta.trainingDateFrom} to {section.meta.trainingDateTo}
                </span>
              ) : null}
              {section.meta.trainingDateFrom && section.meta.trainingDateTo ? <span>|</span> : null}
              <span className={section.meta.trendUp ? styles.trendUp : styles.trendDown}>
                {section.meta.trendText}
              </span>
              <span>|</span>
              <span>R2 {section.meta.r2.toFixed(3)}</span>
              <span>|</span>
              <span>{section.meta.trainingDataPointCount} train pts</span>
              <span>|</span>
              <span>{section.meta.actualDataPointCount} actual pts</span>
            </div>
          ) : null}
          {!section.forecastError && !section.meta ? 'No data' : null}
        </div>
      </div>

      <div className={styles.itemDetail}>
        {section.detailText ? (
          <div className={styles.itemDetailText}>{section.detailText}</div>
        ) : null}
        {section.isSelectedItemFixedInRegion ? (
          <div className={styles.itemDetailBadges}>
            <span className={styles.fixedBadge}>FIXED PRICE IN THIS REGION</span>
          </div>
        ) : null}
      </div>

      <PlotlyChart
        className={styles.priceChart}
        config={PLOT_CONFIG}
        data={section.chart.data}
        layout={section.chart.layout}
      />
    </article>
  )
}
