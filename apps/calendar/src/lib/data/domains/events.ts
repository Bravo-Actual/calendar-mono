// domains/events.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapEventFromServer, mapEDPFromServer } from '../base/mapping';
import { assembleEvent, assembleEvents } from '../base/assembly';
import { overlaps, generateUUID, nowISO } from '../base/utils';
import type { AssembledEvent, ClientEvent } from '../base/client-types';

export function useEventsRange(uid: string | undefined, range: { from: number; to: number }) {
  return useQuery({
    queryKey: uid ? keys.eventsRange(uid, range.from, range.to) : ['events:none'],
    enabled: !!uid,
    queryFn: async (): Promise<AssembledEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('owner_id', uid!)
        .gte('end_time_ms', range.from)
        .lte('start_time_ms', range.to);
      if (error) throw error;

      const rows = (data ?? []).map(mapEventFromServer);
      await db.events.bulkPut(rows);

      // fetch matching EDP rows for this user
      const ids = rows.map(e => e.id);
      if (ids.length) {
        const { data: edps, error: edpErr } = await supabase
          .from('event_details_personal')
          .select('*')
          .eq('user_id', uid!)
          .in('event_id', ids);
        if (edpErr) throw edpErr;
        await db.event_details_personal.bulkPut((edps ?? []).map(mapEDPFromServer));
      }

      return assembleEvents(rows, uid!);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useEvent(uid: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: uid && id ? keys.event(uid, id) : ['event:none'],
    enabled: !!uid && !!id,
    queryFn: async (): Promise<AssembledEvent> => {
      const { data, error } = await supabase.from('events').select('*').eq('id', id!).single();
      if (error) throw error;
      const ev = mapEventFromServer(data!);
      await db.events.put(ev);

      const { data: edp } = await supabase
        .from('event_details_personal')
        .select('*')
        .eq('event_id', id!)
        .eq('user_id', uid!)
        .single();
      if (edp) await db.event_details_personal.put(mapEDPFromServer(edp));

      return assembleEvent(ev, uid!);
    },
  });
}

export function useCreateEvent(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      start_time: string; // ISO UTC
      end_time: string;   // ISO UTC
      private?: boolean;
      // personal details
      calendar_id?: string;
      category_id?: string;
      show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
      time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block';
      ai_managed?: boolean;
      ai_instructions?: string | null;
    }): Promise<AssembledEvent> => {
      if (!uid) throw new Error('user required');

      const id = generateUUID();
      const startMs = Date.parse(input.start_time);
      const endMs = Date.parse(input.end_time);
      const now = nowISO();

      // optimistic Dexie write
      const optimistic: ClientEvent = {
        id,
        owner_id: uid,
        creator_id: uid,
        title: input.title,
        private: !!input.private,
        start_time: input.start_time,
        end_time: input.end_time,
        start_time_ms: startMs,
        end_time_ms: endMs,
        created_at: now,
        updated_at: now,
        // Add other required fields with defaults
        agenda: null,
        online_event: false,
        online_join_link: null,
        online_chat_link: null,
        in_person: false,
        all_day: false,
        request_responses: false,
        allow_forwarding: true,
        invite_allow_reschedule_proposals: true,
        hide_attendees: false,
        history: null,
        discovery: 'audience_only',
        join_model: 'invite_only',
        series_id: null,
      };

      // default calendar if none
      const defaultCal = input.calendar_id
        ?? (await db.user_calendars.where({ user_id: uid, type: 'default' }).first())?.id
        ?? null;

      await db.transaction('rw', [db.events, db.event_details_personal], async () => {
        await db.events.put(optimistic);
        await db.event_details_personal.put({
          event_id: id,
          user_id: uid,
          calendar_id: defaultCal,
          category_id: input.category_id ?? null,
          show_time_as: input.show_time_as ?? 'busy',
          time_defense_level: input.time_defense_level ?? 'normal',
          ai_managed: input.ai_managed ?? false,
          ai_instructions: input.ai_instructions ?? null,
          created_at: now,
          updated_at: now,
        });
      });

      // pre-assemble event for optimistic cache update
      const assembled = await assembleEvent(optimistic, uid);

      // optimistic cache update for overlapping ranges
      qc.setQueriesData({ queryKey: ['events'], predicate: q => {
        const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
        const shouldUpdate = vars?.uid === uid && vars?.from !== undefined && vars?.to !== undefined &&
               overlaps(vars.from, vars.to, startMs, endMs);
        console.log('🔍 Cache update predicate:', {
          queryKey: q.queryKey,
          shouldUpdate,
          eventTime: { startMs, endMs },
          rangeTime: { from: vars?.from, to: vars?.to }
        });
        return shouldUpdate;
      }}, (old?: AssembledEvent[]) => {
        console.log('✅ Optimistic cache update:', {
          oldCount: old?.length || 0,
          newEventId: assembled.id,
          newEventTitle: assembled.title
        });
        if (!old) return [assembled];
        return [...old, assembled].sort((a, b) => a.start_time_ms - b.start_time_ms);
      });

      // server insert
      const { data: server, error } = await supabase
        .from('events')
        .insert({
          id,
          owner_id: uid,
          creator_id: uid,
          title: input.title,
          start_time: input.start_time,
          end_time: input.end_time,
          private: input.private || false
        })
        .select()
        .single();
      if (error) throw error;

      await db.events.put(mapEventFromServer(server)); // authoritative ms

      // personal details upsert (if any provided explicitly)
      if (input.calendar_id || input.category_id || input.show_time_as || input.time_defense_level || input.ai_managed != null || input.ai_instructions != null) {
        const { error: edpErr } = await supabase
          .from('event_details_personal')
          .upsert({
            event_id: id,
            user_id: uid,
            calendar_id: defaultCal,
            category_id: input.category_id ?? null,
            show_time_as: input.show_time_as ?? 'busy',
            time_defense_level: input.time_defense_level ?? 'normal',
            ai_managed: input.ai_managed ?? false,
            ai_instructions: input.ai_instructions ?? null,
          });
        if (edpErr) throw edpErr;
      }

      return assembleEvent(await db.events.get(id) as ClientEvent, uid);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      event?: Partial<Pick<ClientEvent, 'title' | 'start_time' | 'end_time' | 'private' | 'online_event' | 'in_person'>>;
      personal?: Partial<{
        calendar_id: string;
        category_id: string;
        show_time_as: 'free'|'tentative'|'busy'|'oof'|'working_elsewhere';
        time_defense_level: 'flexible'|'normal'|'high'|'hard_block';
        ai_managed: boolean;
        ai_instructions: string | null;
      }>
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic Dexie change
      await db.transaction('rw', [db.events, db.event_details_personal], async () => {
        if (input.event) {
          const ex = await db.events.get(input.id);
          if (ex) {
            const nextStart = input.event.start_time ?? ex.start_time;
            const nextEnd = input.event.end_time ?? ex.end_time;
            await db.events.put({
              ...ex,
              ...input.event,
              start_time_ms: Date.parse(nextStart),
              end_time_ms: Date.parse(nextEnd),
              updated_at: nowISO()
            });
          }
        }
        if (input.personal) {
          const edp = (await db.event_details_personal.get([input.id, uid])) ?? {
            event_id: input.id,
            user_id: uid,
            calendar_id: null,
            category_id: null,
            show_time_as: 'busy',
            time_defense_level: 'normal',
            ai_managed: false,
            ai_instructions: null,
            created_at: nowISO(),
            updated_at: nowISO()
          };
          await db.event_details_personal.put({ ...edp, ...input.personal, updated_at: nowISO() });
        }
      });

      // server update
      if (input.event && Object.keys(input.event).length) {
        const { error } = await supabase.from('events').update(input.event as any).eq('id', input.id);
        if (error) throw error;
      }
      if (input.personal && Object.keys(input.personal).length) {
        const { error } = await supabase.from('event_details_personal').upsert({
          event_id: input.id,
          user_id: uid,
          ...input.personal
        } as any);
        if (error) throw error;
      }
      return true;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!uid) throw new Error('user required');
      const backup = await db.events.get(eventId);
      await db.events.delete(eventId);
      const { error } = await supabase.from('events').delete().eq('id', eventId).eq('owner_id', uid);
      if (error) {
        if (backup) await db.events.put(backup);
        throw error;
      }
      return eventId;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

