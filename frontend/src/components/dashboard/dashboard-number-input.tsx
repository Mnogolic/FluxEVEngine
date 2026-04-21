'use client'

import { NumberInput } from '@teach-in/react'
import styles from '@/components/dashboard.module.css'

interface DashboardNumberInputProps {
  isDisabled?: boolean
  label: string
  max?: number
  min?: number
  onChange: (value: number | null) => void
  value: number | null
}

export function DashboardNumberInput({
  isDisabled,
  label,
  max,
  min,
  onChange,
  value
}: DashboardNumberInputProps) {
  return (
    <div className={styles.controlField}>
      <span className={styles.controlCaption}>{label}</span>
      <NumberInput
        classNames={{
          base: 'w-[92px]',
          inputWrapper:
            'min-h-10 rounded-md border border-[#30363d] bg-[#21262d] shadow-none transition-colors data-[hover=true]:border-[#58a6ff] data-[focus=true]:border-[#58a6ff]',
          input: 'text-sm text-[#e6edf3]',
          stepperButton: 'text-[#8b949e]'
        }}
        hideStepper={false}
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
