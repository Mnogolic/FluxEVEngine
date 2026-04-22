'use client'

import { useRef } from 'react'
import { ForcastSection } from '@/components/dashboard/forcast-section'
import { HubTurnoverSection } from '@/components/dashboard/hub-turnover-section'
import { ItemPriceSection } from '@/components/dashboard/item-price-section'
import { ItemTurnoverSection } from '@/components/dashboard/item-turnover-section'
import { useDashboard } from '@/components/dashboard/use-dashboard'

export function Dashboard() {
  const priceChartSectionRef = useRef<HTMLElement | null>(null)

  const {
    forcastSection,
    header,
    hubSection,
    isLoadingOverview,
    itemTurnoverSection,
    overviewError,
    priceSection
  } = useDashboard({
    onPriceChartFocus: () => {
      priceChartSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  })

  return (
    <main className="mx-auto w-full max-w-[1480px] px-6 py-6">
      <h1 className="mb-1.5 text-2xl leading-tight font-[650] text-[#58a6ff]">
        FluxEV Engine - Market Overview
      </h1>
      <p className="mb-6 text-[13px] leading-5 text-[#8b949e]">
        {`Data from ESI Tranquility | Last update: ${header.lastUpdated} | PLEX: ${header.plexIskText} ISK`}
      </p>

      {overviewError ? (
        <section className="mb-4 rounded-lg border border-[rgba(248,81,73,0.45)] bg-[#161b22] px-4 py-3.5 text-[13px] leading-5 text-[#ff7b72]">
          Failed to load dashboard overview: {overviewError}
          <div>
            <button
              className="mt-2.5 cursor-pointer rounded-md border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-[13px] text-[#e6edf3]"
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <HubTurnoverSection section={hubSection} />
        <ItemTurnoverSection section={itemTurnoverSection} />
        <ItemPriceSection section={priceSection} sectionRef={priceChartSectionRef} />
        <ForcastSection section={forcastSection} />
      </section>

      {isLoadingOverview ? (
        <section className="mt-4 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3.5 text-[13px] leading-5 text-[#8b949e]">
          Loading dashboard overview...
        </section>
      ) : null}
    </main>
  )
}
