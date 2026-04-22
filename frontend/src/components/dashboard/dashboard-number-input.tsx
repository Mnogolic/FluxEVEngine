'use client'

import { Number as DashboardNumber } from '@teach-in/react'

interface DashboardNumberInputProps {
  className?: string
  isDisabled?: boolean
  label: string
  max?: number
  min?: number
  onChange: (value: number | null) => void
  value: number | null
}

export function DashboardNumberInput({
  className,
  isDisabled,
  label,
  max,
  min,
  onChange,
  value
}: DashboardNumberInputProps) {
  return (
    <div className={['flex min-w-0 flex-col gap-1.5', className ?? ''].join(' ').trim()}>
      <span className="text-xs text-[#8b949e]">{label}</span>
      <DashboardNumber
        classNames={{
          base: 'w-[92px]',
          inputWrapper:
            'min-h-10 rounded-md border border-[#30363d] bg-[#21262d] pl-3 pr-10 shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff] relative flex items-center',
          input: 'text-sm text-[#e6edf3]',
          stepperButton: 'text-[#8b949e]'
        }}
        isClearable={false}
        isDisabled={isDisabled}
        max={max}
        min={min}
        size="sm"
        step={1}
        value={value}
        variant="bordered"
        onChange={onChange}
      />
    </div>
  )
}
