# calendar-mono — Offline‑First Data Layer (Dexie + TanStack Query + Supabase Realtime)

**Audience:** engineers working on `calendar-mono`

**Goal:** a single, offline‑first data layer backed by Dexie (IndexedDB), TanStack Query, and Supabase (PostgREST + Realtime) for **user profiles, calendars, categories, events (+ personal details), and AI personas**. The **AI assistant chat** remains a separate workload.

---

## 0) Design overview

- **Base tables only** (no SQL views) so Supabase Realtime can emit changes.
- **Time model**: canonical `start_time`, `end_time` (`timestamptz`) + **generated, stored** `start_time_ms`, `end_time_ms` (`bigint`) in Postgres. Clients **never write the `*_ms` columns**.
- **Overlap semantics** for range queries: an event is in window `[from, to]` (ms) iff
  
  `end_time_ms >= from AND start_time_ms <= to`

- **Offline‑first**: all reads/writes flow through the data layer; Dexie is our local cache; Realtime reconciles.
- **Consistent hooks**: domain hooks per entity; no rogue Supabase calls in components.

---

## 1) Database (authoritative)

### 1.1 Events table

```sql
-- Canonical instants
ALTER TABLE public.events
  ALTER COLUMN start_time TYPE timestamptz USING start_time::timestamptz,
  ALTER COLUMN end_time   TYPE timestamptz USING end_time::timestamptz,
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time   SET NOT NULL;

-- Guard rails
ALTER TABLE public.events
  ADD CONSTRAINT IF NOT EXISTS events_end_after_start CHECK (end_time >= start_time);

-- Generated, stored milliseconds (server‑authoritative)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_time_ms bigint
    GENERATED ALWAYS AS ((extract(epoch FROM start_time) * 1000)::bigint) STORED,
  ADD COLUMN IF NOT EXISTS end_time_ms bigint
    GENERATED ALWAYS AS ((extract(epoch FROM end_time) * 1000)::bigint) STORED;

-- Indexes for overlap scans & owner scoping
CREATE INDEX IF NOT EXISTS events_owner_start_ms_idx ON public.events (owner_id, start_time_ms);
CREATE INDEX IF NOT EXISTS events_owner_end_ms_idx   ON public.events (owner_id, end_time_ms);
CREATE INDEX IF NOT EXISTS events_start_ms_idx       ON public.events (start_time_ms);
CREATE INDEX IF NOT EXISTS events_end_ms_idx         ON public.events (end_time_ms);
```

**Online overlap predicate** (any event overlapping `[from, to]` in ms):

```
end_time_ms >= :from AND start_time_ms <= :to
```

### 1.2 Personal details

`event_details_personal(event_id, user_id, calendar_id, category_id, show_time_as, time_defense_level, ai_managed, ai_instructions, updated_at)`

- Composite PK: `(event_id, user_id)`
- FKs to `events`, `user_calendars`, `user_categories`
- Optional trigger to create the owner’s default EDP row on event INSERT (nice to have; not required).

### 1.3 Other tables

- `user_profiles` (auth user id)
- `user_calendars` (recommend at least one **default** and one **archived** calendar per user)
- `user_categories`
- `ai_personas`

---

## 2) Types & mapping

### 2.1 Server types (from Supabase codegen)

```ts
// base/server-types.ts
import type { Database } from '@/types/supabase';

export type ServerUserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type ServerCalendar    = Database['public']['Tables']['user_calendars']['Row'];
export type ServerCategory    = Database['public']['Tables']['user_categories']['Row'];
export type ServerPersona     = Database['public']['Tables']['ai_personas']['Row'];

export type ServerEvent       = Database['public']['Tables']['events']['Row'];
export type ServerEDP         = Database['public']['Tables']['event_details_personal']['Row'];

export type ServerEventInsert = Database['public']['Tables']['events']['Insert'];
export type ServerEventUpdate = Database['public']['Tables']['events']['Update'];
export type ServerEDPInsert   = Database['public']['Tables']['event_details_personal']['Insert'];
export type ServerEDPUpdate   = Database['public']['Tables']['event_details_personal']['Update'];
```

### 2.2 Client types

