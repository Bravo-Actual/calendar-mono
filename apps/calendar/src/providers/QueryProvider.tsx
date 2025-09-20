"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            refetchOnWindowFocus: false,
            retry: (failureCount, error: Error & { status?: number }) => {
              // Don't retry on auth errors
              if (error?.status === 401) return false;
              return failureCount < 3;
            },
          },
          mutations: {
            retry: (failureCount, error: Error & { status?: number }) => {
              // Don't retry on auth errors
              if (error?.status === 401) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools
        initialIsOpen={false}
        buttonPosition="top-right"
      />
    </QueryClientProvider>
  );
}