# Offline‑First Data Layer — Final Plan (No Feature Flags)

This is the definitive plan to make **/apps/calendar** truly **offline‑first** with **Dexie as the single source of truth**. No kill switches, no wrappers sprinkled around. Reads always come from Dexie; sync happens in the background; components don’t touch Supabase directly.

---

## Goals

- **Offline‑first by design**: UI reads **Dexie** (instant; works offline).
- **One black‑box interface** for app code: hooks/functions per domain that hit Dexie only.
- **Background sync** merges server changes into Dexie via pull + outbox push + realtime.
- **No UX regressions**: online behavior remains fast and consistent.
- **Small surface change**: domain hooks converted to Dexie reads; mutations become Dexie‑first + queue.

---
a
## Architecture Overview

```
UI → Domain Hooks (Dexie read) → Dexie (source of truth)
                                   ↘ Sync Engine ↔ Supabase (pull/push)
Supabase Realtime → Sync Engine → Dexie (upsert/delete) → UI updates
```

### Core principles
- **Reads = Dexie only.**
- **Writes = Dexie first** (optimistic) + **enqueue** to Outbox for eventual push.
- **Sync Engine** performs: Pull (since watermark), Push (drain outbox, backoff), Realtime (apply deltas).
- **LWW** conflict policy using `updated_at` (extendable later).
- **One import surface** for data: `@/lib/data` (hooks & domain functions). Types live in `@/types`.

---

## Directory & Files

Create/confirm the following inside **/apps/calendar**:

```
apps/calendar/
  src/
    lib/
      data/
        base/
          client.ts           # Supabase client init
          dexie.ts            # Dexie schema (tables, indexes)
          sync.ts             # One sync engine (pull/push/realtime)
        domains/
          personas.ts         # Dexie reads + Dexie-first mutations
          profiles.ts
          calendars.ts
          categories.ts
          events.ts
        index.ts              # Barrel: export domain hooks & fns
    providers/
      DataProvider.tsx        # start/stop sync on auth
  docs/
    offline-first-plan-final.md  # (optional) this document
```

> **Rule:** Only `base/sync.ts` and `base/client.ts` talk to Supabase. Domain files read/write Dexie and enqueue to Outbox.

---

## Dexie Schema (dexie.ts)

Define tables and indexes that support fast queries and clean sync. Adjust field lists to your schema, keeping `updated_at` and `user_id` where relevant.

