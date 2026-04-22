'use client'

import styles from '@/components/dashboard.module.css'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { PlotlyChart } from '@/components/plotly-chart'
import { DateRangeField } from '@/components/ui/date-range-field'
import { NumberInputField } from '@/components/ui/number-input-field'
import { SwitchField } from '@/components/ui/switch-field'
import type { Locale } from '@/lib/locale'
import { ChartPanelHeader } from './chart-panel-header'
import { PLOT_CONFIG } from './dashboard-utils'
import type { DashboardForcastSectionModel } from './use-dashboard'

interface ForcastSectionProps {
  locale: Locale
  section: DashboardForcastSectionModel
}

export function ForcastSection({ locale, section }: ForcastSectionProps) {
  const copy = getDashboardCopy(locale)

  return (
    <article className="col-span-1 min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px] xl:col-span-2">
      <ChartPanelHeader
        controls={
          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex flex-wrap items-end justify-end gap-3">
              <DateRangeField
                locale={locale}
                maxDate={section.maxDate}
                minDate={section.minDate}
                onChange={section.onDateChange}
                range={section.dateRange}
              />
              <NumberInputField
                label={copy.predictDaysLabel}
                max={90}
                min={1}
                onChange={section.onForecastDaysChange}
                value={section.forecastDays}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {section.methodToggles.map((methodToggle) => (
                <SwitchField
                  ariaLabel={methodToggle.label}
                  key={methodToggle.id}
                  isSelected={methodToggle.isSelected}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: methodToggle.color }}
                      />
                      <span>{methodToggle.label}</span>
                    </span>
                  }
                  onValueChange={methodToggle.onSelectedChange}
                />
              ))}
            </div>
          </div>
        }
        title={copy.itemForecastModelsTitle}
      />
      <div className={styles.chartNote}>{section.noteText}</div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className={styles.meta}>
          {section.forecastError ? copy.chartError(section.forecastError) : null}
          {!section.forecastError && section.meta ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {section.meta.isFixedPrice ? (
                <span className={styles.fixedBadge}>{copy.fixedBadge}</span>
              ) : null}
              {section.meta.trainingDateFrom && section.meta.trainingDateTo ? (
                <span>
                  {copy.trainRange(section.meta.trainingDateFrom, section.meta.trainingDateTo)}
                </span>
              ) : null}
              {section.meta.trainingDateFrom && section.meta.trainingDateTo ? <span>|</span> : null}
              <span>{copy.trainingPoints(section.meta.trainingDataPointCount)}</span>
              <span>|</span>
              <span>{copy.actualPoints(section.meta.actualDataPointCount)}</span>
              {section.meta.bestMethodLabel ? <span>|</span> : null}
              {section.meta.bestMethodLabel ? (
                <span>{copy.bestValidationMae(section.meta.bestMethodLabel)}</span>
              ) : null}
            </div>
          ) : null}
          {!section.forecastError && !section.meta ? copy.noData : null}
        </div>
      </div>

      {!section.forecastError && section.meta?.methods.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {section.meta.methods.map((method) => (
            <div
              key={method.id}
              className="inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-[11px] leading-none font-[650]"
              style={{
                backgroundColor: `${method.color}14`,
                borderColor: `${method.color}66`,
                color: method.color
              }}
            >
              <span>{method.label}</span>
              {method.validationMae !== null ? (
                <span className="text-[#c9d1d9]">MAE {method.validationMae.toFixed(3)}</span>
              ) : null}
              {method.isBest ? <span className="text-[#f7e463]">{copy.bestBadge}</span> : null}
              {method.status === 'error' && method.error ? (
                <span className="text-[#ff7b72]">
                  {copy.errorPrefix}: {method.error}
                </span>
              ) : null}
              {method.status === 'ok' && method.warning ? (
                <span className="text-[#8b949e]">{method.warning}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.itemDetail}>
        {section.detailText ? (
          <div className={styles.itemDetailText}>{section.detailText}</div>
        ) : null}
        {section.isSelectedItemFixedInRegion ? (
          <div className={styles.itemDetailBadges}>
            <span className={styles.fixedBadge}>{copy.fixedPriceInRegionBadge}</span>
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
