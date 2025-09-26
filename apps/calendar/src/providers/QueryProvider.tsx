'use client';

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { startRealtime } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';

// Create a stable query client instance
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

function DataLayerBootstrap({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Start realtime subscriptions for this user
    let unsubscribe: (() => void) | undefined;

    (async () => {
      unsubscribe = await startRealtime(user.id, queryClient);
    })();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  return <>{children}</>;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataLayerBootstrap>
        {children}
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
      </DataLayerBootstrap>
    </QueryClientProvider>
  );
}

export default QueryProvider;