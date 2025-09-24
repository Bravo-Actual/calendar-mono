# Offline‑first Data Layer Plan (calendar-mono)

**Verified repo:** `Bravo-Actual/calendar-mono` — latest commit starts with _“feat: add performance indexes and clean up documentation.”_

This document is a complete, implementation‑ready plan (with code) to make **Dexie** the single source of truth for app data, wire **TanStack Query v5** for caching/optimism, and stream **Supabase Realtime** changes into Dexie. **All data workloads** (calendar, categories, calendars, AI personas, profiles) go through this data layer. **AI chat** remains separate; **AI personas** live in the data layer.

---

## 0) Design Goals

1) **Single data layer**: Components never call Supabase directly. They use domain hooks (queries + mutations) that read/write Dexie and sync with Supabase.
2) **Offline‑first**: Dexie first; Supabase second. CRUD is optimistic; background reconciliation fixes drift.
3) **Realtime**: Subscribe to **base tables** only (no views). Merge changes into Dexie, patch relevant TanStack caches.
4) **Assembled models**: Calendar UI consumes **assembled events** = `event` + `event_details_personal` + lookups (calendar/category) + computed fields.
5) **Strict keys**: All queries use a small set of query-key factories so predicate‑based cache patching is reliable.

---

## 1) Database assumptions

- Base tables exist:
  - `events` (with computed `start_timestamp_ms`, `end_timestamp_ms` in DB)
  - `event_details_personal` (EDP) with composite PK `(event_id, user_id)` and trigger on `events` INSERT to create default EDP row.
  - `user_calendars` (per-user calendars; includes an “archived” calendar row created per user)
  - `user_categories`
  - `ai_personas` (per-user models for assistant personas)
- RLS policies allow each user to see & modify **their** rows (and their events where appropriate).

> If any of the above are missing, create migrations first. (Omitted here to keep focus on client side.)

---

## 2) File layout

```
apps/calendar/src/lib/data/
├─ base/
│  ├─ keys.ts                 # Canonical query key builders
│  ├─ mapping.ts              # PG→ISO normalizers & computed fields
│  ├─ assembly.ts             # assembleEvent(s)
│  ├─ dexie.ts                # Dexie schema/types (single DB)
│  └─ utils.ts                # small helpers (overlap(), id(), etc.)
├─ domains/
│  ├─ events.ts               # hooks for assembled calendar events
│  ├─ calendars.ts            # hooks for user calendars
│  ├─ categories.ts           # hooks for user categories
│  ├─ personas.ts             # hooks for AI personas (non-chat)
│  └─ users.ts                # user profile(s) if needed
├─ realtime/
│  └─ subscriptions.ts        # startRealtime(userId): events, EDP, calendars, categories, personas
├─ queries.ts                 # re-exports of domain hooks (back compat)
└─ index.ts                   # public surface
```

> The layout lines up with your current organization. Replace ad‑hoc event hooks with `domains/events.ts` and re-export in `queries.ts`.

---

## 3) Query keys (`base/keys.ts`)

```ts
// apps/calendar/src/lib/data/base/keys.ts
export const keys = {
  // User-scoped primitives
  user: (uid?: string) => ['user', uid] as const,

  // Ranged event lists (primary list primitive)
  eventsRange: (uid: string, from: number, to: number) =>
    ['events', { uid, from, to }] as const,

  // Single event
  event: (uid: string, id: string) => ['event', { uid, id }] as const,

  // Lookups
  calendars: (uid: string) => ['calendars', { uid }] as const,
  categories: (uid: string) => ['categories', { uid }] as const,
  personas: (uid: string) => ['ai-personas', { uid }] as const,
};
```

---

## 4) Mapping & normalization (`base/mapping.ts`)

