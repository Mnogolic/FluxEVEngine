'use client'

import type { ReactNode } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { TeachInUIProvider } from '@teach-in/react'
import { ThemeProvider } from '@/components/providers/theme-provider'

interface UIProviderProps {
  children: ReactNode
}

declare module '@react-types/shared' {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>['push']>[1]>
  }
}

export function UIProvider({ children }: UIProviderProps) {
  const router = useRouter()

  const navigate = (path: string, options?: Parameters<typeof router.push>[1]) => {
    router.push(path as Route<string>, options)
  }

  return (
    <TeachInUIProvider navigate={navigate} toastProviderProps={{ placement: 'top-right' }}>
      <ThemeProvider>{children}</ThemeProvider>
    </TeachInUIProvider>
  )
}
