'use client'

import { Suspense } from 'react'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'
import { NavigationProgress } from '@/components/layout/NavigationProgress'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {children}
      <Toaster position="bottom-right" richColors />
    </SessionProvider>
  )
}