```ts
// apps/calendar/src/lib/data/base/mapping.ts
import type { Database } from '@/types/supabase'; // your generated Database

export type ServerEvent = Database['public']['Tables']['events']['Row'];
export type ServerEDP   = Database['public']['Tables']['event_details_personal']['Row'];
export type ServerCal   = Database['public']['Tables']['user_calendars']['Row'];
export type ServerCat   = Database['public']['Tables']['user_categories']['Row'];
export type ServerPersona = Database['public']['Tables']['ai_personas']['Row'];

export const pgToIso = (s: string | null | undefined) => (s ? new Date(s).toISOString() : s ?? null);
export const toMs = (iso: string | null | undefined) => (iso ? Date.parse(iso) : undefined);

export function mapEventFromServer(row: ServerEvent) {
  const start_iso = pgToIso(row.start_time)!;
  const end_iso = pgToIso(row.end_time ?? null) ?? start_iso;
  return {
    ...row,
    start_time: start_iso,
    end_time: end_iso,
    created_at: pgToIso(row.created_at)!,
    updated_at: pgToIso(row.updated_at)!,
    start_time_ms: row.start_timestamp_ms ?? Date.parse(start_iso),
    end_time_ms: row.end_timestamp_ms ?? Date.parse(end_iso),
  };
}

export function mapEDPFromServer(row: ServerEDP) {
  return { ...row, updated_at: pgToIso(row.updated_at)! };
}

export const mapCalendarFromServer = (row: ServerCal) => ({ ...row, updated_at: pgToIso(row.updated_at)! });
export const mapCategoryFromServer = (row: ServerCat) => ({ ...row, updated_at: pgToIso(row.updated_at)! });
export const mapPersonaFromServer = (row: ServerPersona) => ({ ...row, updated_at: pgToIso(row.updated_at)! });
```

---

## 5) Dexie schema (`base/dexie.ts`)

> Use a single DB with explicit, query‑friendly indexes. Keep names consistent across domains. Bump version as needed.

```ts
// apps/calendar/src/lib/data/base/dexie.ts
import Dexie, { Table } from 'dexie';

export interface DBEvent {
  id: string;
  owner_id: string;
  creator_id: string;
  title: string;
  agenda: string | null;
  start_time: string;     // ISO
  end_time: string;       // ISO (or same as start)
  duration: number;       // minutes
  all_day: boolean;
  private: boolean;
  request_responses: boolean | null;
  allow_forwarding: boolean | null;
  invite_allow_reschedule_proposals: boolean | null;
  hide_attendees: boolean | null;
  discovery: string | null;
  join_model: string | null;
  created_at: string;     // ISO
  updated_at: string;     // ISO
  start_time_ms: number;  // mirrors start_timestamp_ms
  end_time_ms: number;    // mirrors end_timestamp_ms
}

export interface DBEDP {
  event_id: string;
  user_id: string;
  calendar_id: string | null;
  category_id: string | null;
  show_time_as: 'busy' | 'free' | 'tentative';
  time_defense_level: 'normal' | 'protected' | 'sacred';
  ai_managed: boolean;
  ai_instructions: string | null;
  updated_at: string; // ISO
}

export interface DBCalendar { id: string; user_id: string; name: string; color: string | null; is_default: boolean; type: 'default' | 'archive' | 'custom'; updated_at: string; }
export interface DBCategory { id: string; user_id: string; name: string; color: string | null; updated_at: string; }
export interface DBPersona  { id: string; user_id: string; name: string; model: string; system_prompt: string | null; temperature: number | null; updated_at: string; }

class AppDB extends Dexie {
  events!: Table<DBEvent, string>;
  event_details_personal!: Table<DBEDP, [string, string]>; // [event_id+user_id]
  user_calendars!: Table<DBCalendar, string>;
  user_categories!: Table<DBCategory, string>;
  ai_personas!: Table<DBPersona, string>;

  constructor() {
    super('calendar_mono');
    this.version(7).stores({
      events: 'id, owner_id, start_time_ms, end_time_ms, updated_at, [owner_id+start_time_ms]',
      event_details_personal: '[event_id+user_id], user_id, calendar_id, category_id, updated_at',
      user_calendars: 'id, user_id, is_default, type, updated_at',
      user_categories: 'id, user_id, updated_at',
      ai_personas: 'id, user_id, updated_at',
    });
  }
}

export const db = new AppDB();
```

---

## 6) Assembly (`base/assembly.ts`)

