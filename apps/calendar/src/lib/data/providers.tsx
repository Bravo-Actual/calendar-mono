/**
 * TanStack Query + Realtime Providers
 * Implementation of GPT plan's provider pattern with persistence
 */

'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient, makePersister, initializeStoragePersistence } from './base/persist';
import { startRealtime } from '../realtime/subscriptions';
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DataProvidersProps {
  children: React.ReactNode;
}

export function DataProviders({ children }: DataProvidersProps) {
  const { user } = useAuth();

  // Create persister with per-user namespacing (GPT plan pattern)
  const persister = useMemo(() => makePersister(user?.id), [user?.id]);

  // Initialize persistent storage on mount
  useEffect(() => {
    initializeStoragePersistence();
  }, []);

  // Start realtime subscriptions when user logs in
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 Starting realtime subscriptions for user:', user.id);
    const cleanup = startRealtime(user.id, queryClient);

    return () => {
      console.log('🔄 Cleaning up realtime subscriptions');
      cleanup();
    };
  }, [user?.id]);

  // Clear cache on user change
  useEffect(() => {
    if (user?.id) {
      // User logged in - cache will be restored from persister
      console.log('👤 User logged in, cache will be restored');
    } else {
      // User logged out - clear cache
      console.log('👤 User logged out, clearing cache');
      queryClient.clear();
    }
  }, [user?.id]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: 'app-v3' // Increment to clear cache on breaking changes
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </PersistQueryClientProvider>
  );
}