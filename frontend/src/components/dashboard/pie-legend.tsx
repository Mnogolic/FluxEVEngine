import type { CSSProperties } from 'react'
import styles from '@/components/dashboard.module.css'
import { getIntlLocale, type Locale } from '@/lib/locale'

interface PieLegendProps {
  activeId?: string | null
  colors: string[]
  ids?: string[]
  labels: string[]
  locale: Locale
  onItemClick?: (id: string) => void
  swatchGap?: number | string
  valueFormatter?: (value: number) => string
  valueGap?: number | string
  values: number[]
}

function formatShare(value: number, locale: Locale): string {
  return Number(value).toLocaleString(getIntlLocale(locale), {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3
  })
}

function getShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  return values.map((value) => (total ? (value / total) * 100 : 0))
}

function toCssSize(value?: number | string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return typeof value === 'number' ? `${value}px` : value
}

export function PieLegend({
  activeId,
  colors,
  ids,
  labels,
  locale,
  onItemClick,
  swatchGap,
  valueFormatter,
  valueGap,
  values
}: PieLegendProps) {
  const shares = getShares(values)
  const spacingStyle = {
    '--legend-swatch-gap': toCssSize(swatchGap),
    '--legend-value-gap': toCssSize(valueGap)
  } as CSSProperties

  return (
    <div className={styles.legendGrid}>
      {labels.map((label, index) => {
        const suffix = valueFormatter ? ` - ${valueFormatter(values[index])}` : ''
        const legendId = ids?.[index] ?? label
        const isActive = activeId !== null && activeId !== undefined && legendId === activeId
        const LegendItemTag = onItemClick ? 'button' : 'div'

        return (
          <LegendItemTag
            className={`${styles.legendItem} ${isActive ? styles.legendItemActive : ''} ${
              onItemClick ? styles.legendItemButton : ''
            }`}
            key={`${label}-${index}`}
            onClick={onItemClick ? () => onItemClick(legendId) : undefined}
            style={spacingStyle}
            title={label}
            {...(onItemClick ? { type: 'button' as const } : {})}
          >
            <span className={styles.legendContent}>
              <span
                className={styles.legendSwatch}
                style={{ background: colors[index % colors.length] }}
              />
              <span className={styles.legendName}>{label}</span>
              <span className={styles.legendShare}>
                {formatShare(shares[index], locale)}%{suffix}
              </span>
            </span>
          </LegendItemTag>
        )
      })}
    </div>
  )
}
