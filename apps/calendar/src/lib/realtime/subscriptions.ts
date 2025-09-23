import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../db/dexie';

// Start realtime subscriptions for user data
export function startRealtime(userId: string, queryClient: QueryClient) {
  // Single channel for all user-related tables
  const channel = supabase.channel('rt:user-core');

  const invalidateQueries = (queryKey: string[]) => {
    queryClient.invalidateQueries({ queryKey });
  };

  // User Profiles subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_profiles',
      filter: `id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {
      console.log('Realtime: user_profiles change', { eventType, old, new: newRecord });

      try {
        if (eventType === 'DELETE') {
          await db.user_profiles.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // Clean the data before storing
          const cleanedData = {
            ...newRecord,
            timezone: newRecord.timezone || 'UTC',
            time_format: newRecord.time_format || '12_hour',
            week_start_day: newRecord.week_start_day || '0',
            created_at: newRecord.created_at || new Date().toISOString(),
            updated_at: newRecord.updated_at || new Date().toISOString(),
          };
          await db.user_profiles.put(cleanedData);
        }

        // Invalidate React Query cache
        invalidateQueries(['userProfile', userId]);
      } catch (error) {
        console.error('Error handling user_profiles realtime update:', error);
      }
    }
  );

  // User Calendars subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_calendars',
      filter: `user_id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {
      console.log('Realtime: user_calendars change', { eventType, old, new: newRecord });

      try {
        if (eventType === 'DELETE') {
          await db.user_calendars.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // Clean the data before storing
          const cleanedData = {
            ...newRecord,
            color: newRecord.color || 'neutral',
            is_default: newRecord.is_default || false,
            visible: newRecord.visible !== false,
            created_at: newRecord.created_at || new Date().toISOString(),
            updated_at: newRecord.updated_at || new Date().toISOString(),
          };
          await db.user_calendars.put(cleanedData);
        }

        // Invalidate React Query cache
        invalidateQueries(['userCalendars', userId]);
      } catch (error) {
        console.error('Error handling user_calendars realtime update:', error);
      }
    }
  );

  // User Categories subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_categories',
      filter: `user_id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {
      console.log('Realtime: user_categories change', { eventType, old, new: newRecord });

      try {
        if (eventType === 'DELETE') {
          await db.user_categories.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // Clean the data before storing
          const cleanedData = {
            ...newRecord,
            color: newRecord.color || 'neutral',
            is_default: newRecord.is_default || false,
            created_at: newRecord.created_at || new Date().toISOString(),
            updated_at: newRecord.updated_at || new Date().toISOString(),
          };
          await db.user_categories.put(cleanedData);
        }

        // Invalidate React Query cache
        invalidateQueries(['userCategories', userId]);
        // Also invalidate the legacy query key for backwards compatibility
        invalidateQueries(['eventCategories', userId]);
      } catch (error) {
        console.error('Error handling user_categories realtime update:', error);
      }
    }
  );

  // Subscribe to the channel
  channel.subscribe((status) => {
    console.log('Realtime subscription status:', status);
  });

  // Return cleanup function
  return () => {
    console.log('Cleaning up realtime subscriptions');
    supabase.removeChannel(channel);
  };
}

// Clear all Dexie data for a user (used on logout)
export async function clearUserData(userId: string) {
  try {
    console.log('Clearing user data from Dexie for user:', userId);

    // Clear all user-specific data
    await db.user_profiles.where('id').equals(userId).delete();
    await db.user_calendars.where('user_id').equals(userId).delete();
    await db.user_categories.where('user_id').equals(userId).delete();

    console.log('User data cleared successfully');
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}