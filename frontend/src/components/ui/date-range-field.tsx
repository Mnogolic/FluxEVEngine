'use client'

import { useRef } from 'react'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import styles from '@/components/dashboard.module.css'
import type { Locale } from '@/lib/locale'
import type { DateRangeValue } from '@/types/dashboard'

interface DateRangeFieldProps {
  locale: Locale
  maxDate?: string
  minDate?: string
  onChange: (field: keyof DateRangeValue, value: string) => void
  range: DateRangeValue
}

interface DateInputFieldProps {
  ariaLabel: string
  clearLabel: string
  calendarLabel: string
  label: string
  max?: string
  min?: string
  onChange: (value: string) => void
  value: string
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className={styles.dateButtonIcon} fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" width="14" x="3" y="5" />
      <path d="M6.5 3.5V7M13.5 3.5V7M3 8.5H17" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg aria-hidden="true" className={styles.dateButtonIcon} fill="none" viewBox="0 0 20 20">
      <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function DateInputField({
  ariaLabel,
  calendarLabel,
  clearLabel,
  label,
  max,
  min,
  onChange,
  value
}: DateInputFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const openPicker = () => {
    const input = inputRef.current
    if (!input) {
      return
    }

    input.focus()
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }

  return (
    <div className={styles.dateField}>
      <span className="text-xs text-[#8b949e]">{label}</span>
      <div className={styles.dateInputWrap}>
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          className={styles.dateInput}
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={value}
        />
        {value ? (
          <button
            aria-label={clearLabel}
            className={styles.clearDateButton}
            onClick={() => onChange('')}
            type="button"
          >
            <ClearIcon />
          </button>
        ) : null}
        <button
          aria-label={calendarLabel}
          className={styles.datePickerButton}
          onClick={openPicker}
          type="button"
        >
          <CalendarIcon />
        </button>
      </div>
    </div>
  )
}

export function DateRangeField({ locale, maxDate, minDate, onChange, range }: DateRangeFieldProps) {
  const copy = getDashboardCopy(locale)

  return (
    <div className="flex flex-wrap items-start gap-2.5 self-start">
      <DateInputField
        ariaLabel={copy.dateRange.startDate}
        calendarLabel={copy.dateRange.calendar(copy.dateRange.from)}
        clearLabel={copy.dateRange.clearStartDate}
        label={copy.dateRange.from}
        max={range.to || maxDate}
        min={minDate}
        onChange={(value) => onChange('from', value)}
        value={range.from}
      />
      <DateInputField
        ariaLabel={copy.dateRange.endDate}
        calendarLabel={copy.dateRange.calendar(copy.dateRange.to)}
        clearLabel={copy.dateRange.clearEndDate}
        label={copy.dateRange.to}
        max={maxDate}
        min={range.from || minDate}
        onChange={(value) => onChange('to', value)}
        value={range.to}
      />
    </div>
  )
}