// Convenience wrappers
export const useUpdateEventCalendar = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, calendarId }: { eventId: string; calendarId: string }) =>
      m.mutateAsync({ id: eventId, personal: { calendar_id: calendarId } })
  });
};

export const useUpdateEventCategory = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, categoryId }: { eventId: string; categoryId: string }) =>
      m.mutateAsync({ id: eventId, personal: { category_id: categoryId } })
  });
};

export const useUpdateEventShowTimeAs = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, showTimeAs }: { eventId: string; showTimeAs: 'free'|'tentative'|'busy'|'oof'|'working_elsewhere' }) =>
      m.mutateAsync({ id: eventId, personal: { show_time_as: showTimeAs } })
  });
};

export const useUpdateEventTimeDefense = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, timeDefenseLevel }: { eventId: string; timeDefenseLevel: 'flexible'|'normal'|'high'|'hard_block' }) =>
      m.mutateAsync({ id: eventId, personal: { time_defense_level: timeDefenseLevel } })
  });
};

export const useUpdateEventAI = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, aiManaged, aiInstructions }: { eventId: string; aiManaged: boolean; aiInstructions?: string | null }) =>
      m.mutateAsync({ id: eventId, personal: { ai_managed: aiManaged, ai_instructions: aiInstructions ?? null } })
  });
};

export const useUpdateEventOnlineMeeting = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, isOnlineMeeting }: { eventId: string; isOnlineMeeting: boolean }) =>
      m.mutateAsync({ id: eventId, event: { online_event: isOnlineMeeting } })
  });
};

export const useUpdateEventInPerson = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({
    mutationFn: ({ eventId, isInPerson }: { eventId: string; isInPerson: boolean }) =>
      m.mutateAsync({ id: eventId, event: { in_person: isInPerson } })
  });
};