```ts
// apps/calendar/src/lib/data/base/dexie.ts
import Dexie, { Table } from 'dexie'

export type UUID = string

// Personas -------------------------------------------------
export interface AIPersonaRow {
  id: UUID
  user_id: UUID
  name: string
  avatar_url?: string | null
  system_prompt?: string | null
  updated_at: string                 // ISO; LWW
  _pending?: boolean                 // local optimistic flag
  _error?: string | null             // last push error (optional)
}

// Profiles -------------------------------------------------
export interface UserProfileRow {
  id: UUID
  email: string
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  title?: string | null
  organization?: string | null
  avatar_url?: string | null
  timezone: string
  time_format: '12_hour' | '24_hour'
  week_start_day: string            // align to DB enum type
  work_schedule?: any | null
  updated_at: string
}

// Calendars -----------------------------------------------
export interface UserCalendarRow {
  id: UUID
  user_id: UUID
  name: string
  color: string
  visible: boolean
  is_default: boolean
  updated_at: string
}

// Categories ----------------------------------------------
export interface UserCategoryRow {
  id: UUID
  user_id: UUID
  name: string
  color: string
  is_default: boolean
  updated_at: string
}

// Events (base) -------------------------------------------
export interface EventRow {
  id: UUID
  owner_id: UUID
  title: string
  start_time: string                // ISO
  duration: number                  // minutes
  all_day: boolean
  private: boolean
  start_timestamp_ms: number
  end_timestamp_ms: number
  updated_at: string
}

// Optional: per-user overlays if you use them (EDP/roles) --
export interface EventPersonalRow {
  event_id: UUID
  user_id: UUID
  calendar_id: UUID | null
  category_id: UUID | null
  show_time_as: 'free'|'tentative'|'busy'|'oof'|'working_elsewhere'
  time_defense_level: 'flexible'|'normal'|'high'|'hard_block'
  ai_managed: boolean
  ai_instructions?: string | null
  updated_at: string
}

export interface EventUserRoleRow {
  event_id: UUID
  user_id: UUID
  role: 'viewer'|'contributor'|'owner'|'delegate_full'
  rsvp: 'tentative'|'accepted'|'declined'|null
  following: boolean
  updated_at: string
}

// Meta & Outbox -------------------------------------------
export interface MetaRow { key: string; value: string }

export interface OutboxItem {
  id: UUID
  user_id: UUID
  table: 'ai_personas' | 'user_profiles' | 'user_calendars' | 'user_categories' | 'events' | 'event_details_personal' | 'event_user_roles'
  op: 'upsert' | 'delete'
  payload: any
  attempts: number
  created_at: number
}

export class AppDB extends Dexie {
  ai_personas!: Table<AIPersonaRow, UUID>
  user_profiles!: Table<UserProfileRow, UUID>
  user_calendars!: Table<UserCalendarRow, UUID>
  user_categories!: Table<UserCategoryRow, UUID>
  events!: Table<EventRow, UUID>
  event_details_personal!: Table<EventPersonalRow, [UUID, UUID]> // [event_id, user_id] if desired
  event_user_roles!: Table<EventUserRoleRow, [UUID, UUID]>
  meta!: Table<MetaRow, string>
  outbox!: Table<OutboxItem, UUID>

  constructor() {
    super('calendar-app')
    this.version(1).stores({
      ai_personas: 'id, user_id, updated_at',
      user_profiles: 'id, updated_at',
      user_calendars: 'id, user_id, updated_at, visible',
      user_categories: 'id, user_id, updated_at',
      events: 'id, owner_id, start_timestamp_ms, updated_at, calendar_id', // add calendar_id if stored here
      event_details_personal: '[event_id+user_id], user_id, calendar_id, updated_at',
      event_user_roles: '[event_id+user_id], user_id, updated_at',
      meta: 'key',
      outbox: 'id, user_id, table, op, created_at, attempts',
    })
  }
}

export const db = new AppDB()
```

> Indexes include the hot paths: `user_id`, `start_timestamp_ms`, `updated_at`, etc.

---

## Sync Engine (sync.ts)

One module performs **pull**, **push**, and **realtime**. Call `startSync(userId)` once when the user logs in; call `stopSync()` on logout/unmount.

Key ideas:
- **Watermarks** in `meta` per table/user: `wm:<table>:<user_id>` (ISO string). Pull uses `> updated_at`.
- **Outbox**: queue of pending ops. Push drains with simple backoff using `attempts`.
- **Realtime**: for each table, subscribe to `postgres_changes` filtered by the user.
- **Transactions**: every Dexie write bundle runs inside a transaction.

Skeleton:

