import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { db, UserProfile, UserCalendar, UserCategory, UserWorkPeriod } from './base/dexie';
import { supabase } from '@/lib/supabase';
import type { EventCategory } from '@/components/types';
import type { Database, Json } from '@repo/supabase';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { useEffect } from 'react';

// Transformed types for backwards compatibility with existing components
export interface UserEventCalendar {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory;
  type: 'default' | 'archive' | 'user';
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserEventCategory {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// Helper to clean and validate data from Supabase before storing in Dexie
const cleanUserProfile = (data: any): UserProfile => {
  return {
    ...data,
    timezone: data.timezone || 'UTC',
    time_format: data.time_format || '12_hour',
    week_start_day: data.week_start_day || '0',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
};

const cleanUserCalendar = (data: any): UserCalendar => {
  return {
    ...data,
    color: data.color || 'neutral',
    type: data.type,
    visible: data.visible !== false, // Default to true if not explicitly false
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
};

const cleanUserCategory = (data: any): UserCategory => {
  return {
    ...data,
    color: data.color || 'neutral',
    is_default: data.is_default || false,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
};

// User Profile Hook (same API as existing useUserProfile)
export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, display_name, avatar_url, slug, timezone, time_format, week_start_day, title, organization, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Clean and validate data before storing
      const cleanedProfile = cleanUserProfile(data);

      // Store in Dexie for offline access
      await db.user_profiles.put(cleanedProfile);

      return cleanedProfile;
    },
    // Offline-first: show cached data immediately (no initialData due to async nature)
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// User Calendars Hook (same API as existing useUserCalendars)
export function useUserCalendars(userId: string | undefined) {
  return useQuery({
    queryKey: ['userCalendars', userId],
    queryFn: async (): Promise<UserEventCalendar[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('type', { ascending: true }) // Default calendar first ('default' < 'user')
        .order('name');

      if (error) throw error;

      // Clean and validate data
      const cleanedCalendars = (data || []).map(cleanUserCalendar);

      // Store in Dexie for offline access
      if (cleanedCalendars.length > 0) {
        await db.user_calendars.bulkPut(cleanedCalendars);
      }

      // Transform to expected component type (like old hook)
      return cleanedCalendars.map(calendar => ({
        ...calendar,
        color: calendar.color || 'neutral' as EventCategory,
        type: calendar.type,
        visible: calendar.visible !== false,
        created_at: calendar.created_at || '',
        updated_at: calendar.updated_at || ''
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// User Categories Hook (same API as existing useEventCategories)
export function useUserCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ['userCategories', userId],
    queryFn: async (): Promise<UserEventCategory[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;

      // Clean and validate data
      const cleanedCategories = (data || []).map(cleanUserCategory);

      // Store in Dexie for offline access
      if (cleanedCategories.length > 0) {
        await db.user_categories.bulkPut(cleanedCategories);
      }

      // Return as is for categories (they already match expected type)
      return cleanedCategories;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// For backwards compatibility, also export with the existing name pattern
export const useEventCategories = useUserCategories;

// ============================================================================
// CALENDAR EVENTS - Intelligent Caching with Sliding Window
// ============================================================================

// Date range constants for efficient client-side storage
const PAST_DAYS_TO_KEEP = 30;   // Last 30 days
const FUTURE_DAYS_TO_KEEP = 90; // Next 90 days
const TOTAL_CACHE_WINDOW = 120; // Total days to keep locally

// Get the current cache window
export function getCurrentCacheWindow() {
  const now = new Date();
  const startDate = addDays(now, -PAST_DAYS_TO_KEEP);
  const endDate = addDays(now, FUTURE_DAYS_TO_KEEP);
  return { startDate, endDate };
}

// Transform view data to CalendarEvent (with validation)
const cleanCalendarEvent = (data: any): CalendarEvent => {
  return {
    ...data,
    // The view already provides computed timestamp fields, just ensure defaults for nullable fields
    following: data.following || false,
    ai_managed: data.ai_managed || false,
    ai_suggested: data.ai_suggested || false,
    show_time_as: data.show_time_as || 'busy',
    time_defense_level: data.time_defense_level || 'normal',
    user_role: data.user_role || 'viewer',
    history: data.history || [],
  };
};

// Calendar Events Hook - replaces complex useCalendarEvents with intelligent caching
export function useCalendarEvents({
  userId,
  startDate,
  endDate,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
}: {
  userId: string | undefined;
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
  staleTime?: number;
}) {

  const { startDate: cacheStart, endDate: cacheEnd } = getCurrentCacheWindow();

  // Determine if requested range is outside our cache window
  const isOutsideCacheWindow =
    startDate < cacheStart || endDate > cacheEnd;



  const queryKey = [
    'calendar-events',
    userId,
    startOfDay(startDate).toISOString(),
    endOfDay(endDate).toISOString(),
  ];


  const query = useQuery({
    queryKey: userId ? queryKey : ['calendar-events-disabled'], // Different key when disabled
    refetchOnMount: true, // Force refetch on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!userId) throw new Error('User ID is required');

      // If outside cache window, fetch directly without caching
      if (isOutsideCacheWindow) {

        const { data, error } = await supabase
          .from('calendar_events_view')
          .select('*')
          .eq('viewing_user_id', userId)
          .gte('start_time', startOfDay(startDate).toISOString())
          .lte('start_time', endOfDay(endDate).toISOString())
          .order('start_time');

        if (error) throw error;

        // Don't store in Dexie - just return for this query
        return (data || []).map(cleanCalendarEvent);
      }

      // For cache window requests, fetch the entire cache window
      // This ensures we have a consistent 120-day sliding window

      const { data, error } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('viewing_user_id', userId)
        .gte('start_time', startOfDay(cacheStart).toISOString())
        .lte('start_time', endOfDay(cacheEnd).toISOString())
        .order('start_time');

      if (error) {
        console.error('❌ Error fetching events:', error);
        throw error;
      }

      const cleanedEvents = (data || []).map(cleanCalendarEvent);

      // Replace entire cache window in Dexie (atomic operation)
      await db.transaction('rw', db.calendar_events, async () => {
        // Clear existing events for this user
        await db.calendar_events
          .where('viewing_user_id')
          .equals(userId)
          .delete();

        // Store new cache window
        if (cleanedEvents.length > 0) {
          await db.calendar_events.bulkPut(cleanedEvents);
        }
      });

      // Return only the requested subset
      const requestedStartMs = startOfDay(startDate).getTime();
      const requestedEndMs = endOfDay(endDate).getTime();


      const filteredEvents = cleanedEvents.filter(event => {
        const inRange = event.start_time_ms >= requestedStartMs &&
                       event.start_time_ms <= requestedEndMs;
        return inRange;
      });

      return filteredEvents;
    },

    // Note: We removed initialData to avoid Promise issues.
    // The query will load from server and then sync to Dexie.

    enabled: enabled && !!userId,
    staleTime: 0, // Force fresh data every time for debugging
    gcTime: isOutsideCacheWindow ? 1000 : 10 * 60 * 1000, // Quick GC for historical data
  });


  return query;
}

// Background cache window maintenance
export function useCacheWindowMaintenance(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Run maintenance every hour to keep cache window current
    const interval = setInterval(async () => {
      const { startDate, endDate } = getCurrentCacheWindow();

      // Check if we need to update the cache window
      const userEvents = await db.calendar_events
        .where('viewing_user_id').equals(userId)
        .toArray();

      if (userEvents.length === 0) return;

      const oldestCached = userEvents.reduce((min, event) =>
        event.start_time_ms < min.start_time_ms ? event : min
      );

      const newestCached = userEvents.reduce((max, event) =>
        event.start_time_ms > max.start_time_ms ? event : max
      );

      if (oldestCached && newestCached) {
        const cacheStartMs = startOfDay(startDate).getTime();
        const cacheEndMs = endOfDay(endDate).getTime();

        // If cache window has shifted significantly, refresh
        if (
          oldestCached.start_time_ms < cacheStartMs - (7 * 24 * 60 * 60 * 1000) || // 7 days old
          newestCached.start_time_ms < cacheEndMs - (7 * 24 * 60 * 60 * 1000)
        ) {

          // Invalidate current cache window to trigger refresh
          queryClient.invalidateQueries({
            queryKey: ['calendar-events', userId],
            predicate: (query) => {
              const [, , startDateStr] = query.queryKey;
              if (typeof startDateStr === 'string') {
                const queryStart = new Date(startDateStr);
                return queryStart >= startDate && queryStart <= endDate;
              }
              return false;
            }
          });
        }
      }
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, [userId, queryClient]);
}

// Utility function to invalidate calendar events for date ranges
export function useInvalidateCalendarEvents() {
  const queryClient = useQueryClient();

  return (userId?: string, startDate?: Date, endDate?: Date) => {
    if (startDate && endDate && userId) {
      // Invalidate specific date range
      queryClient.invalidateQueries({
        queryKey: [
          'calendar-events',
          userId,
          startOfDay(startDate).toISOString(),
          endOfDay(endDate).toISOString(),
        ],
      });
    } else {
      // Invalidate all calendar events for this user
      queryClient.invalidateQueries({
        queryKey: ['calendar-events', userId],
      });
    }
  };
}

// ============================================================================
// CALENDAR EVENT MUTATIONS - Optimistic Updates
// ============================================================================

// Create Event Hook
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: Omit<CalendarEvent, 'id' | 'start_time_ms' | 'end_time_ms' | 'created_at' | 'updated_at'>) => {
      // Insert into the base events table, not the view
      const eventInsert: Database['public']['Tables']['events']['Insert'] = {
        owner_id: eventData.owner_id,
        creator_id: eventData.creator_id,
        series_id: eventData.series_id,
        title: eventData.title,
        agenda: eventData.agenda,
        online_event: eventData.online_event,
        online_join_link: eventData.online_join_link,
        online_chat_link: eventData.online_chat_link,
        in_person: eventData.in_person,
        start_time: eventData.start_time,
        duration: eventData.duration,
        all_day: eventData.all_day,
        private: eventData.private,
        request_responses: eventData.request_responses,
        allow_forwarding: eventData.allow_forwarding,
        invite_allow_reschedule_proposals: eventData.invite_allow_reschedule_proposals,
        hide_attendees: eventData.hide_attendees,
        history: eventData.history as Json,
        discovery: eventData.discovery as Database['public']['Enums']['event_discovery_types'],
        join_model: eventData.join_model as Database['public']['Enums']['event_join_model_types'],
      };

      const { data: eventResult, error: eventError } = await supabase
        .from('events')
        .insert(eventInsert)
        .select()
        .single();

      if (eventError) throw eventError;

      // If there are user-specific fields, insert into event_details_personal
      if (eventData.calendar_id || eventData.category_id || eventData.show_time_as !== 'busy' || eventData.time_defense_level !== 'normal' || eventData.ai_managed || eventData.ai_instructions) {
        const personalInsert: Database['public']['Tables']['event_details_personal']['Insert'] = {
          event_id: eventResult.id,
          user_id: eventData.viewing_user_id,
          calendar_id: eventData.calendar_id,
          category_id: eventData.category_id,
          show_time_as: eventData.show_time_as as Database['public']['Enums']['show_time_as_extended'],
          time_defense_level: eventData.time_defense_level as Database['public']['Enums']['time_defense_level'],
          ai_managed: eventData.ai_managed,
          ai_instructions: eventData.ai_instructions,
        };

        const { error: personalError } = await supabase
          .from('event_details_personal')
          .insert(personalInsert);

        if (personalError) throw personalError;
      }

      // Fetch the complete event from the view
      const { data: viewData, error: viewError } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', eventResult.id)
        .eq('viewing_user_id', eventData.viewing_user_id)
        .single();

      if (viewError) throw viewError;
      return cleanCalendarEvent(viewData);
    },

    onMutate: async (newEvent) => {
      // Create optimistic event with temporary ID
      const optimisticEvent: CalendarEvent = {
        ...newEvent,
        id: `temp-${Date.now()}`,
        start_time_ms: new Date(newEvent.start_time).getTime(),
        end_time_ms: new Date(newEvent.start_time).getTime() + (newEvent.duration * 60 * 1000),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['calendar-events', newEvent.viewing_user_id] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueriesData({
        queryKey: ['calendar-events', newEvent.viewing_user_id],
      });

      // Optimistically update cache
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', newEvent.viewing_user_id] },
        (old: CalendarEvent[] | undefined) => old ? [...old, optimisticEvent] : [optimisticEvent]
      );

      // Update Dexie optimistically
      try {
        await db.calendar_events.put(optimisticEvent);
      } catch (err) {
        console.warn('Failed to update Dexie optimistically:', err);
      }

      return { previousEvents, optimisticEvent };
    },

    onError: (err, newEvent, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Remove from Dexie
      if (context?.optimisticEvent) {
        db.calendar_events.delete(context.optimisticEvent.id).catch(console.warn);
      }
    },

    onSuccess: (data, variables, context) => {
      // Replace optimistic event with real data
      if (context?.optimisticEvent) {
        queryClient.setQueriesData(
          { queryKey: ['calendar-events', variables.viewing_user_id] },
          (old: CalendarEvent[] | undefined) =>
            old?.map(event => event.id === context.optimisticEvent.id ? data : event) || [data]
        );

        // Update Dexie with real data
        db.calendar_events.put(data).catch(console.warn);
        db.calendar_events.delete(context.optimisticEvent.id).catch(console.warn);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['calendar-events', variables.viewing_user_id],
      });
    },
  });
}

// Update Event Hook
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CalendarEvent> }) => {
      // Update the base event table
      const eventUpdates: Record<string, any> = {};

      // Map CalendarEvent fields to events table fields
      if (updates.title !== undefined) eventUpdates.title = updates.title;
      if (updates.agenda !== undefined) eventUpdates.agenda = updates.agenda;
      if (updates.online_event !== undefined) eventUpdates.online_event = updates.online_event;
      if (updates.online_join_link !== undefined) eventUpdates.online_join_link = updates.online_join_link;
      if (updates.online_chat_link !== undefined) eventUpdates.online_chat_link = updates.online_chat_link;
      if (updates.in_person !== undefined) eventUpdates.in_person = updates.in_person;
      if (updates.start_time !== undefined) eventUpdates.start_time = updates.start_time;
      if (updates.duration !== undefined) eventUpdates.duration = updates.duration;
      if (updates.all_day !== undefined) eventUpdates.all_day = updates.all_day;
      if (updates.private !== undefined) eventUpdates.private = updates.private;
      if (updates.request_responses !== undefined) eventUpdates.request_responses = updates.request_responses;
      if (updates.allow_forwarding !== undefined) eventUpdates.allow_forwarding = updates.allow_forwarding;
      if (updates.invite_allow_reschedule_proposals !== undefined) eventUpdates.invite_allow_reschedule_proposals = updates.invite_allow_reschedule_proposals;
      if (updates.hide_attendees !== undefined) eventUpdates.hide_attendees = updates.hide_attendees;
      if (updates.history !== undefined) eventUpdates.history = updates.history;
      if (updates.discovery !== undefined) eventUpdates.discovery = updates.discovery;
      if (updates.join_model !== undefined) eventUpdates.join_model = updates.join_model;

      // Update events table if there are event-level changes
      if (Object.keys(eventUpdates).length > 0) {
        eventUpdates.updated_at = new Date().toISOString();

        const { error: eventError } = await supabase
          .from('events')
          .update(eventUpdates)
          .eq('id', id);

        if (eventError) throw eventError;
      }

      // Handle personal details updates
      const personalUpdates: Record<string, any> = {};
      if (updates.calendar_id !== undefined) personalUpdates.calendar_id = updates.calendar_id;
      if (updates.category_id !== undefined) personalUpdates.category_id = updates.category_id;
      if (updates.show_time_as !== undefined) personalUpdates.show_time_as = updates.show_time_as;
      if (updates.time_defense_level !== undefined) personalUpdates.time_defense_level = updates.time_defense_level;
      if (updates.ai_managed !== undefined) personalUpdates.ai_managed = updates.ai_managed;
      if (updates.ai_instructions !== undefined) personalUpdates.ai_instructions = updates.ai_instructions;

      if (Object.keys(personalUpdates).length > 0 && updates.viewing_user_id) {
        personalUpdates.updated_at = new Date().toISOString();

        // Try to update existing record, if not exists, insert
        const { error: personalError } = await supabase
          .from('event_details_personal')
          .upsert({
            event_id: id,
            user_id: updates.viewing_user_id,
            ...personalUpdates,
          });

        if (personalError) throw personalError;
      }

      // Fetch the updated event from the view
      const { data: viewData, error: viewError } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', id)
        .eq('viewing_user_id', updates.viewing_user_id!)
        .single();

      if (viewError) throw viewError;
      return cleanCalendarEvent(viewData);
    },

    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['calendar-events'] });

      // Get current event from cache
      const currentEvent = queryClient.getQueriesData({
        queryKey: ['calendar-events'],
      }).flatMap(([, data]) => data as CalendarEvent[] || [])
       .find(event => event.id === id);

      if (!currentEvent) return;

      // Create optimistic updated event
      const optimisticEvent: CalendarEvent = {
        ...currentEvent,
        ...updates,
        start_time_ms: updates.start_time ? new Date(updates.start_time).getTime() : currentEvent.start_time_ms,
        end_time_ms: updates.start_time || updates.duration
          ? new Date(updates.start_time || currentEvent.start_time).getTime() + ((updates.duration || currentEvent.duration) * 60 * 1000)
          : currentEvent.end_time_ms,
        updated_at: new Date().toISOString(),
      };

      // Snapshot previous queries
      const previousEvents = queryClient.getQueriesData({
        queryKey: ['calendar-events', currentEvent.viewing_user_id],
      });

      // Optimistically update cache
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', currentEvent.viewing_user_id] },
        (old: CalendarEvent[] | undefined) =>
          old?.map(event => event.id === id ? optimisticEvent : event) || []
      );

      // Update Dexie optimistically
      try {
        await db.calendar_events.put(optimisticEvent);
      } catch (err) {
        console.warn('Failed to update Dexie optimistically:', err);
      }

      return { previousEvents, optimisticEvent, originalEvent: currentEvent };
    },

