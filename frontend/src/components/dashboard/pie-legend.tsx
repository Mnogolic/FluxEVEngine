import styles from '@/components/dashboard.module.css'

interface PieLegendProps {
  activeId?: string | null
  colors: string[]
  ids?: string[]
  labels: string[]
  valueFormatter?: (value: number) => string
  values: number[]
}

function formatShare(value: number): string {
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3
  })
}

function getShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  return values.map((value) => (total ? (value / total) * 100 : 0))
}

export function PieLegend({
  activeId,
  colors,
  ids,
  labels,
  valueFormatter,
  values
}: PieLegendProps) {
  const shares = getShares(values)

  return (
    <div className={styles.legendGrid}>
      {labels.map((label, index) => {
        const suffix = valueFormatter ? ` - ${valueFormatter(values[index])}` : ''
        const legendId = ids?.[index] ?? label
        const isActive = activeId !== null && activeId !== undefined && legendId === activeId

        return (
          <div
            className={`${styles.legendItem} ${isActive ? styles.legendItemActive : ''}`}
            key={`${label}-${index}`}
            title={label}
          >
            <span
              className={styles.legendSwatch}
              style={{ background: colors[index % colors.length] }}
            />
            <span className={styles.legendName}>{label}</span>
            <span className={styles.legendShare}>
              {formatShare(shares[index])}%{suffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}