```ts
// apps/calendar/src/lib/data/base/assembly.ts
import { db } from './dexie';
import type { DBEvent, DBEDP } from './dexie';

export type AssembledEvent = DBEvent & {
  show_time_as: DBEDP['show_time_as'];
  time_defense_level: DBEDP['time_defense_level'];
  ai_managed: boolean;
  ai_instructions: string | null;
  calendar: { id: string; name: string; color: string | null } | null;
  category: { id: string; name: string; color: string | null } | null;
  role: 'owner' | 'viewer';
};

export async function assembleEvent(ev: DBEvent, userId: string): Promise<AssembledEvent> {
  const edp = await db.event_details_personal.get([ev.id, userId]);
  const cal = edp?.calendar_id ? await db.user_calendars.get(edp.calendar_id) : null;
  const cat = edp?.category_id ? await db.user_categories.get(edp.category_id) : null;
  return {
    ...ev,
    show_time_as: edp?.show_time_as ?? 'busy',
    time_defense_level: edp?.time_defense_level ?? 'normal',
    ai_managed: edp?.ai_managed ?? false,
    ai_instructions: edp?.ai_instructions ?? null,
    calendar: cal ? { id: cal.id, name: cal.name, color: cal.color } : null,
    category: cat ? { id: cat.id, name: cat.name, color: cat.color } : null,
    role: ev.owner_id === userId ? 'owner' : 'viewer',
  };
}

export function assembleEvents(events: DBEvent[], uid: string) {
  return Promise.all(events.map(e => assembleEvent(e, uid)));
}
```

---

## 7) Domain: Events (`domains/events.ts`)