    onError: (err, { id }, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Rollback Dexie
      if (context?.originalEvent) {
        db.calendar_events.put(context.originalEvent).catch(console.warn);
      }
    },

    onSuccess: (data, { id }, context) => {
      // Update with real data
      if (context?.originalEvent) {
        queryClient.setQueriesData(
          { queryKey: ['calendar-events', context.originalEvent.viewing_user_id] },
          (old: CalendarEvent[] | undefined) =>
            old?.map(event => event.id === id ? data : event) || []
        );

        // Update Dexie with real data
        db.calendar_events.put(data).catch(console.warn);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['calendar-events'],
      });
    },
  });
}

// Delete Event Hook
export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },

    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['calendar-events'] });

      // Get current event from cache
      const currentEvent = queryClient.getQueriesData({
        queryKey: ['calendar-events'],
      }).flatMap(([, data]) => data as CalendarEvent[] || [])
       .find(event => event.id === id);

      if (!currentEvent) return;

      // Snapshot previous queries
      const previousEvents = queryClient.getQueriesData({
        queryKey: ['calendar-events', currentEvent.viewing_user_id],
      });

      // Optimistically remove from cache
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', currentEvent.viewing_user_id] },
        (old: CalendarEvent[] | undefined) =>
          old?.filter(event => event.id !== id) || []
      );

      // Remove from Dexie optimistically
      try {
        await db.calendar_events.delete(id);
      } catch (err) {
        console.warn('Failed to update Dexie optimistically:', err);
      }

      return { previousEvents, deletedEvent: currentEvent };
    },

    onError: (err, id, context) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Rollback Dexie
      if (context?.deletedEvent) {
        db.calendar_events.put(context.deletedEvent).catch(console.warn);
      }
    },

    onSuccess: (id, variables, context) => {
      // Confirm deletion
      if (context?.deletedEvent) {
        queryClient.invalidateQueries({
          queryKey: ['calendar-events', context.deletedEvent.viewing_user_id],
        });
      }
    },
  });
}