```ts
// apps/calendar/src/lib/data/base/sync.ts
import { db } from './dexie'
import { supabase } from './client'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()

async function getWM(key: string) { return (await db.meta.get(key))?.value }
async function setWM(key: string, value: string) { await db.meta.put({ key, value }) }

// -------------------- PULL --------------------
async function pullPersonas(userId: string) {
  const wmKey = `wm:ai_personas:${userId}`
  const since = await getWM(wmKey)
  let q = supabase.from('ai_personas')
    .select('id,user_id,name,avatar_url,system_prompt,updated_at')
    .eq('user_id', userId)
  if (since) q = q.gt('updated_at', since as string)
  const { data, error } = await q
  if (error) throw error
  await db.transaction('rw', db.ai_personas, db.meta, async () => {
    for (const row of data ?? []) {
      const existing = await db.ai_personas.get(row.id)
      if (!existing || existing.updated_at < row.updated_at) {
        await db.ai_personas.put({ ...row, _pending: false, _error: null })
      }
    }
    await setWM(wmKey, nowIso())
  })
}

// Repeat pullX for: user_profiles, user_calendars, user_categories, events (+ overlays if used)
// For events, accept a time window to limit scope (e.g., now±60d) or full if dataset is small.

// -------------------- PUSH (Outbox) --------------------
async function pushOutbox(userId: string) {
  const items = await db.outbox.where('user_id').equals(userId).sortBy('created_at')
  for (const item of items) {
    try {
      if (item.table === 'ai_personas') {
        if (item.op === 'upsert') {
          const r = item.payload
          const { data, error } = await supabase
            .from('ai_personas')
            .upsert({
              id: r.id, user_id: r.user_id, name: r.name,
              avatar_url: r.avatar_url ?? null,
              system_prompt: r.system_prompt ?? null,
              updated_at: r.updated_at,
            })
            .select()
            .single()
          if (error) throw error
          await db.transaction('rw', db.ai_personas, db.outbox, async () => {
            await db.ai_personas.put({ ...data, _pending: false, _error: null } as any)
            await db.outbox.delete(item.id)
          })
        } else if (item.op === 'delete') {
          const { error } = await supabase
            .from('ai_personas')
            .delete()
            .eq('id', item.payload.id)
            .eq('user_id', userId)
          if (error) throw error
          await db.outbox.delete(item.id)
        }
      }
      // TODO: handle other tables similarly
    } catch (e) {
      await db.outbox.update(item.id, { attempts: item.attempts + 1 })
      const backoff = Math.min(30_000, (item.attempts + 1) * 1000)
      await sleep(backoff)
    }
  }
}

// -------------------- REALTIME --------------------
function subscribePersonas(userId: string) {
  const ch = supabase
    .channel(`ai_personas:${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'ai_personas', filter: `user_id=eq.${userId}`
    }, async (payload) => {
      if (payload.eventType === 'DELETE') {
        if (payload.old?.id) await db.ai_personas.delete(payload.old.id)
        return
      }
      const r = payload.new as any
      if (r?.id) await db.ai_personas.put({ ...r, _pending: false, _error: null })
    })
    .subscribe()
  return () => supabase.removeChannel(ch)
}

// TODO: subscribeProfiles/calendars/categories/events in the same pattern

// -------------------- ORCHESTRATION --------------------
let stops: Array<() => void> = []
let running = false

export function startSync(userId: string) {
  stopSync()
  running = true

  const tick = async () => {
    if (!running) return
    try {
      await pullPersonas(userId)
      // TODO: pullProfiles/userCalendars/userCategories/events
      await pushOutbox(userId)
    } catch {}
  }

  // initial + listeners
  tick()
  const onFocus = () => tick()
  const onOnline = () => tick()
  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onOnline)
  const unsubRT = subscribePersonas(userId)

  stops = [
    () => { running = false },
    () => window.removeEventListener('focus', onFocus),
    () => window.removeEventListener('online', onOnline),
    () => unsubRT(),
  ]
}

export function stopSync() {
  for (const f of stops) try { f() } catch {}
  stops = []
  running = false
}
```

> Extend `pullX`/`subscribeX`/push handling for **profiles, calendars, categories, events**. For events, use a sliding time window that matches your UI’s fetch range.

---

## Domain Hooks & Mutations

Each **domain file** exposes:
- A **read hook** that returns Dexie data via `useLiveQuery` (no network, no spinners when cached).
- **Mutation functions** that write Dexie first and enqueue an Outbox job. The sync engine will push.

### Personas (example domain)

```ts
// apps/calendar/src/lib/data/domains/personas.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '../base/dexie'
import type { AIPersonaDTO } from '@/types'

export function useAIPersonas(userId?: string) {
  return useLiveQuery(async () => {
    if (!userId) return [] as AIPersonaDTO[]
    return (await db.ai_personas.where('user_id').equals(userId).sortBy('name')) as AIPersonaDTO[]
  }, [userId], [] as AIPersonaDTO[])
}

export async function createPersona(userId: string, input: { name: string; avatar_url?: string | null; system_prompt?: string | null }) {
  const row = {
    id: uuid(), user_id: userId, name: input.name,
    avatar_url: input.avatar_url ?? null, system_prompt: input.system_prompt ?? null,
    updated_at: new Date().toISOString(), _pending: true, _error: null,
  }
  await db.transaction('rw', db.ai_personas, db.outbox, async () => {
    await db.ai_personas.put(row as any)
    await db.outbox.put({ id: uuid(), user_id: userId, table: 'ai_personas', op: 'upsert', payload: row, attempts: 0, created_at: Date.now() })
  })
}

