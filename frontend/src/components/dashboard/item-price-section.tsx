'use client'

import type { RefObject } from 'react'
import styles from '@/components/dashboard.module.css'
import { PlotlyChart } from '@/components/plotly-chart'
import { ChartPanelHeader } from './chart-panel-header'
import { DashboardDateRange } from './dashboard-date-range'
import { DashboardSelect } from './dashboard-select'
import { PLOT_CONFIG } from './dashboard-utils'
import type { DashboardPriceSectionModel } from './use-dashboard'

interface ItemPriceSectionProps {
  section: DashboardPriceSectionModel
  sectionRef: RefObject<HTMLElement | null>
}

export function ItemPriceSection({ section, sectionRef }: ItemPriceSectionProps) {
  const selectedItemOption =
    section.itemOptions.find((option) => option.value === section.selectedTypeId) ?? null

  return (
    <article
      className="col-span-1 mt-5 min-w-0 rounded-lg border border-[#30363d] bg-[#161b22] p-[18px] xl:col-span-2"
      ref={sectionRef}
    >
      <ChartPanelHeader
        controls={
          <DashboardDateRange
            className="shrink-0"
            maxDate={section.maxDate}
            minDate={section.minDate}
            onChange={section.onDateChange}
            range={section.dateRange}
          />
        }
        title="Selected Item Price History"
      />
      <div className={styles.chartNote}>Period: {section.rangeLabel}.</div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <DashboardSelect
          className="w-full basis-full"
          label="Item"
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
                  <span className={styles.fixedBadge}>FIXED IN REGION</span>
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
                  <span className={styles.fixedBadge}>FIXED IN REGION</span>
                ) : null}
              </div>
            ) : null
          }
          selectedValue={section.selectedTypeId}
          valueClassName="overflow-visible"
        />
        <DashboardSelect
          className="w-[160px] min-w-[140px] flex-[0_1_160px]"
          label="Region"
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
          {section.priceError ? `Chart error: ${section.priceError}` : null}
          {!section.priceError && section.meta ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {section.meta.isFixedPrice ? <span className={styles.fixedBadge}>FIXED</span> : null}
              <span className={section.meta.trendUp ? styles.trendUp : styles.trendDown}>
                {section.meta.trendText}
              </span>
              <span>|</span>
              <span>R2 {section.meta.r2.toFixed(3)}</span>
              <span>|</span>
              <span>{section.meta.dataPointCount} pts</span>
            </div>
          ) : null}
          {!section.priceError && !section.meta ? 'No data' : null}
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
