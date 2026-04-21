'use client'

import { Select, SelectItem } from '@teach-in/react'
import styles from '@/components/dashboard.module.css'

export interface DashboardSelectOption {
  description?: string
  label: string
  value: string
}

interface DashboardSelectProps {
  className?: string
  isDisabled?: boolean
  label: string
  onChange: (value: string) => void
  options: DashboardSelectOption[]
  placeholder?: string
  selectedValue?: string | null
}

export function DashboardSelect({
  className,
  isDisabled,
  label,
  onChange,
  options,
  placeholder,
  selectedValue
}: DashboardSelectProps) {
  return (
    <div className={`${styles.controlField} ${className ?? ''}`.trim()}>
      <span className={styles.controlCaption}>{label}</span>
      <Select
        aria-label={label}
        classNames={{
          base: 'min-w-[220px]',
          trigger:
            'min-h-10 rounded-md border border-[#30363d] bg-[#21262d] px-3 shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff]',
          value: 'text-sm text-[#e6edf3]',
          selectorIcon: 'text-[#8b949e]',
          popoverContent: 'border border-[#30363d] bg-[#161b22] text-[#e6edf3]',
          listbox: 'bg-[#161b22]'
        }}
        isClearable={false}
        isDisabled={isDisabled}
        placeholder={placeholder}
        selectedKeys={selectedValue ? [selectedValue] : []}
        size="sm"
        variant="bordered"
        onSelectionChange={(keys) => {
          if (keys === 'all') {
            return
          }

          const nextValue = Array.from(keys)[0]
          if (typeof nextValue === 'string') {
            onChange(nextValue)
          }
        }}
      >
        {options.map((option) => (
          <SelectItem key={option.value} description={option.description} textValue={option.label}>
            {option.label}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}
