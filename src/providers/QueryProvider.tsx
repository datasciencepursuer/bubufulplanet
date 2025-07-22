'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: How long data is considered fresh
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Cache time: How long data is kept in cache after being unused
            gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
            // Retry configuration
            retry: (failureCount, error: any) => {
              // Don't retry on 401/403 errors (auth issues)
              if (error?.status === 401 || error?.status === 403) {
                return false
              }
              return failureCount < 3
            },
            // Refetch configuration
            refetchOnWindowFocus: false, // Don't refetch when window gains focus
            refetchOnReconnect: true, // Refetch when reconnecting to internet
            // Error handling
            throwOnError: false, // Let components handle errors gracefully
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
            // Error handling for mutations
            throwOnError: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  )
}