```ts
// base/client-types.ts
export type ISO = string; // ISO UTC string

export type ClientEvent = Omit<ServerEvent,
  'start_time' | 'end_time' | 'created_at' | 'updated_at'
> & {
  start_time: ISO;
  end_time:   ISO;
  created_at: ISO;
  updated_at: ISO;
  // ms columns come from DB, but we store as numbers locally
  start_time_ms: number;
  end_time_ms:   number;
};

export type ClientEDP = Omit<ServerEDP, 'updated_at'> & { updated_at: ISO };

// Rich, assembled event the UI consumes
export type AssembledEvent = ClientEvent & {
  // Personal details (with defaults)
  show_time_as: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
  time_defense_level: 'flexible' | 'normal' | 'high' | 'hard_block';
  ai_managed: boolean;
  ai_instructions: string | null;

  // Lookups (optional enrichments)
  calendar: { id: string; name: string; color: string } | null;
  category: { id: string; name: string; color: string } | null;

  // Convenience flags
  role: 'owner' | 'viewer';
  following: boolean;
};
```

### 2.3 Mapping (server → client)

```ts
// base/mapping.ts
import type { ServerEvent, ServerEDP } from './server-types';
import type { ClientEvent, ClientEDP } from './client-types';

const toISO = (s: string | null | undefined) => (s ? new Date(s).toISOString() : s ?? null);

export const mapEventFromServer = (row: ServerEvent): ClientEvent => ({
  ...row,
  start_time: toISO(row.start_time)!,
  end_time:   toISO(row.end_time)!,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
  // Supabase bigint often comes back as string → normalize
  start_time_ms: Number((row as any).start_time_ms),
  end_time_ms:   Number((row as any).end_time_ms),
});

export const mapEDPFromServer = (row: ServerEDP): ClientEDP => ({
  ...row,
  updated_at: toISO(row.updated_at)!,
});
```

> **Client → server**: send only ISO `start_time`, `end_time` (and other base/EDP fields). **Never send** the `*_ms` fields.

---

## 3) Dexie schema

```ts
// base/dexie.ts (excerpt)
import Dexie, { Table } from 'dexie';
import type { ClientEvent, ClientEDP } from './client-types';

export class AppDB extends Dexie {
  events!: Table<ClientEvent, string>;
  event_details_personal!: Table<ClientEDP, [string, string]>; // [event_id+user_id]
  user_calendars!: Table<any, string>;
  user_categories!: Table<any, string>;
  ai_personas!: Table<any, string>;

  constructor() {
    super('calendar-db');

    this.version(8).stores({
      events: 'id, owner_id, start_time_ms, end_time_ms, updated_at, [owner_id+start_time_ms]',
      event_details_personal: '[event_id+user_id], user_id, calendar_id, category_id, updated_at',
      user_calendars: 'id, user_id, is_default, updated_at',
      user_categories: 'id, user_id, updated_at',
      ai_personas: 'id, user_id, updated_at',
    });
  }
}

export const db = new AppDB();
```

**Offline overlap query**:

```ts
// any event overlapping [from, to]
const list = await db.events
  .where('start_time_ms')
  .belowOrEqual(to)
  .and(e => e.end_time_ms >= from)
  .toArray();
```

---

## 4) Assembly

```ts
// base/assembly.ts
import { db } from './dexie';
import type { AssembledEvent, ClientEvent } from './client-types';

export async function assembleEvent(ev: ClientEvent, userId: string): Promise<AssembledEvent> {
  const edp = await db.event_details_personal.get([ev.id, userId]);
  const calendar = edp?.calendar_id ? await db.user_calendars.get(edp.calendar_id) : null;
  const category = edp?.category_id ? await db.user_categories.get(edp.category_id) : null;

  return {
    ...ev,
    show_time_as: edp?.show_time_as ?? 'busy',
    time_defense_level: edp?.time_defense_level ?? 'normal',
    ai_managed: edp?.ai_managed ?? false,
    ai_instructions: edp?.ai_instructions ?? null,
    calendar: calendar ? { id: calendar.id, name: calendar.name, color: calendar.color } : null,
    category: category ? { id: category.id, name: category.name, color: category.color ?? 'neutral' } : null,
    role: ev.owner_id === userId ? 'owner' : 'viewer',
    following: false,
  };
}

export async function assembleEvents(events: ClientEvent[], userId: string) {
  return Promise.all(events.map((e) => assembleEvent(e, userId)));
}
```

---

## 5) Query keys

