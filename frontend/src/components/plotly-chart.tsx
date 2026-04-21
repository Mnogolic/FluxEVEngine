'use client'

import { useEffect, useRef } from 'react'

type PlotData = Record<string, unknown>
type PlotLayout = Record<string, unknown>
type PlotConfig = Record<string, unknown>
type PlotClickPoint = { id?: string | number | null }
type PlotClickEvent = { points?: PlotClickPoint[] }

type PlotlyElement = HTMLDivElement & {
  on?: (eventName: string, handler: (event: PlotClickEvent) => void) => void
  removeAllListeners?: (eventName: string) => void
}

interface Props {
  className?: string
  config?: PlotConfig
  data: PlotData[]
  layout: PlotLayout
  onPointClick?: (pointId: string) => void
}

export function PlotlyChart({ className, config, data, layout, onPointClick }: Props) {
  const containerRef = useRef<PlotlyElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    let plotlyModule: {
      newPlot: (
        root: HTMLDivElement,
        plotData: PlotData[],
        plotLayout: PlotLayout,
        plotConfig?: PlotConfig
      ) => Promise<unknown>
      purge: (root: HTMLDivElement) => void
    } | null = null

    const renderChart = async () => {
      const importedModule = await import('plotly.js-dist-min')
      if (cancelled || !container) {
        return
      }

      const plotly = (importedModule.default ?? importedModule) as typeof plotlyModule
      if (!plotly) {
        return
      }

      plotlyModule = plotly
      await plotly.newPlot(container, data, layout, config)

      if (!container || !onPointClick) {
        return
      }

      container.removeAllListeners?.('plotly_click')
      container.on?.('plotly_click', (event) => {
        const pointId = event.points?.[0]?.id
        if (pointId === undefined || pointId === null || pointId === '') {
          return
        }

        onPointClick(String(pointId))
      })
    }

    void renderChart()

    return () => {
      cancelled = true
      if (plotlyModule && container) {
        plotlyModule.purge(container)
      }
    }
  }, [config, data, layout, onPointClick])

  return <div className={className} ref={containerRef} />
}
