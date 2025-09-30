// data-v2/providers/DataProvider.tsx - Central data provider with sync orchestration
'use client';

import { type ReactNode, useEffect, useRef } from 'react';
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
import { clearAllData } from '../realtime/subscriptions';

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);

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

  // Handle user changes (including sign-out and user switching)
  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;

    // If we had a previous user and now have a different user (or no user), clear all data
    // This is more thorough and prevents any cross-user contamination
    if (previousUserId && previousUserId !== currentUserId) {
      clearAllData().catch((error) => {
        console.warn('Error clearing data during user change:', error);
      });
    }

    // Update the ref to track the current user
    previousUserIdRef.current = currentUserId;
  }, [user?.id]);

  return <>{children}</>;
}
