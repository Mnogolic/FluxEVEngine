'use client'

import { useRef } from 'react'
import styles from '@/components/dashboard.module.css'
import type { DateRangeValue } from '@/types/dashboard'

interface DashboardDateRangeProps {
  className?: string
  maxDate?: string
  minDate?: string
  onChange: (field: keyof DateRangeValue, value: string) => void
  range: DateRangeValue
}

interface DashboardDateInputProps {
  ariaLabel: string
  clearLabel: string
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

function DashboardDateInput({
  ariaLabel,
  clearLabel,
  label,
  max,
  min,
  onChange,
  value
}: DashboardDateInputProps) {
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
          aria-label={`${label} calendar`}
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

export function DashboardDateRange({
  className,
  maxDate,
  minDate,
  onChange,
  range
}: DashboardDateRangeProps) {
  return (
    <div className={['flex flex-wrap items-center gap-2.5', className ?? ''].join(' ').trim()}>
      <DashboardDateInput
        ariaLabel="Start date"
        clearLabel="Clear start date"
        label="From"
        max={range.to || maxDate}
        min={minDate}
        onChange={(value) => onChange('from', value)}
        value={range.from}
      />
      <DashboardDateInput
        ariaLabel="End date"
        clearLabel="Clear end date"
        label="To"
        max={maxDate}
        min={range.from || minDate}
        onChange={(value) => onChange('to', value)}
        value={range.to}
      />
    </div>
  )
}
