// data-v2/providers/DataProvider.tsx - Central data provider with sync orchestration
'use client';

import { useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { startSync, stopSync } from '../base/sync';
import { pullCategories, subscribeToCategoriesRealtime } from '../domains/categories';
import { pullCalendars, subscribeToCalendarsRealtime } from '../domains/calendars';
import { pullUserProfiles, subscribeToUserProfilesRealtime } from '../domains/user-profiles';

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return;

    let subscriptions: any[] = [];

    async function initializeSync() {
      try {
        // Request persistent storage permission
        if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
          const granted = await navigator.storage.persist();
          if (!granted) {
            console.warn('Persistent storage not granted - data may be cleared by browser');
          }
        }

        // Initial data pull
        await pullCategories(user!.id);
        await pullCalendars(user!.id);
        await pullUserProfiles(user!.id);

        // Set up real-time subscriptions
        const categoriesSubscription = subscribeToCategoriesRealtime(user!.id);
        const calendarsSubscription = subscribeToCalendarsRealtime(user!.id);
        const userProfilesSubscription = subscribeToUserProfilesRealtime(user!.id);
        subscriptions.push(categoriesSubscription, calendarsSubscription, userProfilesSubscription);

        // Start sync orchestration
        await startSync(user!.id);

      } catch (error) {
        console.error('Failed to initialize data provider:', error);
      }
    }

    initializeSync();

    // Cleanup on user change or unmount
    return () => {
      // Clean up subscriptions
      subscriptions.forEach(subscription => {
        subscription?.unsubscribe?.();
      });

      // Stop sync
      stopSync().catch(error => {
        console.error('Error stopping sync:', error);
      });
    };
  }, [user?.id]);

  // Clear data when user logs out
  useEffect(() => {
    if (!user?.id) {
      // TODO: Clear Dexie data for previous user
      // This prevents data leakage between users
    }
  }, [user?.id]);

  return <>{children}</>;
}