```ts
// base/keys.ts
export const keys = {
  eventsRange: (uid: string, from: number, to: number) => ['events', { uid, from, to }] as const,
  event: (uid: string, id: string) => ['event', { uid, id }] as const,
  calendars: (uid: string) => ['calendars', { uid }] as const,
  categories: (uid: string) => ['categories', { uid }] as const,
  personas: (uid: string) => ['personas', { uid }] as const,
  profile: (uid: string) => ['profile', { uid }] as const,
};
```

---

## 6) Domains — Events

```ts
// domains/events.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapEventFromServer, mapEDPFromServer } from '../base/mapping';
import { assembleEvent, assembleEvents } from '../base/assembly';
import type { AssembledEvent, ClientEvent } from '../base/client-types';

const overlaps = (Afrom: number, Ato: number, Bstart: number, Bend: number) => Bend >= Afrom && Bstart <= Ato;

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

      const id = crypto.randomUUID();
      const startMs = Date.parse(input.start_time);
      const endMs = Date.parse(input.end_time);
      const now = new Date().toISOString();

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
      } as any;

      // default calendar if none
      const defaultCal = input.calendar_id
        ?? (await db.user_calendars.where({ user_id: uid, is_default: true }).first())?.id
        ?? null;

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
          updated_at: now,
        } as any);
      });

      // patch overlapping ranges in cache
      qc.setQueriesData({ queryKey: ['events'], predicate: q => {
        const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
        return vars?.uid === uid && overlaps(vars.from!, vars.to!, startMs, endMs);
      }}, (old?: AssembledEvent[]) => (old ?? []).concat());

      // server insert
      const { data: server, error } = await supabase
        .from('events')
        .insert({ id, owner_id: uid, creator_id: uid, title: input.title, start_time: input.start_time, end_time: input.end_time })
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
      event?: Partial<Pick<ClientEvent, 'title' | 'start_time' | 'end_time' | 'private'>>;
      personal?: Partial<{ calendar_id: string; category_id: string; show_time_as: 'free'|'tentative'|'busy'|'oof'|'working_elsewhere'; time_defense_level: 'flexible'|'normal'|'high'|'hard_block'; ai_managed: boolean; ai_instructions: string | null; }>
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic Dexie change
      await db.transaction('rw', db.events, db.event_details_personal, async () => {
        if (input.event) {
          const ex = await db.events.get(input.id);
          if (ex) {
            const nextStart = input.event.start_time ?? ex.start_time;
            const nextEnd = input.event.end_time ?? ex.end_time;
            await db.events.put({ ...ex, ...input.event, start_time_ms: Date.parse(nextStart), end_time_ms: Date.parse(nextEnd), updated_at: new Date().toISOString() });
          }
        }
        if (input.personal) {
          const edp = (await db.event_details_personal.get([input.id, uid])) ?? { event_id: input.id, user_id: uid };
          await db.event_details_personal.put({ ...edp, ...input.personal, updated_at: new Date().toISOString() } as any);
        }
      });

      // server update
      if (input.event && Object.keys(input.event).length) {
        const { error } = await supabase.from('events').update(input.event as any).eq('id', input.id);
        if (error) throw error;
      }
      if (input.personal && Object.keys(input.personal).length) {
        const { error } = await supabase.from('event_details_personal').upsert({ event_id: input.id, user_id: uid, ...input.personal } as any);
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
  return useMutation({ mutationFn: ({ id, calendar_id }: { id: string; calendar_id: string }) => m.mutateAsync({ id, personal: { calendar_id } }) });
};
export const useUpdateEventCategory = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({ mutationFn: ({ id, category_id }: { id: string; category_id: string }) => m.mutateAsync({ id, personal: { category_id } }) });
};
export const useUpdateEventShowTimeAs = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({ mutationFn: ({ id, show_time_as }: { id: string; show_time_as: 'free'|'tentative'|'busy'|'oof'|'working_elsewhere' }) => m.mutateAsync({ id, personal: { show_time_as } }) });
};
export const useUpdateEventTimeDefense = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({ mutationFn: ({ id, time_defense_level }: { id: string; time_defense_level: 'flexible'|'normal'|'high'|'hard_block' }) => m.mutateAsync({ id, personal: { time_defense_level } }) });
};
export const useUpdateEventAI = (uid?: string) => {
  const m = useUpdateEvent(uid);
  return useMutation({ mutationFn: ({ id, ai_managed, ai_instructions }: { id: string; ai_managed: boolean; ai_instructions?: string | null }) => m.mutateAsync({ id, personal: { ai_managed, ai_instructions: ai_instructions ?? null } }) });
};
```

