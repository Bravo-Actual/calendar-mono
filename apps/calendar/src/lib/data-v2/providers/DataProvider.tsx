// data-v2/providers/DataProvider.tsx - Central data provider with sync orchestration
'use client';

import { type ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { startSync, stopSync } from '../base/sync';
import { pullAIPersonas } from '../domains/ai-personas';
import { pullCalendars } from '../domains/calendars';
import { pullCategories } from '../domains/categories';
import { pullEventDetailsPersonal } from '../domains/event-details-personal';
import { pullEventRsvps } from '../domains/event-rsvps';
import { pullEventUsers } from '../domains/event-users';
import { pullEvents } from '../domains/events';
import { pullAnnotations } from '../domains/user-annotations';
import { pullUserProfiles } from '../domains/user-profiles';
import { pullUserWorkPeriods } from '../domains/user-work-periods';

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    async function initializeSync() {
      try {
        // Request persistent storage permission
        if (navigator?.storage?.persist) {
          const granted = await navigator.storage.persist();
          if (!granted) {
            console.warn('Persistent storage not granted - data may be cleared by browser');
          }
        }

        // Initial data pull
        if (user?.id) {
          await pullCategories(user.id);
          await pullCalendars(user.id);
          await pullUserProfiles(user.id);
          await pullUserWorkPeriods(user.id);
          await pullAIPersonas(user.id);
          await pullAnnotations(user.id);
          await pullEvents(user.id);
          await pullEventDetailsPersonal(user.id);
          await pullEventUsers(user.id);
          await pullEventRsvps(user.id);

          // Start sync orchestration (includes centralized realtime subscriptions)
          await startSync(user.id);
        }
      } catch (error) {
        console.error('Failed to initialize data provider:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });
      }
    }

    initializeSync();

    // Cleanup on user change or unmount
    return () => {
      // Stop sync (handles cleanup of centralized subscriptions)
      stopSync().catch((error) => {
        console.error('Error stopping sync:', error);
      });
    };
  }, [user]);

  // Clear data when user logs out
  useEffect(() => {
    if (!user?.id) {
      // TODO: Clear Dexie data for previous user
      // This prevents data leakage between users
    }
  }, [user?.id]);

  return <>{children}</>;
}
