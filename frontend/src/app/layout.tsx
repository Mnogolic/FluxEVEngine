import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { UIProvider } from '@/components/providers/ui-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'FluxEVEngine',
  description: 'Рыночный дашборд FluxEVEngine'
}

interface Props {
  children: ReactNode
}

export default function RootLayout({ children }: Props) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  )
}