---

## 7) Domains — Calendars, Categories, Personas (outline)

> These follow the same pattern as Events: read from Supabase, write to Dexie, expose CRUD hooks, and patch Realtime.

- `domains/calendars.ts`
  - `useUserCalendars(uid)`
  - `useCreateCalendar(uid)` / `useUpdateCalendar(uid)` / `useDeleteCalendar(uid)`
- `domains/categories.ts`
  - `useUserCategories(uid)`
  - `useCreateCategory(uid)` / `useUpdateCategory(uid)` / `useDeleteCategory(uid)`
- `domains/personas.ts`
  - `usePersonas(uid)`
  - `useCreatePersona(uid)` / `useUpdatePersona(uid)` / `useDeletePersona(uid)`

All persist to Dexie and expose stable query keys in `base/keys.ts`.

---

## 8) Realtime

```ts
// realtime/subscriptions.ts (excerpt)
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { mapEventFromServer, mapEDPFromServer } from '../base/mapping';

export function startRealtime(uid: string, patch: (type: 'events' | 'edp' | 'cal' | 'cat' | 'persona', ids?: string[]) => void) {
  const ch = supabase
    .channel(`user:${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;
      if (eventType === 'DELETE') {
        await db.events.delete(o.id);
      } else {
        await db.events.put(mapEventFromServer(n));
      }
      patch('events', [n?.id ?? o?.id]);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_details_personal', filter: `user_id=eq.${uid}` }, async (payload) => {
      const { eventType, new: n, old: o } = payload as any;
      if (eventType === 'DELETE') {
        await db.event_details_personal.delete([o.event_id, o.user_id]);
      } else {
        await db.event_details_personal.put(mapEDPFromServer(n));
      }
      patch('edp', [n?.event_id ?? o?.event_id]);
    })
    // add similar handlers for user_calendars, user_categories, ai_personas
    .subscribe();

  return () => supabase.removeChannel(ch);
}
```

The `patch` callback should **setQueriesData / invalidate** overlapping `events` ranges using the same overlap predicate.

---

## 9) Providers & persistence

Use TanStack PersistQueryClientProvider with an IndexedDB persister (IDB/AsyncStorage). Your existing provider is fine; ensure you call `navigator.storage.persist?.()` and **persist the Query Cache** (not just Dexie).

---

## 10) Component migration (high impact)

- **EventCard** renders from `AssembledEvent` only; all quick actions call the convenience hooks (update calendar/category/showTimeAs/timeDefense/AI) — no direct Supabase calls.
- **ActionBar** uses bulk operations by iterating over selected IDs and calling the same convenience hooks.
- **Calendar grid** uses `useEventsRange(userId, { from, to })` and renders `AssembledEvent[]`.

(See separate doc “High‑Impact Components — Event Card & Action Bar (Data‑Layer Ready)” for drop‑in code.)

---

## 11) Testing checklist

- **Offline create/update/delete** → visible immediately, reconciles on reconnect.
- **Overlap queries** return spanning events correctly across day/week/month.
- **Realtime** replaces optimistic ms with server ms; edits appear on another tab.
- **Calendars/Categories/Personas** CRUD flows through data layer; components never call Supabase directly.
- **Timezones**: all network payloads are ISO UTC; DB uses `timestamptz`.

---

## 12) Migration plan

1. Add DB generated `start_time_ms` / `end_time_ms` + indexes.
2. Update mappers to **cast bigint → number** and normalize ISO.
3. Update Dexie schema (version bump) with `start_time_ms`, `end_time_ms` indexes.
4. Replace events queries/mutations with domain hooks above.
5. Wire Realtime handlers to write into Dexie + patch caches.
6. Migrate EventCard/ActionBar components to data‑layer hooks.
7. Remove any remaining rogue hooks.

---

## 13) Notes & guardrails

- **Do not** persist or send `*_ms` from the client; they are **server‑computed**.
- Always send UTC ISO for timestamps.
- Use the **overlap predicate** for all ranges (both online & offline).
- Prefer **assemble → render**: components only touch `AssembledEvent`.
- Keep AI assistant chat separate (streaming/LLM‑specific transport) — **AI personas** live in this data layer, but chat threads/messages do not.
