import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db, CalendarEvent } from '../db/dexie';
import { getCurrentCacheWindow } from '../data/queries';

// Helper to clean and validate calendar event data from view
const cleanCalendarEvent = (data: any): CalendarEvent => {
  return {
    ...data,
    start_timestamp_ms: data.start_timestamp_ms || new Date(data.start_time).getTime(),
    end_timestamp_ms: data.end_timestamp_ms || (new Date(data.start_time).getTime() + ((data.duration || 0) * 60 * 1000)),
    following: data.following || false,
    ai_managed: data.ai_managed || false,
    ai_suggested: data.ai_suggested || false,
    show_time_as: data.show_time_as || 'busy',
    time_defense_level: data.time_defense_level || 'normal',
    user_role: data.user_role || 'viewer',
    history: Array.isArray(data.history) ? data.history : [],
  };
};

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

  // Calendar Events subscription - events table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'events',
    },
    async ({ eventType, old, new: newRecord }) => {

      try {
        if (eventType === 'DELETE') {
          // Remove event from Dexie for this user
          await db.calendar_events
            .where('id').equals(old.id)
            .and(event => event.viewing_user_id === userId)
            .delete();
        } else {
          // For INSERT or UPDATE, we need to refetch from the view to get the complete data
          // Only do this if the event affects this user (owner, creator, or has personal details)
          const shouldRefresh = (
            newRecord.owner_id === userId ||
            newRecord.creator_id === userId
          );

          if (shouldRefresh) {
            // Check if event falls within cache window
            const { startDate, endDate } = getCurrentCacheWindow();
            const eventStart = new Date(newRecord.start_time);

            if (eventStart >= startDate && eventStart <= endDate) {
              // Fetch complete event from view
              const { data: viewData, error } = await supabase
                .from('calendar_events_view')
                .select('*')
                .eq('id', newRecord.id)
                .eq('viewing_user_id', userId)
                .maybeSingle();

              if (!error && viewData) {
                await db.calendar_events.put(cleanCalendarEvent(viewData));
              }
            }
          }
        }

        // Invalidate React Query cache for calendar events
        invalidateQueries(['calendar-events', userId]);
      } catch (error) {
        console.error('Error handling events realtime update:', error);
      }
    }
  );

  // Calendar Events subscription - event_details_personal table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_details_personal',
      filter: `user_id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {

      try {
        if (eventType === 'DELETE') {
          // Refresh the event from view (personal details removed, but event might still be visible)
          const { data: viewData, error } = await supabase
            .from('calendar_events_view')
            .select('*')
            .eq('id', old.event_id)
            .eq('viewing_user_id', userId)
            .maybeSingle();

          if (!error && viewData) {
            await db.calendar_events.put(cleanCalendarEvent(viewData));
          } else {
            // Event no longer visible to user, remove from cache
            await db.calendar_events
              .where('id').equals(old.event_id)
              .and(event => event.viewing_user_id === userId)
              .delete();
          }
        } else {
          // For INSERT or UPDATE, fetch complete event from view
          const { data: viewData, error } = await supabase
            .from('calendar_events_view')
            .select('*')
            .eq('id', newRecord.event_id)
            .eq('viewing_user_id', userId)
            .maybeSingle();

          if (!error && viewData) {
            await db.calendar_events.put(cleanCalendarEvent(viewData));
          }
        }

        // Invalidate React Query cache for calendar events
        invalidateQueries(['calendar-events', userId]);
      } catch (error) {
        console.error('Error handling event_details_personal realtime update:', error);
      }
    }
  );

  // Subscribe to the channel
  channel.subscribe((status) => {
  });

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}

// Clear all Dexie data for a user (used on logout)
export async function clearUserData(userId: string) {
  try {

    // Clear all user-specific data
    await db.user_profiles.where('id').equals(userId).delete();
    await db.user_calendars.where('user_id').equals(userId).delete();
    await db.user_categories.where('user_id').equals(userId).delete();
    await db.calendar_events.where('viewing_user_id').equals(userId).delete();

  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}