```ts
// apps/calendar/src/lib/data/domains/events.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { assembleEvent, assembleEvents, type AssembledEvent } from '../base/assembly';
import { mapEventFromServer, mapEDPFromServer } from '../base/mapping';

const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number) => !(bTo < aFrom || bFrom > aTo);

/** Range list */
export function useEventsRange(uid: string | undefined, range: { from: number; to: number }) {
  const supabase = createClient();
  return useQuery({
    queryKey: keys.eventsRange(uid!, range.from, range.to),
    enabled: !!uid,
    queryFn: async (): Promise<AssembledEvent[]> => {
      if (!uid) return [];
      // 1) fetch base events for the range
      const { data: rows, error } = await supabase
        .from('events')
        .select('*')
        .gte('start_timestamp_ms', range.from)
        .lte('start_timestamp_ms', range.to);
      if (error) throw error;
      const events = (rows ?? []).map(mapEventFromServer);
      await db.events.bulkPut(events);

      // 2) user-scoped personal records for these events
      const ids = events.map(e => e.id);
      if (ids.length) {
        const { data: edps, error: edpErr } = await supabase
          .from('event_details_personal')
          .select('*')
          .eq('user_id', uid)
          .in('event_id', ids);
        if (edpErr) throw edpErr;
        await db.event_details_personal.bulkPut((edps ?? []).map(mapEDPFromServer));
      }

      return assembleEvents(events, uid);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Single */
export function useEvent(uid: string | undefined, id: string | undefined) {
  const supabase = createClient();
  return useQuery({
    queryKey: id && uid ? keys.event(uid, id) : ['event:none'],
    enabled: !!uid && !!id,
    queryFn: async (): Promise<AssembledEvent> => {
      const { data, error } = await supabase.from('events').select('*').eq('id', id!).single();
      if (error) throw error;
      const ev = mapEventFromServer(data);
      await db.events.put(ev);
      const { data: edp } = await supabase
        .from('event_details_personal')
        .select('*')
        .eq('user_id', uid!)
        .eq('event_id', id!)
        .maybeSingle();
      if (edp) await db.event_details_personal.put(mapEDPFromServer(edp));
      return assembleEvent(ev, uid!);
    },
  });
}

/** Create */
export function useCreateEvent(uid?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string; start_time: string; duration: number; all_day?: boolean; private?: boolean;
      calendar_id?: string; category_id?: string; show_time_as?: 'busy' | 'free' | 'tentative';
      time_defense_level?: 'normal' | 'protected' | 'sacred'; ai_managed?: boolean; ai_instructions?: string;
    }): Promise<AssembledEvent> => {
      if (!uid) throw new Error('User ID required');
      const id = crypto.randomUUID();
      const startMs = Date.parse(input.start_time);
      const endMs = startMs + input.duration * 60_000;

      // default calendar fallback
      const defaultCal = input.calendar_id ?? (await db.user_calendars.where({ user_id: uid, is_default: true }).first())?.id ?? null;

      // optimistic Dexie write
      const optimistic = {
        id,
        owner_id: uid,
        creator_id: uid,
        title: input.title,
        agenda: null,
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        duration: input.duration,
        all_day: !!input.all_day,
        private: !!input.private,
        request_responses: null,
        allow_forwarding: null,
        invite_allow_reschedule_proposals: null,
        hide_attendees: null,
        discovery: null,
        join_model: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        start_time_ms: startMs,
        end_time_ms: endMs,
      } as const;

      await db.transaction('rw', db.events, db.event_details_personal, async () => {
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
          updated_at: new Date().toISOString(),
        });
      });

      const assembled = await assembleEvent(optimistic as any, uid);

      // patch overlapping ranges (IMPORTANT: TanStack v5 API)
      qc.setQueriesData({
        predicate: (q) => {
          const [key, vars] = q.queryKey as [string, any];
          return key === 'events' && vars?.uid === uid && overlaps(vars.from, vars.to, startMs, endMs);
        }
      }, (old: AssembledEvent[] | undefined) => {
        if (!old) return [assembled];
        const i = old.findIndex(e => e.id === assembled.id);
        return i === -1 ? [assembled, ...old] : old.map((e, idx) => (idx === i ? assembled : e));
      });

      // server create
      const { data: evRow, error } = await supabase.from('events').insert({
        id,
        owner_id: uid,
        creator_id: uid,
        title: input.title,
        start_time: new Date(startMs).toISOString(),
        duration: input.duration,
        all_day: !!input.all_day,
        private: !!input.private,
      }).select('*').single();
      if (error) throw error;

      // Ensure EDP (if defaults suffice, upsert is harmless)
      const { error: edpErr } = await supabase.from('event_details_personal').upsert({
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

      // authoritative local write
      await db.events.put(mapEventFromServer(evRow));
      // (EDP realtime will sync; leaving as-is prevents double-patch)

      return assembled;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/** Update (base + personal) */
export function useUpdateEvent(uid?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      event?: Partial<Pick<AssembledEvent, 'title' | 'start_time' | 'duration' | 'all_day' | 'private'>>;
      personal?: Partial<{
        calendar_id: string | null;
        category_id: string | null;
        show_time_as: 'busy' | 'free' | 'tentative';
        time_defense_level: 'normal' | 'protected' | 'sacred';
        ai_managed: boolean;
        ai_instructions: string | null;
      }>;
    }) => {
      if (!uid) throw new Error('User ID required');

      // optimistic Dexie
      await db.transaction('rw', db.events, db.event_details_personal, async () => {
        if (input.event) {
          const ev = await db.events.get(input.id);
          if (ev) {
            const start = input.event.start_time ? Date.parse(input.event.start_time) : ev.start_time_ms;
            const end = input.event.duration ? start + input.event.duration * 60_000 : ev.end_time_ms;
            await db.events.put({ ...ev, ...input.event, start_time_ms: start, end_time_ms: end, updated_at: new Date().toISOString() });
          }
        }
        if (input.personal) {
          const edp = (await db.event_details_personal.get([input.id, uid])) ?? { event_id: input.id, user_id: uid };
          await db.event_details_personal.put({ ...edp, ...input.personal, updated_at: new Date().toISOString() } as any);
        }
      });

      // patch caches for any overlapping range
      const ev = await db.events.get(input.id);
      if (ev) {
        const assembled = await assembleEvent(ev, uid);
        qc.setQueriesData({
          predicate: (q) => {
            const [key, vars] = q.queryKey as [string, any];
            return key === 'events' && vars?.uid === uid && overlaps(vars.from, vars.to, ev.start_time_ms, ev.end_time_ms);
          }
        }, (old: AssembledEvent[] | undefined) => {
          if (!old) return [assembled];
          const i = old.findIndex(x => x.id === assembled.id);
          return i === -1 ? [assembled, ...old] : old.map((e, idx) => (idx === i ? assembled : e));
        });
      }

      // server writes
      if (input.event && Object.keys(input.event).length) {
        const base: any = { ...input.event };
        if (base.start_time) base.start_time = new Date(Date.parse(base.start_time)).toISOString();
        const { error } = await supabase.from('events').update(base).eq('id', input.id);
        if (error) throw error;
      }
      if (input.personal && Object.keys(input.personal).length) {
        const { error } = await supabase.from('event_details_personal').upsert({ event_id: input.id, user_id: uid, ...input.personal });
        if (error) throw error;
      }

      return true;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

/** Delete */
export function useDeleteEvent(uid?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error('User ID required');
      const backup = await db.events.get(id);
      await db.events.delete(id);
      qc.setQueriesData({ predicate: (q) => (q.queryKey as any[])[0] === 'events' && (q.queryKey as any[])[1]?.uid === uid },
        (old: AssembledEvent[] | undefined) => old?.filter(e => e.id !== id));
      const { error } = await supabase.from('events').delete().eq('id', id).eq('owner_id', uid);
      if (error && backup) await db.events.put(backup);
      if (error) throw error;
      return id;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

// Convenience wrappers
export const useUpdateEventCategory  = (uid?: string) => useMutation({ mutationFn: ({ eventId, categoryId }: { eventId: string; categoryId: string | null }) => useUpdateEvent(uid).mutateAsync({ id: eventId, personal: { category_id: categoryId } }) });
export const useUpdateEventCalendar  = (uid?: string) => useMutation({ mutationFn: ({ eventId, calendarId }: { eventId: string; calendarId: string | null }) => useUpdateEvent(uid).mutateAsync({ id: eventId, personal: { calendar_id: calendarId } }) });
export const useUpdateEventShowTimeAs = (uid?: string) => useMutation({ mutationFn: ({ eventId, showTimeAs }: { eventId: string; showTimeAs: 'busy'|'free'|'tentative' }) => useUpdateEvent(uid).mutateAsync({ id: eventId, personal: { show_time_as: showTimeAs } }) });
export const useUpdateEventTimeDefense = (uid?: string) => useMutation({ mutationFn: ({ eventId, level }: { eventId: string; level: 'normal'|'protected'|'sacred' }) => useUpdateEvent(uid).mutateAsync({ id: eventId, personal: { time_defense_level: level } }) });
export const useUpdateEventAI        = (uid?: string) => useMutation({ mutationFn: ({ eventId, aiManaged, aiInstructions }: { eventId: string; aiManaged: boolean; aiInstructions?: string|null }) => useUpdateEvent(uid).mutateAsync({ id: eventId, personal: { ai_managed: aiManaged, ai_instructions: aiInstructions ?? null } }) });
```