export async function updatePersona(userId: string, id: string, patch: Partial<Pick<AIPersonaDTO, 'name'|'avatar_url'|'system_prompt'>>) {
  await db.transaction('rw', db.ai_personas, db.outbox, async () => {
    const cur = await db.ai_personas.get(id)
    if (!cur) return
    const next = { ...cur, ...patch, updated_at: new Date().toISOString(), _pending: true, _error: null }
    await db.ai_personas.put(next as any)
    await db.outbox.put({ id: uuid(), user_id: userId, table: 'ai_personas', op: 'upsert', payload: next, attempts: 0, created_at: Date.now() })
  })
}

export async function deletePersona(userId: string, id: string) {
  await db.transaction('rw', db.ai_personas, db.outbox, async () => {
    const cur = await db.ai_personas.get(id)
    if (!cur) return
    await db.ai_personas.delete(id)
    await db.outbox.put({ id: uuid(), user_id: userId, table: 'ai_personas', op: 'delete', payload: { id }, attempts: 0, created_at: Date.now() })
  })
}
```

> Repeat the same pattern for **profiles**, **calendars**, **categories**, and **events**. For events reads, use Dexie range indexes such as `start_timestamp_ms` and/or `calendar_id`.

### Events (read shape sketch)

```ts
// apps/calendar/src/lib/data/domains/events.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../base/dexie'
import type { EventDTO } from '@/types'

export function useEventsRange(userId: string | undefined, opts: { from: number; to: number; calendarIds?: string[] }) {
  return useLiveQuery(async () => {
    if (!userId) return [] as EventDTO[]
    // Example: range by start_timestamp_ms, then filter by calendarIds if provided
    let rows = await db.events
      .where('start_timestamp_ms').between(opts.from, opts.to, true, true)
      .toArray()

    // If you store per-user overlay in event_details_personal, join here from Dexie to produce EventDTO
    // Otherwise if base event includes calendar_id, filter inline
    if (opts.calendarIds?.length) rows = rows.filter(r => (r as any).calendar_id && opts.calendarIds!.includes((r as any).calendar_id))

    // Map to EventDTO (keep mapping stateless and fast)
    return rows as unknown as EventDTO[]
  }, [userId, opts.from, opts.to, JSON.stringify(opts.calendarIds ?? [])], [] as EventDTO[])
}
```

> Keep assembly stateless; if you rely on `event_details_personal`, read from that Dexie table and merge locally before returning `EventDTO`.

---

## Data Provider (start sync on auth)

```tsx
// apps/calendar/src/providers/DataProvider.tsx
'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { startSync, stopSync } from '@/lib/data/base/sync'

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  useEffect(() => {
    if (user?.id) startSync(user.id)
    return () => stopSync()
  }, [user?.id])
  return <>{children}</>
}
```

Wrap your app with `DataProvider` (alongside your QueryProvider if you keep it for other concerns). The Query cache isn’t on the hot read path anymore.

---

## Barrel Exports (index.ts)

```ts
// apps/calendar/src/lib/data/index.ts
export * from './domains/personas'
export * from './domains/profiles'
export * from './domains/calendars'
export * from './domains/categories'
export * from './domains/events'
```

Usage stays clean:

```ts
import { useAIPersonas, createPersona } from '@/lib/data'
```

---

## Types Placement (`@/types`)

- Put DTOs/unions/constants in `src/types` (at the repo root) and import types into domain files.
- Example: `EventDTO`, `AIPersonaDTO`, `ShowTimeAs`, `TimeDefenseLevel`, etc.
- Supabase codegen → `src/types/db.ts`. Domain DTOs → `src/types/domain.ts`.

```ts
// src/types/domain.ts
export type AIPersonaDTO = {
  id: string; user_id: string; name: string;
  avatar_url?: string | null; system_prompt?: string | null; updated_at: string
}

