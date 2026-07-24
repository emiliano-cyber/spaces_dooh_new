'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth-context'
import { instalarCsrf } from '@/lib/csrf-client'
import { instalarIndicadorCarga } from '@/lib/loading-fetch'
import { IndicadorCarga } from '@/components/IndicadorCarga'

export function Providers({ children }: { children: React.ReactNode }) {
  // Parcha window.fetch, una sola vez y lo antes posible en el cliente: primero
  // el double-submit anti-CSRF, luego el contador de carga (que lo envuelve).
  if (typeof window !== 'undefined') {
    instalarCsrf()
    instalarIndicadorCarga()
  }

  // Create a new QueryClient per component instance so the cache is NOT shared
  // between different users' server-side renders (singleton would leak stale data).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <IndicadorCarga />
    </QueryClientProvider>
  )
}
