import type { ReactNode } from 'react'

interface ChartPanelHeaderProps {
  controls?: ReactNode
  title: string
}

export function ChartPanelHeader({ controls, title }: ChartPanelHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[15px] leading-[1.35] font-[650] text-[#c9d1d9]">{title}</h2>
      {controls}
    </div>
  )
}