export type EventDTO = { /* assembled event shape */ }
```

---

## Realtime Coverage

Subscribe in `sync.ts` for:
- `ai_personas` — filter `user_id = current user`
- `user_profiles` — `id = current user`
- `user_calendars` — `user_id = current user`
- `user_categories` — `user_id = current user`
- `events` — `owner_id = current user` (and, if applicable, shared roles)
- `event_details_personal` — `user_id = current user`
- `event_user_roles` — `user_id = current user`

All handlers: **upsert/delete into Dexie**; never touch UI state directly.

---

## Conflict Policy

- Use **Last‑Writer‑Wins** via `updated_at`.
- Pull compares Dexie existing vs server row; replace if `existing.updated_at < incoming.updated_at`.
- On push success, replace local row with server canonical to converge.
- If you later need stronger guarantees, add a `_rev`/hash and compare field‑by‑field in `sync.ts`.

---

## Event Window Strategy

- For performance, pull events within a sliding window that matches UI (e.g., `now ± 60 days`).
- Maintain per‑user event watermark **and** last pulled window in `meta` (e.g., `wm:events:${userId}:from`, `:to`).
- If user navigates outside the cached range, trigger a targeted pull for the new range, then serve Dexie.

---

## Hardening & Reliability

- **Transactions** for every multi‑table write (Dexie ensures atomicity within its scope).
- **Backoff**: push retries increase `attempts`, sleep `min(30s, attempts * 1s)`.
- **Online/Focus** listeners trigger `pull+push`.
- **Startup** performs one `pull` then `push` to converge quickly.
- **Persistent Storage**: request via `navigator.storage.persist?.()` in your root provider.
- **Account switching**: Dexie tables are keyed by `user_id`; on logout you may clear tables for the previous user if necessary.

---

## Guardrails (prevent regressions)

- ESLint rule in **apps/calendar** to block direct Supabase reads outside `base/sync.ts` and `base/client.ts`:

```jsonc
{
  "rules": {
    "no-restricted-syntax": ["error", {
      "selector": "CallExpression[callee.object.name='supabase'][callee.property.name='from']",
      "message": "Direct Supabase access is not allowed in app code. Use Dexie via domain hooks; network lives in base/sync.ts."
    }]
  }
}
```

- Code review checklist: “Does this read hit Dexie? Are network calls confined to sync.ts?”

---

## Migration Order (no back‑compat layer)

1. **Wire core**: `dexie.ts`, `sync.ts`, `DataProvider.tsx`, startSync on login.
2. **Personas**: switch reads to Dexie; mutations to Dexie‑first + Outbox; add personas pull/push/rt.
3. **Profiles**: convert reads/mutations; pull/profile realtime by `id = user.id`.
4. **Calendars & Categories**: convert; ensure indexes on `user_id, updated_at`.
5. **Events**: convert reads to Dexie range; mutations Dexie‑first; realtime for `events` and overlays; add sliding window pulls.
6. **Purge direct Supabase calls** in `/apps/calendar` (ripgrep `supabase.from(`) except inside `base/sync.ts`.

Each step is shippable; UX remains unchanged; offline starts working per domain as you convert it.

---

## Testing Checklist

- **Offline Reads**: Disable network → all converted domains still render (Dexie).
- **Optimistic Writes**: Offline create/update/delete → immediate UI change; on reconnect, outbox drains; `_pending` clears.
- **Realtime**: External change via SQL/other client → appears in UI within seconds (Dexie updated by realtime).
- **Navigation**: Event range navigation triggers pulls for new windows, then reads Dexie instantly.
- **Cold Start**: First load online pulls; subsequent loads offline render from Dexie.

---

## What Does Not Change

- Component call‑sites remain simple:

```tsx
import { useAIPersonas, createPersona } from '@/lib/data'
```

- Your React Query provider can stay for unrelated features, but **reads for these domains no longer use React Query**.
- Domain types stay in `@/types`; data layer imports types only.

---

## Future Enhancements (optional)

- **Outbox backoff policy** tuning + jitter.
- **Compression** for large payloads in outbox (rarely needed).
- **Field‑level conflict resolution** for events if collaboration increases.
- **Background periodic sync** (timer) in addition to focus/online triggers.

---

## Summary

- This plan makes Dexie the **source of truth**.
- Hooks return **local data**; sync is an implementation detail.
- You change **only domain files** and add a **single sync engine**.
- No feature flags. No duplicate layers. Clean, maintainable, and truly offline‑first.

