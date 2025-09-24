import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db, Event, EventDetailsPersonal, EventUserRole, UserProfile, UserCalendar, UserCategory, UserWorkPeriod, AIPersona } from '../data/base/dexie';
import { keys } from '../data/base/keys';

// Surgical cache update helpers (GPT plan pattern)
const surgicalCacheUpdate = (queryClient: QueryClient, queryKey: string[], updater: (oldData: any[] | undefined) => any[] | undefined) => {
  queryClient.setQueriesData({ queryKey }, updater);
};

const patchEventLists = (queryClient: QueryClient, userId: string, eventId: string, patcher: (event: any) => any) => {
  queryClient.setQueriesData(
    { queryKey: (k: any) => Array.isArray(k) && k[0] === 'events' && k[1]?.uid === userId },
    (oldData: any[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(event => event.id === eventId ? patcher(event) : event);
    }
  );
};

// Start realtime subscriptions for all base tables
export function startRealtime(userId: string, queryClient: QueryClient) {
  // Single channel for all user-related tables
  const channel = supabase.channel('rt:user-core');

  // User Profiles subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_profiles',
      filter: `id=eq.${userId}`,
    },
    async ({ eventType, new: newRecord }) => {
      try {
        if (eventType === 'UPDATE') {
          await db.user_profiles.put(newRecord as UserProfile);
        }

        invalidateQueries(queryClient, keys.profile(userId));
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
          // Store the complete record from database
          await db.user_calendars.put(newRecord as UserCalendar);
        }

        invalidateQueries(queryClient, keys.calendars(userId));
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
          await db.user_categories.put(newRecord as UserCategory);
        }

        // Invalidate with new key structure
        // Use surgical cache update instead of broad invalidation
        surgicalCacheUpdate(queryClient, keys.categories(userId), (oldData) => {
          if (!oldData) return oldData;
          if (eventType === 'DELETE') {
            return oldData.filter(item => item.id !== old.id);
          } else {
            const exists = oldData.find(item => item.id === newRecord.id);
            return exists
              ? oldData.map(item => item.id === newRecord.id ? newRecord : item)
              : [...oldData, newRecord];
          }
        });
      } catch (error) {
        console.error('Error handling user_categories realtime update:', error);
      }
    }
  );

  // User Work Periods subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_work_periods',
      filter: `user_id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {
      try {
        if (eventType === 'DELETE') {
          await db.user_work_periods.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          await db.user_work_periods.put(newRecord as UserWorkPeriod);
        }

        invalidateQueries(queryClient, keys.workPeriods(userId));
      } catch (error) {
        console.error('Error handling user_work_periods realtime update:', error);
      }
    }
  );

  // AI Personas subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'ai_personas',
      filter: `user_id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {
      try {
        if (eventType === 'DELETE') {
          await db.ai_personas.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          await db.ai_personas.put(newRecord as AIPersona);
        }

        invalidateQueries(queryClient, keys.personas(userId));
      } catch (error) {
        console.error('Error handling ai_personas realtime update:', error);
      }
    }
  );

  // Events table subscription (base table)
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
          await db.events.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // Only store if user has access (owner or creator)
          const hasAccess = (
            newRecord.owner_id === userId ||
            newRecord.creator_id === userId
          );

          if (hasAccess) {
            await db.events.put(newRecord as Event);
          }
        }

        // Invalidate all event-related queries
        invalidateQueries(queryClient, keys.events(userId));
        invalidateQueries(queryClient, keys.eventDetails(userId));
      } catch (error) {
        console.error('Error handling events realtime update:', error);
      }
    }
  );

  // Event Details Personal subscription (base table)
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
          await db.event_details_personal.delete([old.event_id, old.user_id]);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          await db.event_details_personal.put(newRecord as EventDetailsPersonal);
        }

        // Surgical updates instead of broad invalidations
        surgicalCacheUpdate(queryClient, keys.eventDetails(userId), (oldData) => {
          if (!oldData) return oldData;
          if (eventType === 'DELETE') {
            return oldData.filter(item => !(item.event_id === old.event_id && item.user_id === old.user_id));
          } else {
            const exists = oldData.find(item => item.event_id === newRecord.event_id && item.user_id === newRecord.user_id);
            return exists
              ? oldData.map(item =>
                  item.event_id === newRecord.event_id && item.user_id === newRecord.user_id ? newRecord : item
                )
              : [...oldData, newRecord];
          }
        });

        // Also patch assembled event lists with personal details changes
        patchEventLists(queryClient, userId, newRecord?.event_id || old?.event_id, (event) => ({
          ...event,
          calendar_id: newRecord?.calendar_id || null,
          category_id: newRecord?.category_id || null,
          show_time_as: newRecord?.show_time_as || null,
          time_defense_level: newRecord?.time_defense_level || null,
          ai_managed: newRecord?.ai_managed || null,
          ai_instructions: newRecord?.ai_instructions || null,
        }));
      } catch (error) {
        console.error('Error handling event_details_personal realtime update:', error);
      }
    }
  );

  // Event User Roles subscription (base table)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_user_roles',
      filter: `user_id=eq.${userId}`,
    },
    async ({ eventType, old, new: newRecord }) => {
      try {
        if (eventType === 'DELETE') {
          await db.event_user_roles.delete(old.id);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          await db.event_user_roles.put(newRecord as EventUserRole);
        }

        invalidateQueries(queryClient, keys.eventRoles(userId));
        invalidateQueries(queryClient, keys.events(userId));
      } catch (error) {
        console.error('Error handling event_user_roles realtime update:', error);
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
    // Clear all user-specific data from base tables
    await db.user_profiles.where('id').equals(userId).delete();
    await db.user_calendars.where('user_id').equals(userId).delete();
    await db.user_categories.where('user_id').equals(userId).delete();
    await db.user_work_periods.where('user_id').equals(userId).delete();
    await db.ai_personas.where('user_id').equals(userId).delete();

    // Clear event-related data
    await db.events.where('owner_id').equals(userId).delete();
    await db.events.where('creator_id').equals(userId).delete();
    await db.event_details_personal.where('user_id').equals(userId).delete();
    await db.event_user_roles.where('user_id').equals(userId).delete();
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}