---

## 8) Calendars / Categories / Personas domains

> These are straightforward list + CRUD domains with standard optimistic writes. Below shows the pattern for Personas; repeat for Calendars & Categories with table/shape tweaks.

```ts
// apps/calendar/src/lib/data/domains/personas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapPersonaFromServer } from '../base/mapping';

export function useAIPersonas(uid?: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: uid ? keys.personas(uid) : ['ai-personas:none'],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_personas').select('*').eq('user_id', uid!);
      if (error) throw error;
      const rows = (data ?? []).map(mapPersonaFromServer);
      await db.ai_personas.bulkPut(rows);
      return rows;
    },
  });
}

export function useCreatePersona(uid?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; model: string; system_prompt?: string; temperature?: number }) => {
      if (!uid) throw new Error('User ID required');
      const id = crypto.randomUUID();
      const optimistic = { id, user_id: uid, name: input.name, model: input.model, system_prompt: input.system_prompt ?? null, temperature: input.temperature ?? null, updated_at: new Date().toISOString() };
      await db.ai_personas.put(optimistic);
      qc.setQueryData(keys.personas(uid), (old: any[] = []) => [optimistic, ...old]);

      const { data, error } = await supabase.from('ai_personas').insert({ ...optimistic }).select('*').single();
      if (error) throw error;
      await db.ai_personas.put(mapPersonaFromServer(data));
      return data.id;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['ai-personas'] }); },
  });
}

export function useUpdatePersona(uid?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<{ name: string; model: string; system_prompt: string|null; temperature: number|null }> }) => {
      if (!uid) throw new Error('User ID required');
      const existing = await db.ai_personas.get(input.id);
      if (existing) await db.ai_personas.put({ ...existing, ...input.patch, updated_at: new Date().toISOString() });
      qc.setQueryData(keys.personas(uid), (old: any[] = []) => old.map(p => (p.id === input.id ? { ...p, ...input.patch } : p)));
      const { error } = await supabase.from('ai_personas').update({ ...input.patch }).eq('id', input.id).eq('user_id', uid);
      if (error) throw error;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['ai-personas'] }); },
  });
}

export function useDeletePersona(uid?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error('User ID required');
      const backup = await db.ai_personas.get(id);
      await db.ai_personas.delete(id);
      qc.setQueryData(keys.personas(uid), (old: any[] = []) => old.filter(p => p.id !== id));
      const { error } = await supabase.from('ai_personas').delete().eq('id', id).eq('user_id', uid);
      if (error && backup) await db.ai_personas.put(backup);
      if (error) throw error;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['ai-personas'] }); },
  });
}
```

