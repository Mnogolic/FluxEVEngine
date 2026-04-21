'use client'

import { Switch } from '@teach-in/react'
import styles from '@/components/dashboard.module.css'

interface DashboardSwitchProps {
  isDisabled?: boolean
  isSelected: boolean
  label: string
  onValueChange: (value: boolean) => void
}

export function DashboardSwitch({
  isDisabled,
  isSelected,
  label,
  onValueChange
}: DashboardSwitchProps) {
  return (
    <Switch
      classNames={{
        base: styles.switchField,
        label: 'text-xs text-[#8b949e]',
        wrapper: 'group-data-[selected=true]:bg-[#58a6ff]'
      }}
      isDisabled={isDisabled}
      isSelected={isSelected}
      size="sm"
      onValueChange={onValueChange}
    >
      {label}
    </Switch>
  )
}
