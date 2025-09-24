/**
 * Unified Events System
 * Replaces: use-create-event.ts, use-update-event.ts, use-delete-event.ts
 *
 * Implements GPT plan patterns:
 * - Base tables only (events, event_details_personal, event_user_roles)
 * - Client-side assembly of complete events
 * - Bulk operations for initial loads
 * - Archive/unarchive via calendar_id switching
 * - Range queries using DB-computed timestamps
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { generateId } from '../base/utils';
import { useAssembledEvents, useAssembledEvent, type AssembledEvent } from '../base/assembly';
import { mapEventFromServer, mapEventToServer } from '../base/mapping';
import type { Event, EventDetailsPersonal, EventUserRole } from '../base/dexie';

// Types for event operations
export interface CreateEventInput {
  title: string;
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  all_day?: boolean;
  agenda?: string;
  online_event?: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person?: boolean;
  private?: boolean;
  request_responses?: boolean;
  allow_forwarding?: boolean;
  invite_allow_reschedule_proposals?: boolean;
  hide_attendees?: boolean;
  discovery?: string;
  join_model?: string;
  // Personal details
  calendar_id?: string;
  category_id?: string;
  show_time_as?: string;
  time_defense_level?: string;
  ai_managed?: boolean;
  ai_instructions?: string;
}

export interface UpdateEventInput {
  id: string;
  // Event table fields
  title?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  agenda?: string;
  online_event?: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person?: boolean;
  private?: boolean;
  request_responses?: boolean;
  allow_forwarding?: boolean;
  invite_allow_reschedule_proposals?: boolean;
  hide_attendees?: boolean;
  discovery?: string;
  join_model?: string;
  // Personal details
  calendar_id?: string;
  category_id?: string;
  show_time_as?: string;
  time_defense_level?: string;
  ai_managed?: boolean;
  ai_instructions?: string;
}

/**
 * Get events within a date range (GPT plan pattern)
 * Uses AssembledEvent from base/assembly.ts for client-side merging
 */
export function useEventsRange(userId: string | undefined, range: { from: number; to: number }) {
  return useAssembledEvents(userId, range);
}

/**
 * Get single event by ID
 */
export function useEvent(userId: string | undefined, eventId: string | undefined) {
  return useAssembledEvent(userId, eventId);
}

/**
 * Create event with optimistic updates (TanStack v5 + assembled optimistic item)
 */
