'use client'

import { useEffect, useRef, useState } from 'react'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import { ForcastSection } from '@/components/dashboard/forcast-section'
import { HubTurnoverSection } from '@/components/dashboard/hub-turnover-section'
import { ItemPriceSection } from '@/components/dashboard/item-price-section'
import { ItemTurnoverSection } from '@/components/dashboard/item-turnover-section'
import { useDashboard } from '@/components/dashboard/use-dashboard'
import { LanguageSwitch } from '@/components/ui/language-switch'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locale'

export function Dashboard() {
  const priceChartSectionRef = useRef<HTMLElement | null>(null)
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  const copy = getDashboardCopy(locale)

  const {
    forcastSection,
    header,
    hubSection,
    isLoadingOverview,
    itemTurnoverSection,
    overviewError,
    priceSection
  } = useDashboard({
    locale,
    onPriceChartFocus: () => {
      priceChartSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  })

  useEffect(() => {
    const storedLocale = window.localStorage.getItem('fluxevengine-locale')
    if (isLocale(storedLocale)) {
      setLocale(storedLocale)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    window.localStorage.setItem('fluxevengine-locale', locale)
  }, [locale])

  return (
    <main className="mx-auto w-full max-w-[1480px] px-6 py-6">
      <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1.5 text-2xl leading-tight font-[650] text-[#58a6ff]">
            {copy.dashboardTitle}
          </h1>
          <p className="text-[13px] leading-5 text-[#8b949e]">
            {copy.headerSummary({
              lastUpdated: header.lastUpdated,
              plexIskText: header.plexIskText
            })}
          </p>
        </div>
        <LanguageSwitch locale={locale} onChange={setLocale} />
      </section>

      {overviewError ? (
        <section className="mb-4 rounded-lg border border-[rgba(248,81,73,0.45)] bg-[#161b22] px-4 py-3.5 text-[13px] leading-5 text-[#ff7b72]">
          {copy.overviewLoadError(overviewError)}
          <div>
            <button
              className="mt-2.5 cursor-pointer rounded-md border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-[13px] text-[#e6edf3]"
              onClick={() => window.location.reload()}
              type="button"
            >
              {copy.retry}
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <HubTurnoverSection locale={locale} section={hubSection} />
        <ItemTurnoverSection locale={locale} section={itemTurnoverSection} />
        <ItemPriceSection
          locale={locale}
          section={priceSection}
          sectionRef={priceChartSectionRef}
        />
        <ForcastSection locale={locale} section={forcastSection} />
      </section>

      {isLoadingOverview ? (
        <section className="mt-4 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3.5 text-[13px] leading-5 text-[#8b949e]">
          {copy.loadingOverview}
        </section>
      ) : null}
    </main>
  )
}
