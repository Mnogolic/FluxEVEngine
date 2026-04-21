'use client'

import { parseDate } from '@internationalized/date'
import { Button, DatePicker } from '@teach-in/react'
import styles from '@/components/dashboard.module.css'
import type { DateRangeValue } from '@/types/dashboard'

interface DashboardDateRangeProps {
  maxDate?: string
  minDate?: string
  onChange: (field: keyof DateRangeValue, value: string) => void
  range: DateRangeValue
}

function toCalendarDate(value?: string) {
  return value ? parseDate(value) : null
}

export function DashboardDateRange({
  maxDate,
  minDate,
  onChange,
  range
}: DashboardDateRangeProps) {
  const minValue = toCalendarDate(minDate)
  const maxValue = toCalendarDate(maxDate)
  const fromValue = toCalendarDate(range.from)
  const toValue = toCalendarDate(range.to)

  return (
    <div className={styles.dateRangeControls}>
      <div className={styles.controlField}>
        <span className={styles.controlCaption}>From</span>
        <div className={styles.heroDateField}>
          <DatePicker
            aria-label="Start date"
            calendarProps={{ showMonthAndYearPickers: true }}
            classNames={{
              base: 'min-w-[168px]',
              inputWrapper:
                'min-h-10 rounded-md border border-[#30363d] bg-[#21262d] shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff]',
              input: 'text-sm text-[#e6edf3]',
              segment: 'text-sm text-[#e6edf3] data-[placeholder=true]:text-[#8b949e]',
              selectorButton: 'text-[#8b949e]',
              selectorIcon: 'text-[#8b949e]',
              popoverContent: 'border border-[#30363d] bg-[#161b22] text-[#e6edf3]',
              calendarContent: 'bg-[#161b22] text-[#e6edf3]'
            }}
            granularity="day"
            maxValue={toValue ?? maxValue}
            minValue={minValue}
            value={fromValue}
            onChange={(value) => onChange('from', value?.toString() ?? '')}
          />
          {range.from ? (
            <Button
              isIconOnly
              aria-label="Clear start date"
              className={styles.dateClearButton}
              radius="full"
              size="sm"
              type="button"
              variant="light"
              onPress={() => onChange('from', '')}
            >
              ×
            </Button>
          ) : null}
        </div>
      </div>

      <div className={styles.controlField}>
        <span className={styles.controlCaption}>To</span>
        <div className={styles.heroDateField}>
          <DatePicker
            aria-label="End date"
            calendarProps={{ showMonthAndYearPickers: true }}
            classNames={{
              base: 'min-w-[168px]',
              inputWrapper:
                'min-h-10 rounded-md border border-[#30363d] bg-[#21262d] shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff]',
              input: 'text-sm text-[#e6edf3]',
              segment: 'text-sm text-[#e6edf3] data-[placeholder=true]:text-[#8b949e]',
              selectorButton: 'text-[#8b949e]',
              selectorIcon: 'text-[#8b949e]',
              popoverContent: 'border border-[#30363d] bg-[#161b22] text-[#e6edf3]',
              calendarContent: 'bg-[#161b22] text-[#e6edf3]'
            }}
            granularity="day"
            maxValue={maxValue}
            minValue={fromValue ?? minValue}
            value={toValue}
            onChange={(value) => onChange('to', value?.toString() ?? '')}
          />
          {range.to ? (
            <Button
              isIconOnly
              aria-label="Clear end date"
              className={styles.dateClearButton}
              radius="full"
              size="sm"
              type="button"
              variant="light"
              onPress={() => onChange('to', '')}
            >
              ×
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
