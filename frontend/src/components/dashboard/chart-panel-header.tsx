import type { ReactNode } from 'react'
import styles from '@/components/dashboard.module.css'

interface ChartPanelHeaderProps {
  controls?: ReactNode
  title: string
}

export function ChartPanelHeader({ controls, title }: ChartPanelHeaderProps) {
  return (
    <div className={styles.chartHead}>
      <h2>{title}</h2>
      {controls}
    </div>
  )
}