// Category Creation (Offline-first with Dexie + Supabase)
export function useCreateUserCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; name: string; color: EventCategory }): Promise<UserEventCategory> => {
      const { userId, name, color } = data;

      // Create in Supabase first
      const { data: result, error } = await supabase
        .from('user_categories')
        .insert({
          user_id: userId,
          name,
          color,
        })
        .select()
        .single();

      if (error) throw error;

      // Clean and store in Dexie
      const cleanedCategory = cleanUserCategory(result);
      await db.user_categories.put(cleanedCategory);

      return cleanedCategory;
    },

    onSuccess: (newCategory) => {
      // Invalidate and refetch categories
      queryClient.invalidateQueries({
        queryKey: ['userCategories', newCategory.user_id],
      });
    },

    onError: (error: Error & { code?: string }) => {
      console.error('Failed to create category:', error);
    },
  });
}

// Category Update (Offline-first with Dexie + Supabase)
export function useUpdateUserCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; id: string; name?: string; color?: EventCategory }): Promise<UserEventCategory> => {
      const { userId, id, name, color } = data;

      const updateData: { name?: string; color?: EventCategory } = {};
      if (name !== undefined) updateData.name = name;
      if (color !== undefined) updateData.color = color;

      // Update in Supabase first
      const { data: result, error } = await supabase
        .from('user_categories')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Clean and store in Dexie
      const cleanedCategory = cleanUserCategory(result);
      await db.user_categories.put(cleanedCategory);

      return cleanedCategory;
    },

    onSuccess: (updatedCategory) => {
      queryClient.invalidateQueries({
        queryKey: ['userCategories', updatedCategory.user_id],
      });
    },

    onError: (error: Error & { code?: string }) => {
      console.error('Failed to update category:', error);
    },
  });
}

