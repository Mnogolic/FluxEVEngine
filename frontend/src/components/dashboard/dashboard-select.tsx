'use client'

import type { ReactNode } from 'react'
import { Select, SelectItem } from '@teach-in/react'

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
  optionTextClassName?: string
  options: DashboardSelectOption[]
  placeholder?: string
  popoverContentClassName?: string
  renderOption?: (option: DashboardSelectOption) => ReactNode
  renderValue?: (option: DashboardSelectOption | null) => ReactNode
  selectedValue?: string | null
  valueClassName?: string
}

export function DashboardSelect({
  className,
  isDisabled,
  label,
  onChange,
  optionTextClassName,
  options,
  placeholder,
  popoverContentClassName,
  renderOption,
  renderValue,
  selectedValue,
  valueClassName
}: DashboardSelectProps) {
  const selectedOption =
    selectedValue !== null && selectedValue !== undefined
      ? (options.find((option) => option.value === selectedValue) ?? null)
      : null

  return (
    <div
      className={['flex max-w-full min-w-[180px] flex-col gap-1.5', className ?? '']
        .join(' ')
        .trim()}
    >
      <span className="text-xs text-[#8b949e]">{label}</span>
      <Select
        aria-label={label}
        classNames={{
          base: 'w-full min-w-0 max-w-full',
          trigger:
            'min-h-10 w-full min-w-0 max-w-full rounded-md border border-[#30363d] bg-[#21262d] pl-3 pr-10 shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff] relative flex flex-row items-center group',
          innerWrapper: 'w-full h-fit flex items-center gap-1.5',
          value: [
            'flex items-center min-w-0 w-full text-sm',
            valueClassName ?? 'truncate text-[#e6edf3]'
          ]
            .join(' ')
            .trim(),
          selectorIcon: 'text-[#8b949e] absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4',
          popoverContent: [
            'border border-[#30363d] bg-[#161b22] text-[#e6edf3]',
            popoverContentClassName ?? 'max-w-[min(92vw,420px)]'
          ]
            .join(' ')
            .trim(),
          listbox: 'bg-[#161b22]',
          listboxWrapper: 'max-h-[320px]'
        }}
        isDisabled={isDisabled}
        items={options.map((option) => ({ key: option.value, label: option.label }))}
        placeholder={placeholder}
        renderValue={renderValue ? () => renderValue(selectedOption) : undefined}
        selectedKeys={selectedValue ? [selectedValue] : undefined}
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
            {renderOption ? (
              renderOption(option)
            ) : (
              <span
                className={['block max-w-full truncate', optionTextClassName ?? '']
                  .join(' ')
                  .trim()}
                title={option.label}
              >
                {option.label}
              </span>
            )}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}