> Create equivalent `domains/calendars.ts` and `domains/categories.ts` with list + CRUD using the same pattern. (Omitted to keep this doc focused.)

---

## 9) Realtime (`realtime/subscriptions.ts`)

```ts
// apps/calendar/src/lib/data/realtime/subscriptions.ts
import { createClient } from '@/lib/supabase/client';
import { db } from '../base/dexie';
import { assembleEvent } from '../base/assembly';
import { mapEventFromServer, mapEDPFromServer, mapCalendarFromServer, mapCategoryFromServer, mapPersonaFromServer } from '../base/mapping';
import { QueryClient } from '@tanstack/react-query';

const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number) => !(bTo < aFrom || bFrom > aTo);

export function startRealtime(uid: string, qc: QueryClient) {
  const supabase = createClient();

  // EVENTS (all changes)
  const eventsChan = supabase.channel(`events:${uid}`)
    .on('postgres_changes', { schema: 'public', table: 'events', event: '*' }, async (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as any)?.id;
        if (!id) return;
        await db.events.delete(id);
        qc.setQueriesData({ predicate: (q) => (q.queryKey as any[])[0] === 'events' && (q.queryKey as any[])[1]?.uid === uid }, (old: any[] | undefined) => old?.filter(e => e.id !== id));
        return;
      }
      const row = mapEventFromServer(payload.new as any);
      await db.events.put(row);
      const edp = await db.event_details_personal.get([row.id, uid]);
      const assembled = await assembleEvent(row, uid);
      qc.setQueriesData({ predicate: (q) => {
        const [key, vars] = q.queryKey as [string, any];
        return key === 'events' && vars?.uid === uid && overlaps(vars.from, vars.to, row.start_time_ms, row.end_time_ms);
      }}, (old: any[] | undefined) => {
        if (!old) return [assembled];
        const i = old.findIndex(x => x.id === assembled.id);
        return i === -1 ? [assembled, ...old] : old.map((e, idx) => (idx === i ? assembled : e));
      });
    })
    .subscribe();

  // EDP — filter by this user only
  const edpChan = supabase.channel(`edp:${uid}`)
    .on('postgres_changes', { schema: 'public', table: 'event_details_personal', event: '*', filter: `user_id=eq.${uid}` }, async (payload) => {
      if (payload.eventType === 'DELETE') {
        const old = payload.old as any;
        await db.event_details_personal.delete([old.event_id, old.user_id]);
      } else {
        await db.event_details_personal.put(mapEDPFromServer(payload.new as any));
      }
      // re-assemble and patch any ranges containing this event
      const evId = (payload.new as any)?.event_id ?? (payload.old as any)?.event_id;
      const ev = evId ? await db.events.get(evId) : null;
      if (ev) {
        const assembled = await assembleEvent(ev, uid);
        qc.setQueriesData({ predicate: (q) => {
          const [key, vars] = q.queryKey as [string, any];
          return key === 'events' && vars?.uid === uid && overlaps(vars.from, vars.to, ev.start_time_ms, ev.end_time_ms);
        }}, (old: any[] | undefined) => {
          if (!old) return [assembled];
          const i = old.findIndex(x => x.id === assembled.id);
          return i === -1 ? [assembled, ...old] : old.map((e, idx) => (idx === i ? assembled : e));
        });
      }
    })
    .subscribe();

  // Calendars / Categories / Personas
  const calChan = supabase.channel(`cal:${uid}`)
    .on('postgres_changes', { schema: 'public', table: 'user_calendars', event: '*', filter: `user_id=eq.${uid}` }, async (p) => {
      if (p.eventType === 'DELETE') await db.user_calendars.delete((p.old as any).id);
      else await db.user_calendars.put(mapCalendarFromServer(p.new as any));
    }).subscribe();

  const catChan = supabase.channel(`cat:${uid}`)
    .on('postgres_changes', { schema: 'public', table: 'user_categories', event: '*', filter: `user_id=eq.${uid}` }, async (p) => {
      if (p.eventType === 'DELETE') await db.user_categories.delete((p.old as any).id);
      else await db.user_categories.put(mapCategoryFromServer(p.new as any));
    }).subscribe();

  const personaChan = supabase.channel(`persona:${uid}`)
    .on('postgres_changes', { schema: 'public', table: 'ai_personas', event: '*', filter: `user_id=eq.${uid}` }, async (p) => {
      if (p.eventType === 'DELETE') await db.ai_personas.delete((p.old as any).id);
      else await db.ai_personas.put(mapPersonaFromServer(p.new as any));
    }).subscribe();

  return () => {
    supabase.removeChannel(eventsChan);
    supabase.removeChannel(edpChan);
    supabase.removeChannel(calChan);
    supabase.removeChannel(catChan);
    supabase.removeChannel(personaChan);
  };
}
```

