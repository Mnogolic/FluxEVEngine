'use client'

import { Switch } from '@teach-in/react'

interface DashboardSwitchProps {
  className?: string
  isDisabled?: boolean
  isSelected: boolean
  label: string
  onValueChange: (value: boolean) => void
}

export function DashboardSwitch({
  className,
  isDisabled,
  isSelected,
  label,
  onValueChange
}: DashboardSwitchProps) {
  return (
    <div className={['flex min-w-0 flex-col', className ?? ''].join(' ').trim()}>
      <span className="text-xs text-[#8b949e]">{label}</span>
      <Switch
        aria-label={label}
        classNames={{
          base: 'min-h-10',
          wrapper: 'group-data-[selected=true]:bg-[#58a6ff]'
        }}
        isDisabled={isDisabled}
        isSelected={isSelected}
        size="sm"
        onValueChange={onValueChange}
      />
    </div>
  )
}
