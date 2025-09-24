/**
 * Client-Side Event Assembly
 * Combines base tables to create complete calendar events
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { keys } from './keys';
import { mapEventFromServer } from './mapping';
import type { Event, EventDetailsPersonal, EventUserRole, UserCalendar, UserCategory } from './dexie';

// Complete assembled event interface
export interface AssembledEvent {
  // Core event fields (from events table)
  id: string;
  owner_id: string;
  creator_id: string;
  series_id?: string | null;
  title: string;
  agenda?: string | null;
  online_event: boolean;
  online_join_link?: string | null;
  online_chat_link?: string | null;
  in_person: boolean;
  start_time: string;
  end_time: string;
  all_day: boolean;

  // Pre-computed millisecond fields (from client Event type)
  start_time_ms: number;
  end_time_ms: number;
  private: boolean;
  request_responses: boolean;
  allow_forwarding: boolean;
  invite_allow_reschedule_proposals: boolean;
  hide_attendees: boolean;
  history: unknown;
  discovery: string;
  join_model: string;
  created_at: string;
  updated_at: string;

  // User-specific fields (from event_details_personal)
  calendar_id?: string | null;
  calendar_name?: string | null;
  calendar_color?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  show_time_as?: string | null;
  time_defense_level?: string | null;
  ai_managed?: boolean | null;
  ai_instructions?: string | null;

  // User role fields (from event_user_roles)
  user_role?: string | null;
  invite_type?: string | null;
  rsvp?: string | null;
  rsvp_timestamp?: string | null;
  attendance_type?: string | null;
  following?: boolean | null;
}

/**
 * Assembly function that combines base table data
 */
async function assembleEvents(
  events: Event[],
  eventDetails: EventDetailsPersonal[],
  eventRoles: EventUserRole[],
  calendars: UserCalendar[],
  categories: UserCategory[],
  userId: string
): Promise<AssembledEvent[]> {
  // Create lookup maps for performance
  const detailsMap = new Map(eventDetails.map(detail => [`${detail.event_id}-${detail.user_id}`, detail]));
  const rolesMap = new Map(eventRoles.map(role => [`${role.event_id}-${role.user_id}`, role]));
  const calendarsMap = new Map(calendars.map(cal => [cal.id, cal]));
  const categoriesMap = new Map(categories.map(cat => [cat.id, cat]));

  return events.map(event => {
    // Get user-specific details
    const details = detailsMap.get(`${event.id}-${userId}`);
    const role = rolesMap.get(`${event.id}-${userId}`);

    // Get related calendar and category info
    const calendar = details?.calendar_id ? calendarsMap.get(details.calendar_id) : null;
    const category = details?.category_id ? categoriesMap.get(details.category_id) : null;

    return {
      // Base event fields (already normalized with pre-computed milliseconds)
      ...event,

      // User-specific fields from event_details_personal
      calendar_id: details?.calendar_id || null,
      calendar_name: calendar?.name || null,
      calendar_color: calendar?.color || null,
      category_id: details?.category_id || null,
      category_name: category?.name || null,
      category_color: category?.color || null,
      show_time_as: details?.show_time_as || null,
      time_defense_level: details?.time_defense_level || null,
      ai_managed: details?.ai_managed || null,
      ai_instructions: details?.ai_instructions || null,

      // User role fields from event_user_roles
      user_role: role?.role || null,
      invite_type: role?.invite_type || null,
      rsvp: role?.rsvp || null,
      rsvp_timestamp: role?.rsvp_timestamp || null,
      attendance_type: role?.attendance_type || null,
      following: role?.following || null,
    };
  });
}

/**
 * Hook to get assembled events for a user within a date range
 */
export function useAssembledEvents(
  userId: string | undefined,
  range?: { from: number; to: number }
) {
  return useQuery({
    queryKey: keys.events(userId!, range),
    queryFn: async (): Promise<AssembledEvent[]> => {
      if (!userId) throw new Error('User ID is required');

      // Fetch all required data in parallel
      const [eventsData, detailsData, rolesData, calendarsData, categoriesData] = await Promise.all([
        // Events - get events user owns or has access to
        supabase
          .from('events')
          .select('*')
          .or(`owner_id.eq.${userId},creator_id.eq.${userId}`)
          .then(({ data, error }) => {
            if (error) throw error;
            // Map server events to client format with computed milliseconds
            return (data || []).map(mapEventFromServer);
          }),

        // Event details personal for this user
        supabase
          .from('event_details_personal')
          .select('*')
          .eq('user_id', userId)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          }),

        // Event user roles for this user
        supabase
          .from('event_user_roles')
          .select('*')
          .eq('user_id', userId)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          }),

        // User's calendars
        supabase
          .from('user_calendars')
          .select('*')
          .eq('user_id', userId)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          }),

        // User's categories
        supabase
          .from('user_categories')
          .select('*')
          .eq('user_id', userId)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          }),
      ]);

      // Filter events by date range if provided
      let filteredEvents = eventsData;
      if (range) {
        filteredEvents = eventsData.filter(event => {
          // Event overlaps with range if: event_start < range_end AND event_end > range_start
          return event.start_time_ms < range.to && event.end_time_ms > range.from;
        });
      }

      // Assemble the complete events
      return assembleEvents(
        filteredEvents,
        detailsData,
        rolesData,
        calendarsData,
        categoriesData,
        userId
      );
    },
    enabled: !!userId,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Hook to get a single assembled event by ID
 */
export function useAssembledEvent(userId: string | undefined, eventId: string | undefined) {
  return useQuery({
    queryKey: ['event', { userId, eventId }],
    queryFn: async (): Promise<AssembledEvent | null> => {
      if (!userId || !eventId) throw new Error('User ID and Event ID are required');

      // Fetch all required data for this specific event
      const [eventData, detailsData, rolesData, calendarsData, categoriesData] = await Promise.all([
        // Single event
        supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single()
          .then(({ data, error }) => {
            if (error) throw error;
            return data;
          }),

        // Event details personal for this user and event
        supabase
          .from('event_details_personal')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error;
            return data ? [data] : [];
          }),

        // Event user role for this user and event
        supabase
          .from('event_user_roles')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error;
            return data ? [data] : [];
          }),

        // User's calendars
        supabase
          .from('user_calendars')
          .select('*')
          .eq('user_id', userId)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          }),

        // User's categories
        supabase
          .from('user_categories')
          .select('*')
          .eq('user_id', userId)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          }),
      ]);

      if (!eventData) return null;

      const assembled = await assembleEvents(
        [eventData],
        detailsData,
        rolesData,
        calendarsData,
        categoriesData,
        userId
      );

      return assembled[0] || null;
    },
    enabled: !!userId && !!eventId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}