---

## 10) Wiring in the Provider

Add to your app provider after auth resolves:

```ts
// apps/calendar/src/providers.tsx (or similar root provider)
import { queryClient } from '@/lib/data/base/persist';
import { startRealtime } from '@/lib/data/realtime/subscriptions';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';

export function DataLayerBootstrap() {
  const { user } = useAuth();
  const stopRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    if (user?.id) {
      stopRef.current = startRealtime(user.id, queryClient);
    }
    return () => { if (stopRef.current) stopRef.current(); };
  }, [user?.id]);

  return null;
}
```

Render `<DataLayerBootstrap />` somewhere under your QueryClientProvider & AuthProvider.

---

## 11) Using the hooks in UI

```ts
// Example: Calendar page
const { data: events = [], isLoading } = useEventsRange(user?.id, { from: startOfWeek(current).getTime(), to: endOfWeek(current).getTime() });

// Update operations
const updateCategory = useUpdateEventCategory(user?.id);
updateCategory.mutate({ eventId: selected.id, categoryId: newCategoryId });

// Move to archived calendar
const updateCalendar = useUpdateEventCalendar(user?.id);
updateCalendar.mutate({ eventId: selected.id, calendarId: archivedCalendarId });

// Personas
const { data: personas = [] } = useAIPersonas(user?.id);
```

---

## 12) Checklist

- [ ] Replace legacy event hooks with `domains/events.ts` hooks.
- [ ] Add personas/calendars/categories domains (copy pattern above).
- [ ] Ensure provider mounts `DataLayerBootstrap` and injects QueryClient from a single place.
- [ ] Verify optimistic create shows instantly (the v5 `setQueriesData({ predicate })` pattern fixes your earlier cache‑match bug).
- [ ] Verify realtime updates reflect without reload.
- [ ] Verify offline create/update/delete flow and reconnection reconciliation.
- [ ] Confirm archive flow is just `calendar_id` swap.
- [ ] Keep AI chat separate; only personas go through data layer.

---

## 13) Notes on types & timestamp normalization

- All timestamps are normalized to ISO **at the boundary** (mapping.ts), so the rest of the app can safely use `new Date(iso)`.
- Supabase generated types remain intact for server rows; we map to client rows in Dexie and **do not mutate the server types**.

---

## 14) Future hardening

- Background reconciliation job to compare Dexie vs server for a window and auto‑heal drift.
- Conflict markers for offline edits on the same record (simple `dirty` flag + updated_at compare).
- Batched upserts for initial window hydration (already efficient, but can chunk by 500).

---

- Makes Dexie the single source of truth (events, EDP, calendars, categories, AI personas).
- Replaces ad-hoc hooks with a unified domain API (queries + optimistic mutations).
- Subscribes to base tables only and patches TanStack v5 caches correctly (fixes your optimistic‐update cache-match bug).
- Leaves AI chat separate while keeping AI personas in the data layer.
- Includes code for keys.ts, mapping.ts, dexie.ts, assembly.ts, domains/events.ts, domains/personas.ts, realtime subscriptions.ts, and provider wiring.

**End.**

