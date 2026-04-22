'use client'

import { Number as DashboardNumber } from '@teach-in/react'

interface NumberInputFieldProps {
  isDisabled?: boolean
  label: string
  max?: number
  min?: number
  onChange: (value: number | null) => void
  value: number | null
}

export function NumberInputField({
  isDisabled,
  label,
  max,
  min,
  onChange,
  value
}: NumberInputFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 self-start">
      <span className="text-xs text-[#8b949e]">{label}</span>
      <DashboardNumber
        classNames={{
          base: 'w-[92px] self-start',
          inputWrapper:
            'relative flex min-h-10 items-stretch rounded-md border border-[#30363d] bg-[#21262d] pl-3 pr-2 shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff]',
          innerWrapper: 'flex min-w-0 flex-1 items-center',
          input: 'w-full min-w-0 text-sm text-[#e6edf3]',
          stepperWrapper: 'flex h-full shrink-0 flex-col justify-center self-stretch ps-1',
          stepperButton: 'flex h-5 w-5 items-center justify-center text-[#8b949e]'
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