export function useCreateEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  // helpers
  const rangesOverlap = (from?: number, to?: number, s?: number, e?: number) =>
    from !== undefined && to !== undefined && s !== undefined && e !== undefined
      ? !(e < from || s > to)
      : true;

  const upsertById = <T extends { id: string }>(arr: T[], item: T) => {
    const i = arr.findIndex(x => x.id === item.id);
    return i === -1 ? [item, ...arr] : [...arr.slice(0, i), item, ...arr.slice(i + 1)];
  };

  return useMutation({
    // we keep the optimistic path inline for a minimal-diff change
    mutationFn: async (input: CreateEventInput): Promise<AssembledEvent> => {
      if (!userId) throw new Error('User ID is required');

      // 1) cancel in-flight events queries (prevents races with our patch)
      await queryClient.cancelQueries({ queryKey: ['events'] });

      // 2) stable client id so optimistic == server row
      const optimisticEventId = generateId();

      // 3) split personal fields from event fields
      const {
        calendar_id,
        category_id,
        show_time_as,
        time_defense_level,
        ai_managed,
        ai_instructions,
        ...eventData
      } = input;

      // 4) build optimistic Event (with pre-computed milliseconds)
      const now = new Date().toISOString();

      const optimisticEvent: Event = {
        id: optimisticEventId,
        owner_id: userId,
        creator_id: userId,
        ...eventData,
        start_time: input.start_time, // Already ISO format from input
        end_time: input.end_time,     // Already ISO format from input
        start_time_ms: new Date(input.start_time).getTime(),
        end_time_ms: new Date(input.end_time).getTime(),
        all_day: !!input.all_day,
        private: !!input.private,
        created_at: now,
        updated_at: now,
      } as Event;

      // 5) simulate DB trigger: create a local EDP row with a default non-archived calendar
      const defaultCal =
        calendar_id
        ?? (await db.user_calendars
              .where('user_id').equals(userId)
              .and((c: any) => c.type !== 'archive' && c.type === 'default')
              .first()
           )?.id
        ?? (await db.user_calendars
              .where('user_id').equals(userId)
              .and((c: any) => c.type !== 'archive')
              .first()
           )?.id
        ?? null;

      const optimisticEDP: EventDetailsPersonal = {
        event_id: optimisticEventId,
        user_id: userId,
        calendar_id: defaultCal ?? undefined,
        category_id: category_id ?? undefined,
        show_time_as: (show_time_as as any) ?? 'busy',
        time_defense_level: (time_defense_level as any) ?? 'normal',
        ai_managed: !!ai_managed,
        ai_instructions: ai_instructions ?? null,
        updated_at: new Date().toISOString(),
      };

      // 6) read lookups for assembly
      const cal = optimisticEDP.calendar_id ? await db.user_calendars.get(optimisticEDP.calendar_id) : undefined;
      const cat = optimisticEDP.category_id ? await db.user_categories.get(optimisticEDP.category_id) : undefined;

      const assembledOptimistic: AssembledEvent = {
        ...optimisticEvent,
        show_time_as: optimisticEDP.show_time_as ?? 'busy',
        time_defense_level: optimisticEDP.time_defense_level ?? 'normal',
        ai_managed: !!optimisticEDP.ai_managed,
        ai_instructions: optimisticEDP.ai_instructions ?? null,
        calendar_id: optimisticEDP.calendar_id ?? null,
        calendar_name: cal?.name ?? null,
        calendar_color: cal?.color ?? null,
        category_id: optimisticEDP.category_id ?? null,
        category_name: cat?.name ?? null,
        category_color: cat?.color ?? null,
        user_role: 'owner',
        invite_type: null,
        rsvp: null,
        rsvp_timestamp: null,
        attendance_type: null,
        following: false,
      };

      // 7) write optimistic rows to Dexie (offline UX)
      await db.transaction('rw', db.events, db.event_details_personal, async () => {
        await db.events.put(optimisticEvent);
        await db.event_details_personal.put(optimisticEDP);
      });

      // 8) patch all matching ranges in cache (v5 predicate)
      queryClient.setQueriesData(
        {
          queryKey: ['events'],
          predicate: (q) => {
            const [, vars] = q.queryKey as [string, { uid?: string; from?: number; to?: number }];
            return vars?.uid === userId && rangesOverlap(vars?.from, vars?.to, optimisticEvent.start_time_ms, optimisticEvent.end_time_ms);
          },
        },
        (old: AssembledEvent[] | undefined) => upsertById(old ?? [], assembledOptimistic)
      );

      try {
        // 9) server insert with the same client id
        const serverPayload = mapEventToServer({
          id: optimisticEventId,            // keep id consistent
          owner_id: userId,
          creator_id: userId,
          ...eventData,
        });

        const { data: eventResult, error: eventError } = await supabase
          .from('events')
          .insert(serverPayload)
          .select()
          .single();

        if (eventError) throw eventError;

        // 10) apply explicit personal fields server-side (trigger will create defaults if you didn't set them)
        if (calendar_id || category_id || show_time_as || time_defense_level || ai_managed || ai_instructions) {
          const { error: detailsError } = await supabase
            .from('event_details_personal')
            .upsert({
              event_id: eventResult.id,
              user_id: userId,
              calendar_id: calendar_id ?? null,
              category_id: category_id ?? null,
              show_time_as: (show_time_as as any) ?? 'busy',
              time_defense_level: (time_defense_level as any) ?? 'normal',
              ai_managed: !!ai_managed,
              ai_instructions: ai_instructions ?? null,
            }, { onConflict: 'event_id,user_id' });
          if (detailsError) throw detailsError;
        }

        // 11) store authoritative server event; EDP updates will flow via realtime
        const normalizedEvent = mapEventFromServer(eventResult);
        await db.events.put(normalizedEvent);

        // Optionally patch cached item with any server-computed fields (no-op if identical)
        queryClient.setQueriesData(
          {
            queryKey: ['events'],
            predicate: (q) => (q.queryKey as any[])[1]?.uid === userId,
          },
          (old: AssembledEvent[] | undefined) => {
            if (!old) return old;
            return old.map(e => e.id === optimisticEventId ? { ...assembledOptimistic, ...eventResult } : e);
          }
        );

        return { ...assembledOptimistic, ...eventResult } as AssembledEvent;

      } catch (error) {
        // rollback Dexie + cache
        await db.transaction('rw', db.events, db.event_details_personal, async () => {
          await db.events.delete(optimisticEventId);
          await db.event_details_personal.delete([optimisticEventId, userId]);
        });

        queryClient.setQueriesData(
          { queryKey: ['events'], predicate: (q) => (q.queryKey as any[])[1]?.uid === userId },
          (old: AssembledEvent[] | undefined) => old?.filter(e => e.id !== optimisticEventId)
        );

        throw error;
      }
    },
    onError: (error) => {
      console.error('Error creating event:', error);
    },
    onSettled: () => {
      // final reconcile pass to pick up trigger-side EDP + labels via read hook
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/**
 * Update event with optimistic updates
 */
export function useUpdateEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateEventInput): Promise<AssembledEvent> => {
      if (!userId) throw new Error('User ID is required');

      const { id, calendar_id, category_id, show_time_as, time_defense_level, ai_managed, ai_instructions, ...eventUpdates } = input;

      // 1. Get original data for rollback
      const originalEvent = await db.events.get(id);

      // 2. Optimistic update in Dexie
      if (Object.keys(eventUpdates).length > 0 && originalEvent) {
        const optimisticEvent = {
          ...originalEvent,
          ...eventUpdates,
          updated_at: new Date().toISOString(),
        } as Event;

        // Recompute millisecond fields if timestamps changed
        if (eventUpdates.start_time) {
          optimisticEvent.start_time_ms = new Date(eventUpdates.start_time).getTime();
        }
        if (eventUpdates.end_time) {
          optimisticEvent.end_time_ms = new Date(eventUpdates.end_time).getTime();
        }

        await db.events.put(optimisticEvent);
      }

      // 3. Optimistic cache update
      queryClient.setQueriesData(
        { queryKey: ['events'], predicate: (q) => (q.queryKey as any[])[1]?.uid === userId },
        (oldData: AssembledEvent[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map(event => {
            if (event.id === id) {
              const updated = { ...event, ...eventUpdates, ...input };
              // Recompute millisecond fields if timestamps changed
              if (eventUpdates.start_time) {
                updated.start_time_ms = new Date(eventUpdates.start_time).getTime();
              }
              if (eventUpdates.end_time) {
                updated.end_time_ms = new Date(eventUpdates.end_time).getTime();
              }
              return updated;
            }
            return event;
          });
        }
      );

      try {
        // 4. Server updates
        const promises = [];

        // Update event table if needed
        if (Object.keys(eventUpdates).length > 0) {
          promises.push(
            supabase
              .from('events')
              .update(eventUpdates)
              .eq('id', id)
              .eq('owner_id', userId)
              .select()
              .single()
          );
        }

        // Update personal details if needed
        const personalUpdates = { calendar_id, category_id, show_time_as, time_defense_level, ai_managed, ai_instructions };
        const hasPersonalUpdates = Object.values(personalUpdates).some(val => val !== undefined);

        if (hasPersonalUpdates) {
          const cleanPersonalUpdates = Object.fromEntries(
            Object.entries(personalUpdates).filter(([_, value]) => value !== undefined)
          );

          promises.push(
            supabase
              .from('event_details_personal')
              .upsert({
                event_id: id,
                user_id: userId,
                ...cleanPersonalUpdates,
              })
              .select()
              .single()
          );
        }

        const results = await Promise.all(promises);

        // Check for errors
        results.forEach(result => {
          if (result.error) throw result.error;
        });

        // 5. Update Dexie with real server data
        if (results[0]?.data) {
          await db.events.put(results[0].data);
        }
        if (results[1]?.data) {
          await db.event_details_personal.put(results[1].data);
        }

        return { ...originalEvent, ...eventUpdates, ...input } as AssembledEvent;

      } catch (error) {
        // Rollback optimistic updates
        if (originalEvent) {
          await db.events.put(originalEvent);
          queryClient.setQueriesData(
            { queryKey: ['events'], predicate: (q) => (q.queryKey as any[])[1]?.uid === userId },
            (oldData: AssembledEvent[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map(event =>
                event.id === id ? originalEvent as AssembledEvent : event
              );
            }
          );
        }
        throw error;
      }
    },
    onError: (error) => {
      console.error('Error updating event:', error);
    },
  });
}

/**
 * Delete event with optimistic updates
 */
export function useDeleteEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string): Promise<void> => {
      if (!userId) throw new Error('User ID is required');

      // 1. Get original data for rollback
      const originalEvent = await db.events.get(eventId);

      // 2. Optimistic delete from Dexie
      await db.events.delete(eventId);

      // 3. Optimistic cache update
      queryClient.setQueriesData(
        { queryKey: ['events'], predicate: (q) => (q.queryKey as any[])[1]?.uid === userId },
        (oldData: AssembledEvent[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(event => event.id !== eventId);
        }
      );

      try {
        // 4. Server delete
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
          .eq('owner_id', userId);

        if (error) throw error;

      } catch (error) {
        // Rollback optimistic delete
        if (originalEvent) {
          await db.events.put(originalEvent);
          queryClient.setQueriesData(
            { queryKey: ['events'], predicate: (q) => (q.queryKey as any[])[1]?.uid === userId },
            (oldData: AssembledEvent[] | undefined) => {
              if (!oldData) return [originalEvent as AssembledEvent];
              return [...oldData, originalEvent as AssembledEvent];
            }
          );
        }
        throw error;
      }
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
    },
  });
}