// Category Delete (Offline-first with Dexie + Supabase)
export function useDeleteUserCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; categoryId: string }): Promise<void> => {
      const { userId, categoryId } = data;

      // First check if this is the default category
      const { data: category, error: fetchError } = await supabase
        .from('user_categories')
        .select('is_default')
        .eq('id', categoryId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      if (category?.is_default) {
        throw new Error('Cannot delete the default category');
      }

      // Find the default category to reassign events to
      const { data: defaultCategory, error: defaultError } = await supabase
        .from('user_categories')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (defaultError) throw defaultError;

      // Update all event_details_personal records that reference this category
      // to use the default category instead
      const { error: updateError } = await supabase
        .from('event_details_personal')
        .update({ category_id: defaultCategory.id })
        .eq('category_id', categoryId)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Delete from Supabase
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) throw error;

      // Delete from Dexie
      await db.user_categories.delete(categoryId);
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['userCategories', variables.userId],
      });
      // Also invalidate events queries since events may have been reassigned to default category
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },

    onError: (error: Error) => {
      console.error('Failed to delete category:', error);
    },
  });
}

// User Work Periods Hook
export function useUserWorkPeriods(userId: string | undefined) {
  return useQuery({
    queryKey: ['userWorkPeriods', userId],
    queryFn: async (): Promise<UserWorkPeriod[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_work_periods')
        .select('*')
        .eq('user_id', userId)
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const periods = data || [];

      // Store in Dexie for offline access
      if (periods.length > 0) {
        await db.user_work_periods.bulkPut(periods);
      }

      return periods;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Save User Work Periods Mutation
export function useSaveUserWorkPeriods() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      workPeriods,
    }: {
      userId: string;
      workPeriods: Array<{
        weekday: number;
        start_time: string;
        end_time: string;
      }>;
    }) => {
      // Delete existing work periods for this user
      const { error: deleteError } = await supabase
        .from('user_work_periods')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new work periods if any
      if (workPeriods.length > 0) {
        const periodsToInsert = workPeriods.map(period => ({
          user_id: userId,
          weekday: period.weekday,
          start_time: period.start_time,
          end_time: period.end_time,
        }));

        const { error: insertError, data } = await supabase
          .from('user_work_periods')
          .insert(periodsToInsert)
          .select();

        if (insertError) throw insertError;

        // Update Dexie
        if (data) {
          await db.user_work_periods.bulkPut(data);
        }
      } else {
        // Clear from Dexie if no periods
        await db.user_work_periods.where('user_id').equals(userId).delete();
      }

      return workPeriods;
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['userWorkPeriods', variables.userId],
      });
    },

    onError: (error: Error) => {
      console.error('Failed to save work periods:', error);
    },
  });
}