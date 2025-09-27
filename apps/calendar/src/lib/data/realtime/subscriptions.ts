// realtime/subscriptions.ts
import { supabase } from '@/lib/supabase';
import { QueryClient } from '@tanstack/react-query';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import {
  mapEventFromServer,
  mapEDPFromServer,
  mapCalendarFromServer,
  mapCategoryFromServer,
  mapPersonaFromServer,
  mapAnnotationFromServer
} from '../base/mapping';
import { overlaps } from '../base/utils';
import type {
  EventResolved,
  ClientEDP,
  ClientCalendar,
  ClientCategory,
  ClientPersona,
  ClientAnnotation
} from '../base/client-types';

export function startRealtime(uid: string, queryClient: QueryClient) {
  const channel = supabase
    .channel(`user:${uid}`)

    // Events table changes
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'events'
    }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;

      if (eventType === 'DELETE') {
        await db.events.delete(o.id);
        // Remove from all overlapping event ranges
        queryClient.setQueriesData({ queryKey: ['events'], predicate: q => {
          const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
          return vars?.uid === uid && vars?.from !== undefined && vars?.to !== undefined;
        }}, (old?: EventResolved[]) => {
          if (!old) return old;
          return old.filter(event => event.id !== o.id);
        });
      } else {
        const clientEvent = mapEventFromServer(n);
        await db.events.put(clientEvent);

        // For realtime updates, invalidate queries to trigger refetch with proper assembly
        queryClient.invalidateQueries({ queryKey: ['events'], predicate: q => {
          const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
          return vars?.uid === uid && vars?.from !== undefined && vars?.to !== undefined &&
                 overlaps(vars.from, vars.to, clientEvent.start_time_ms, clientEvent.end_time_ms);
        }});
      }

      // Invalidate single event queries
      queryClient.invalidateQueries({ queryKey: ['event', { uid, id: n?.id ?? o?.id }] });
    })

    // Event details personal changes
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'event_details_personal',
      filter: `user_id=eq.${uid}`
    }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;

      if (eventType === 'DELETE') {
        await db.event_details_personal.delete([o.event_id, o.user_id]);
      } else {
        await db.event_details_personal.put(mapEDPFromServer(n));
      }

      // Invalidate event queries that include this event
      const eventId = n?.event_id ?? o?.event_id;
      queryClient.invalidateQueries({ queryKey: ['events'], predicate: q => {
        const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
        return vars?.uid === uid;
      }});
      queryClient.invalidateQueries({ queryKey: ['event', { uid, id: eventId }] });
    })

    // User calendars changes
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_calendars',
      filter: `user_id=eq.${uid}`
    }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;

      if (eventType === 'DELETE') {
        await db.user_calendars.delete(o.id);
        queryClient.setQueryData(keys.calendars(uid), (old?: ClientCalendar[]) =>
          old?.filter(cal => cal.id !== o.id) ?? []
        );
      } else {
        const calendar = mapCalendarFromServer(n);
        await db.user_calendars.put(calendar);
        queryClient.setQueryData(keys.calendars(uid), (old?: ClientCalendar[]) => {
          if (!old) return [calendar];
          const filtered = old.filter(cal => cal.id !== calendar.id);
          return [...filtered, calendar].sort((a, b) => a.name.localeCompare(b.name));
        });
      }

      // Invalidate events that reference this calendar
      queryClient.invalidateQueries({ queryKey: ['events'] });
    })

    // User categories changes
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_categories',
      filter: `user_id=eq.${uid}`
    }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;

      if (eventType === 'DELETE') {
        await db.user_categories.delete(o.id);
        queryClient.setQueryData(keys.categories(uid), (old?: ClientCategory[]) =>
          old?.filter(cat => cat.id !== o.id) ?? []
        );
      } else {
        const category = mapCategoryFromServer(n);
        await db.user_categories.put(category);
        queryClient.setQueryData(keys.categories(uid), (old?: ClientCategory[]) => {
          if (!old) return [category];
          const filtered = old.filter(cat => cat.id !== category.id);
          return [...filtered, category].sort((a, b) => a.name.localeCompare(b.name));
        });
      }

      // Invalidate events that reference this category
      queryClient.invalidateQueries({ queryKey: ['events'] });
    })

    // AI personas changes
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ai_personas',
      filter: `user_id=eq.${uid}`
    }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;

      if (eventType === 'DELETE') {
        await db.ai_personas.delete(o.id);
        queryClient.setQueryData(keys.personas(uid), (old?: ClientPersona[]) =>
          old?.filter(persona => persona.id !== o.id) ?? []
        );
      } else {
        const persona = mapPersonaFromServer(n);
        await db.ai_personas.put(persona);
        queryClient.setQueryData(keys.personas(uid), (old?: ClientPersona[]) => {
          if (!old) return [persona];
          const filtered = old.filter(p => p.id !== persona.id);
          return [...filtered, persona].sort((a, b) => a.name.localeCompare(b.name));
        });
      }
    })

    // User annotations changes
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_annotations',
      filter: `user_id=eq.${uid}`
    }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;

      if (eventType === 'DELETE') {
        await db.user_annotations.delete(o.id);
        // Remove from all overlapping annotation ranges
        queryClient.setQueriesData({ queryKey: ['annotations'], predicate: q => {
          const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
          return vars?.uid === uid;
        }}, (old?: ClientAnnotation[]) => {
          if (!old) return old;
          return old.filter(annotation => annotation.id !== o.id);
        });
      } else {
        const annotation = mapAnnotationFromServer(n);
        await db.user_annotations.put(annotation);

        // Update overlapping ranges in cache
        queryClient.setQueriesData({ queryKey: ['annotations'], predicate: q => {
          const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
          return vars?.uid === uid && vars?.from !== undefined && vars?.to !== undefined &&
                 annotation.start_time_ms !== null && annotation.end_time_ms !== null &&
                 overlaps(vars.from, vars.to, annotation.start_time_ms, annotation.end_time_ms);
        }}, (old?: ClientAnnotation[]) => {
          if (!old) return [annotation];
          const filtered = old.filter(a => a.id !== annotation.id);
          return [...filtered, annotation].sort((a, b) => (a.start_time_ms || 0) - (b.start_time_ms || 0));
        });
      }
    })

    .subscribe();

  return () => supabase.removeChannel(channel);
}


// Clear user data from local cache
export async function clearUserData(userId: string) {
  await db.transaction('rw', [
    db.events,
    db.event_details_personal,
    db.user_calendars,
    db.user_categories,
    db.ai_personas,
    db.user_annotations
  ], async () => {
    await db.events.where('owner_id').equals(userId).delete();
    await db.event_details_personal.where('user_id').equals(userId).delete();
    await db.user_calendars.where('user_id').equals(userId).delete();
    await db.user_categories.where('user_id').equals(userId).delete();
    await db.ai_personas.where('user_id').equals(userId).delete();
    await db.user_annotations.where('user_id').equals(userId).delete();
  });
}