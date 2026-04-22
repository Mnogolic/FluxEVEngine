'use client'

import dynamic from 'next/dynamic'

const Dashboard = dynamic(
  () => import('@/components/dashboard').then((module) => module.Dashboard),
  {
    ssr: false,
    loading: () => null
  }
)

export function HomePageClient() {
  return <Dashboard />
}
