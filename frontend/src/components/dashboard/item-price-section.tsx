'use client'

import type { RefObject } from 'react'
import styles from '@/components/dashboard.module.css'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { PlotlyChart } from '@/components/plotly-chart'
import { DateRangeField } from '@/components/ui/date-range-field'
import type { Locale } from '@/lib/locale'
import { ChartPanelHeader } from './chart-panel-header'
import { DashboardSelect } from './dashboard-select'
import { PLOT_CONFIG } from './dashboard-utils'
import type { DashboardPriceSectionModel } from './use-dashboard'

interface ItemPriceSectionProps {
  locale: Locale
  section: DashboardPriceSectionModel
  sectionRef: RefObject<HTMLElement | null>
}

export function ItemPriceSection({ locale, section, sectionRef }: ItemPriceSectionProps) {
  const copy = getDashboardCopy(locale)
  const selectedItemOption =
    section.itemOptions.find((option) => option.value === section.selectedTypeId) ?? null

  return (
    <article
      className="col-span-1 mt-5 min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px] xl:col-span-2"
      ref={sectionRef}
    >
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
        title={copy.priceHistoryTitle}
      />
      <div className={styles.chartNote}>
        {copy.periodLabel}: {section.rangeLabel}.
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <DashboardSelect
          className="w-full basis-full"
          label={copy.itemLabel}
          onChange={(value) => {
            if (value) {
              section.onTypeChange(value)
            }
          }}
          optionTextClassName="whitespace-normal break-words"
          options={section.itemOptions.map((option) => ({
            label: option.label,
            value: option.value
          }))}
          popoverContentClassName="max-w-[min(96vw,1280px)]"
          renderOption={(option) => {
            const optionMeta =
              section.itemOptions.find((itemOption) => itemOption.value === option.value) ?? null

            return (
              <div className={styles.selectOptionWrap}>
                <span
                  className={
                    optionMeta?.isFixedInRegion
                      ? `${styles.selectOptionLabel} ${styles.fixedOptionLabel}`
                      : styles.selectOptionLabel
                  }
                >
                  {option.label}
                </span>
                {optionMeta?.isFixedInRegion ? (
                  <span className={styles.fixedBadge}>{copy.fixedInRegionBadge}</span>
                ) : null}
              </div>
            )
          }}
          renderValue={() =>
            selectedItemOption ? (
              <div className={styles.selectValueWrap}>
                <span
                  className={
                    selectedItemOption.isFixedInRegion
                      ? styles.fixedSelectedValueLabel
                      : styles.selectValueLabel
                  }
                >
                  {selectedItemOption.label}
                </span>
                {selectedItemOption.isFixedInRegion ? (
                  <span className={styles.fixedBadge}>{copy.fixedInRegionBadge}</span>
                ) : null}
              </div>
            ) : null
          }
          selectedValue={section.selectedTypeId}
          valueClassName="overflow-visible"
        />
        <DashboardSelect
          className="w-[160px] min-w-[140px] flex-[0_1_160px]"
          label={copy.regionLabel}
          onChange={(value) => {
            const regionId = Number(value)
            if (Number.isFinite(regionId)) {
              section.onRegionChange(regionId)
            }
          }}
          options={section.regionOptions}
          selectedValue={String(section.selectedRegionId)}
        />
        <div className={styles.meta}>
          {section.priceError ? copy.chartError(section.priceError) : null}
          {!section.priceError && section.meta ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {section.meta.isFixedPrice ? (
                <span className={styles.fixedBadge}>{copy.fixedBadge}</span>
              ) : null}
              <span className={section.meta.trendUp ? styles.trendUp : styles.trendDown}>
                {section.meta.trendText}
              </span>
              <span>|</span>
              <span>R2 {section.meta.r2.toFixed(3)}</span>
              <span>|</span>
              <span>{copy.dataPoints(section.meta.dataPointCount)}</span>
            </div>
          ) : null}
          {!section.priceError && !section.meta ? copy.noData : null}
        </div>
      </div>

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
