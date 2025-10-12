'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type React from 'react';
import { useAppStore } from '@/store/app';

// Create a stable query client instance
// Used by AI chat system, auth context, and other legacy components
// that haven't been migrated to v2 data layer yet
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 3,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { devToolsVisible } = useAppStore();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {devToolsVisible && <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />}
    </QueryClientProvider>
  );
}

export default QueryProvider;