/**
 * Archive/Unarchive events (GPT plan pattern)
 */
export function useArchiveEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, archive }: { eventId: string; archive: boolean }): Promise<void> => {
      if (!userId) throw new Error('User ID is required');

      // Get appropriate calendar
      const targetCalendarType = archive ? 'archive' : 'default';
      const targetCalendar = await db.user_calendars
        .where('user_id').equals(userId)
        .and(cal => cal.type === targetCalendarType)
        .first();

      if (!targetCalendar) {
        throw new Error(`${targetCalendarType} calendar not found`);
      }

      // Update event_details_personal
      const { error } = await supabase
        .from('event_details_personal')
        .upsert({
          event_id: eventId,
          user_id: userId,
          calendar_id: targetCalendar.id,
        });

      if (error) throw error;

      // Surgical cache update to remove/add from visible lists
      queryClient.setQueriesData(
        { queryKey: ['events'], predicate: (q) => (q.queryKey as any[])[1]?.uid === userId },
        (oldData: AssembledEvent[] | undefined) => {
          if (!oldData) return oldData;
          if (archive) {
            // Remove from visible events when archiving
            return oldData.filter(event => event.id !== eventId);
          } else {
            // For unarchive, we'd need to refetch or have the event data
            // This would typically trigger a refetch of the events
            return oldData;
          }
        }
      );
    },
    onSuccess: (_, { archive }) => {
      // Invalidate events queries to ensure consistent state
      queryClient.invalidateQueries({
        queryKey: ['events']
      });
    },
    onError: (error) => {
      console.error('Error archiving event:', error);
    },
  });
}