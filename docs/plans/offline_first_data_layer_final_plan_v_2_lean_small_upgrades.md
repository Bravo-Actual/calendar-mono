# ** Important!!! ** - FOLLOW THIS PLAN. REFER TO THE CODE IN THIS PLAN AND FOLLOW IT AS CLOSELY AS POSSIBLE. DO NOT GO ROGUE. DO NOT INTRODUCT LEGACY WRAPPERS AND OTHER BULLSHIT. SUCCESS = FOLLOWING THIS PLAN

# Offline‑First Data Layer

**ZERO SUPABASE INTERACTION IN UI LAYER. UI ONLY TALKS TO DEXIE.**

---

## Architecture

```
UI Components → useLiveQuery(Dexie) → Instant reads from local data
UI Components → mutation(Dexie) → Instant optimistic writes + outbox enqueue
                                        ↓
                               Background Sync Engine
                                   ↓              ↑
                            Supabase (pull/push) + Real-time subscriptions
```

**CRITICAL RULES:**
- **UI NEVER imports supabase** - only Dexie interactions
- **NO useQuery/useMutation** from TanStack Query in UI
- **ALL reads via useLiveQuery** - instant, offline-safe
- **ALL writes via Dexie-first mutations** - optimistic updates
- **Real-time subscriptions in sync engine** - live updates from other clients
- **useLiveQuery auto-rerenders** when Dexie data changes from real-time

---

## Core Principles

1. **Types align to actual Supabase schema** - use existing database.types.ts
2. **EventJoined type** for UI - merges events + event_details_personal + event_user_roles
3. **Zero Supabase in UI** - only useLiveQuery + Dexie mutations
4. **Real-time subscriptions** in background sync engine

---

## Directory & files

```
apps/calendar/
  src/lib/data/
    base/
      client.ts          # Supabase init (HMR‑safe singleton)
      dexie.ts           # Dexie schema & indexes (HMR‑safe singleton)
      sync.ts            # Pull / Push / Realtime (batching + jitter backoff + locks)
      useSyncStatus.ts   # tiny status hook (optional)
    domains/
      personas.ts        # Dexie reads + Dexie-first mutations
      profiles.ts
      calendars.ts
      categories.ts
      events.ts          # + assembled accessor
    index.ts             # Barrel exports
  src/providers/DataProvider.tsx   # startSync/stopSync on auth (with visibilitychange)
```

---

## SPA/HMR dev ergonomics

**Dexie singleton**
```ts
// apps/calendar/src/lib/data/base/dexie.ts
import Dexie, { Table } from 'dexie'
export class AppDB extends Dexie { /* ...tables... */ }

declare global { var __appDb: AppDB | undefined }
export const db = globalThis.__appDb ?? new AppDB('calendar-app')
if (!globalThis.__appDb) globalThis.__appDb = db
```

**Supabase singleton**
```ts
// apps/calendar/src/lib/data/base/client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
declare global { var __sb: SupabaseClient | undefined }
export const supabase = globalThis.__sb ?? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
if (!globalThis.__sb) globalThis.__sb = supabase
```

**Sync start/stop guard + visibility**
```ts
// apps/calendar/src/providers/DataProvider.tsx
'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { startSync, stopSync, tick } from '@/lib/data/base/sync'

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  useEffect(() => {
    navigator.storage?.persist?.().then(ok => { if (!ok) console.warn('Storage persistence not granted') })
  }, [])

  useEffect(() => {
    if (!user?.id) { stopSync(); return }
    startSync(user.id)
    const onVisible = () => { if (document.visibilityState === 'visible') tick(user.id) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', () => tick(user.id))
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', () => tick(user.id))
      stopSync()
    }
  }, [user?.id])

  return <>{children}</>
}
```

---

## Dexie schema upgrades (compound indexes)

**Why:** faster event range queries and calendar filtering.

```ts
// apps/calendar/src/lib/data/base/dexie.ts (excerpt)
export class AppDB extends Dexie {
  constructor(name = 'calendar-app') {
    super(name)
    this.version(2).stores({
      ai_personas: 'id, user_id, updated_at',
      user_profiles: 'id, updated_at',
      user_calendars: 'id, user_id, updated_at, visible',
      user_categories: 'id, user_id, updated_at',
      // Events: range by time, filter by owner
      events: `
        id,
        owner_id,
        start_time_ms,
        end_time_ms,
        updated_at,
        [owner_id+start_time_ms]
      `,
      // Event personal details: compound index for calendar filtering
      event_details_personal: '[event_id+user_id], user_id, calendar_id, updated_at, [calendar_id+user_id]',
      event_user_roles: '[event_id+user_id], user_id, updated_at',
      user_annotations: 'id, user_id, start_time_ms, end_time_ms, updated_at',
      meta: 'key',
      outbox: 'id, user_id, table, op, created_at, attempts',
    })
  }
}
```


---

## Light validation (cheap wins)

Put Zod schemas in `apps/calendar/src/types/validators.ts` and call them **before** enqueueing to Outbox.

```ts
// apps/calendar/src/types/validators.ts
import { z } from 'zod'
export const AIPersonaSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  avatar_url: z.string().url().nullish(),
  system_prompt: z.string().max(5000).nullish(),
  updated_at: z.string(),
})
```

Usage:
```ts
import { AIPersonaSchema } from '@/types/validators'
AIPersonaSchema.parse(row) // throws early if malformed
```

---

## Sync engine upgrades (push batching + adaptive backoff + locks)

Keep **one** `sync.ts`, but make push smarter. The read path is still Dexie‑only.

```ts
// apps/calendar/src/lib/data/base/sync.ts (push excerpt)
import { db } from './dexie'
import { supabase } from './client'

function jittered(ms: number) { const j = Math.random() * 0.1; return Math.round(ms * (1 + j)) }

export async function pushOutbox(userId: string) {
  // Only one tab drains the outbox
  await (navigator.locks?.request ? navigator.locks.request('outbox-drain', async () => {
    await drain(userId)
  }) : drain(userId))
}

async function drain(userId: string) {
  const raw = await db.outbox.where('user_id').equals(userId).sortBy('created_at')
  // 0) De-dupe: keep latest payload per `${table}:${payload.id}`
  const latest = new Map<string, typeof raw[number]>()
  for (const it of raw) latest.set(`${it.table}:${it.payload?.id ?? it.id}`, it)
  const items = Array.from(latest.values())

  // 1) Group by table + op (simple batching)
  const groups = new Map<string, typeof items>()
  for (const it of items) {
    const key = `${it.table}:${it.op}`
    const arr = groups.get(key) || []
    arr.push(it)
    groups.set(key, arr)
  }

  // 2) Process each group
  for (const [key, group] of groups) {
    const [table, op] = key.split(':')
    try {
      if (table === 'ai_personas' && op === 'upsert') {
        const payload = group.map(g => g.payload)
        const { data, error } = await supabase.from('ai_personas').upsert(payload).select()
        if (error) throw error
        await db.transaction('rw', db.ai_personas, db.outbox, async () => {
          await db.ai_personas.bulkPut((data ?? []) as any)
          for (const g of group) await db.outbox.delete(g.id)
        })
      }
      if (table === 'ai_personas' && op === 'delete') {
        const ids = group.map(g => g.payload.id)
        const { error } = await supabase.from('ai_personas').delete().in('id', ids).eq('user_id', userId)
        if (error) throw error
        await db.transaction('rw', db.outbox, async () => { for (const g of group) await db.outbox.delete(g.id) })
      }
      // TODO: other tables similarly
    } catch (e: any) {
      const status = e?.status ?? e?.code
      const permanent = status === 401 || status === 403
      for (const g of group) {
        const attempts = (g.attempts ?? 0) + 1
        const next = permanent ? 0 : Math.min(30_000, 1000 * (2 ** Math.min(attempts, 5)))
        await db.outbox.update(g.id, { attempts, _error: permanent ? String(status) : undefined })
        if (!permanent && next > 0) await new Promise(r => setTimeout(r, jittered(next)))
      }
    }
  }
}

export function tick(userId: string) { /* small orchestrator: pull since watermark, then pushOutbox(userId) */ }
```

> Extend batching to calendars/categories/events where Supabase supports `upsert([...])` or `.in('id', ids)` deletes. Optionally, add a tiny server‑side LWW RPC.

---

## Sync status hook

Useful for a subtle header badge like “Offline” or “Syncing 3…”. Zero impact on data path.

```ts
// apps/calendar/src/lib/data/base/useSyncStatus.ts
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './dexie'

export function useSyncStatus(userId?: string) {
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)
  const outboxCount = useLiveQuery(async () => {
    if (!userId) return 0
    return db.outbox.where('user_id').equals(userId).count()
  }, [userId], 0)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return { online, outboxCount }
}
```

---

## Assembled events accessor (local join → `EventDTO[]`)

Use compound index when calendar filters are present.

```ts
// apps/calendar/src/lib/data/domains/events.ts (excerpt)
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../base/dexie'
import type { EventDTO } from '@/types'

async function baseEventsInRange(from: number, to: number, calendarIds?: string[]) {
  if (calendarIds?.length) {
    // Query per calendar using compound index, then merge
    const chunks = await Promise.all(
      calendarIds.map(calId =>
        db.events
          .where('[calendar_id+start_time_ms]')
          .between([calId, from], [calId, to])
          .toArray()
      )
    )
    return chunks.flat()
  }
  return db.events.where('start_time_ms').between(from, to, true, true).toArray()
}

async function assembleEvents(userId: string, from: number, to: number, calendarIds?: string[]): Promise<EventDTO[]> {
  const base = await baseEventsInRange(from, to, calendarIds)
  const ids = base.map(e => e.id)
  const [personal, roles] = await Promise.all([
    db.event_details_personal.where('user_id').equals(userId).filter(r => ids.includes(r.event_id)).toArray(),
    db.event_user_roles.where('user_id').equals(userId).filter(r => ids.includes(r.event_id)).toArray(),
  ])
  const perById = new Map(personal.map(p => [p.event_id, p]))
  const roleById = new Map(roles.map(r => [r.event_id, r]))
  return base.map<EventDTO>(e => {
    const pd = perById.get(e.id); const rl = roleById.get(e.id)
    return {
      id: e.id,
      title: (e as any).title,
      start_time: e.start_time as any,
      start_time: e.end_time as any,
      all_day: e.all_day as any,
      private: e.private as any,
      start_time_ms: e.start_time_ms,
      end_time_ms: e.end_time_ms,
      owner_id: e.owner_id as any,
      creator_id: (e as any).creator_id ?? null,
      show_time_as: pd?.show_time_as ?? 'busy',
      time_defense_level: pd?.time_defense_level ?? 'normal',
      ai_managed: pd?.ai_managed ?? false,
      ai_instructions: pd?.ai_instructions ?? null,
      calendar: pd?.calendar_id ? { id: pd.calendar_id, name: '', color: '' } : null,
      category: pd?.category_id ? { id: pd.category_id, name: '', color: '' } : null,
      role: rl?.role ?? 'owner',
      rsvp: rl?.rsvp ?? null,
      following: rl?.following ?? false,
      updated_at: e.updated_at,
    }
  })
}

export function useEventsRange(userId: string | undefined, range: { from: number; to: number; calendarIds?: string[] }) {
  return useLiveQuery(() => userId ? assembleEvents(userId, range.from, range.to, range.calendarIds) : Promise.resolve([] as EventDTO[]), [userId, range.from, range.to, JSON.stringify(range.calendarIds ?? [])], [] as EventDTO[])
}
```

---

## Testing checklist (lean but real)

**Unit (Dexie)**
- Inserts/updates in transactions persist and indexes resolve (`where().between()`, compound keys).
- Assembler returns expected `EventDTO` for mixed overlays.

**Sync (integration)**
- **Pull** merges newer `updated_at` rows; older ones are ignored (LWW).
- **Push** drains Outbox; on network error, attempts++ and backoff respects ceiling; permanent errors set `_error`.
- **Realtime** upsert/delete writes to Dexie; UI reflects via `useLiveQuery`.

**Offline UX**
- Disable network → reads still return cached Dexie data.
- Create/update/delete offline: local changes visible immediately; after reconnect, Outbox clears and server rows replace locals.

**Perf**
- Event range queries over typical window (<5k rows) resolve within ~ms budget. Compound indexes are used.

**CI smoke**
- Playwright: block `**/rest/*`, validate offline renders + edits; then unblock and wait for sync badge to clear.

---

## Rollout steps (concise)

1. **Dexie v2**: apply schema/index changes.
2. **Sync push upgrade**: batching + jittered backoff + locks for leader tab.
3. **Validators**: add Zod; call `.parse()` before outbox enqueue.
4. **Events assembled accessor**: add `assembleEvents` + `useEventsRange`.
5. **Status hook**: `useSyncStatus` (optional UI badge).
6. **Ship**: Components unchanged; hooks already read Dexie.

---

## Implementation Checklist

> Unchanged in structure; SPA/HMR notes folded into foundation + orchestration and push.

### Phase 1: Foundation (Week 1)

- **Create base directories** under `apps/calendar/src/lib/data/{base,domains}` and `apps/calendar/src/types`.
- **Install deps:** `dexie dexie-react-hooks zod uuid` (+ `@types/uuid`).
- **Dexie schema** (`base/dexie.ts`): define row interfaces, **v2** indexes, **HMR singleton** export `db`.
- **Supabase client** (`base/client.ts`): **HMR singleton** export `supabase`.
- **Validators** (`src/types/validators.ts`): Zod schemas **used before enqueue only**.
- **Sync utilities** (`base/sync.ts`): watermark helpers, jittered backoff, network detection, **locks leader**, **outbox de‑dupe by `${table}:${payload.id}`**.

### Phase 2: Sync Engine (Week 1–2)

- **Pull** per domain with watermark + LWW; init watermark after first success; events use **now±60d** window and record bounds; targeted pulls when user navigates outside window; seed **Default** and **Archived** calendars on first pull.
- **Push**: batched upsert/delete; **locks** to ensure single tab drains; 8‑attempt ceiling; mark `_error` on permanent failures; 401/403 non‑retriable; quota handling; optional server‑side LWW RPC.
- **Realtime**: per‑table subs filtered by `user_id`; handle INSERT/UPDATE/DELETE; clean up.
- **Orchestration**: `startSync(userId)` runs initial pull + push; install **online/offline**, **focus**, and **visibilitychange** listeners; `stopSync()` cleans up.

### Phase 3: Domains (Week 2–3)

- Personas, Profiles, Calendars, Categories: hooks via `useLiveQuery`; mutations are Dexie‑first + outbox enqueue with validation.
- Events: `assembleEvents` uses compound index when calendar filter present; `useEventsRange`, `useEvent`, full CRUD with overlays (EDP/roles).

### Phase 4: Integration & Status (Week 3)

- **useSyncStatus** hook for subtle badge.
- **DataProvider** wires auth → start/stop; requests `navigator.storage.persist?.()` and logs if denied; clears previous‑user data on logout.
- **Barrel exports** from `lib/data/index.ts` for all hooks + mutations + status.

### Phase 5–8: Migration, Testing, Readiness, Deploy

- Migration: grep for `supabase.from(` under `apps/calendar/src/` and replace with domain APIs; remove TanStack Query network usage for calendar data.
- Testing: unit/integration/E2E as listed; perf & memory; multi‑tab consistency.
- Readiness: logging (outbox processed, latency, failure codes), security (RLS, isolation), tuning (batch sizes, indexes), docs and ESLint rule blocking direct Supabase imports outside `base/*`.
- Deploy: stage → prod; monitor error/perf/UX; verify offline correctness.

---

## Summary

- **Lean & offline‑first**: Dexie read path only.
- **One network locus**: `sync.ts` (pull/push/realtime) with batching, jitter, and leader election.
- **SPA‑friendly**: singletons for Dexie/Supabase; visibility‑triggered ticks; no SSR dependencies.
- **Composable**: assembled events accessor and tiny status signal without changing your app imports.

---

---

## Dexie schema upgrades (compound indexes)

**Why:** faster event range queries and calendar filtering.

```ts
// apps/calendar/src/lib/data/base/dexie.ts (excerpt)
export class AppDB extends Dexie {
  constructor(name = 'calendar-app') {
    super(name)
    this.version(2).stores({
      ai_personas: 'id, user_id, updated_at',
      user_profiles: 'id, updated_at',
      user_calendars: 'id, user_id, updated_at, visible',
      user_categories: 'id, user_id, updated_at',
      // Events: range by time, filter by owner
      events: `
        id,
        owner_id,
        start_time_ms,
        end_time_ms,
        updated_at,
        [owner_id+start_time_ms]
      `,
      // Event personal details: compound index for calendar filtering
      event_details_personal: '[event_id+user_id], user_id, calendar_id, updated_at, [calendar_id+user_id]',
      event_user_roles: '[event_id+user_id], user_id, updated_at',
      user_annotations: 'id, user_id, start_time_ms, end_time_ms, updated_at',
      meta: 'key',
      outbox: 'id, user_id, table, op, created_at, attempts',
    })
  }
}
```

> If you already shipped v1, bump the version and provide a tiny migration.

---

## Light validation (optional, cheap wins)

Put Zod schemas in `apps/calendar/src/types/validators.ts` and call them **before** enqueueing to Outbox.

```ts
// apps/calendar/src/types/validators.ts
import { z } from 'zod'
export const AIPersonaSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  avatar_url: z.string().url().nullish(),
  system_prompt: z.string().max(5000).nullish(),
  updated_at: z.string(),
})
```

Usage:
```ts
import { AIPersonaSchema } from '@/types/validators'
AIPersonaSchema.parse(row) // throws early if malformed
```

---

## Sync engine upgrades (push batching + adaptive backoff + locks)

Keep **one** `sync.ts`, but make push smarter. The read path is still Dexie‑only.

```ts
// apps/calendar/src/lib/data/base/sync.ts (push excerpt)
import { db } from './dexie'
import { supabase } from './client'

function jittered(ms: number) { const j = Math.random() * 0.1; return Math.round(ms * (1 + j)) }

export async function pushOutbox(userId: string) {
  // Only one tab drains the outbox
  await (navigator.locks?.request ? navigator.locks.request('outbox-drain', async () => {
    await drain(userId)
  }) : drain(userId))
}

async function drain(userId: string) {
  const raw = await db.outbox.where('user_id').equals(userId).sortBy('created_at')
  // 0) De-dupe: keep latest payload per `${table}:${payload.id}`
  const latest = new Map<string, typeof raw[number]>()
  for (const it of raw) latest.set(`${it.table}:${it.payload?.id ?? it.id}`, it)
  const items = Array.from(latest.values())

  // 1) Group by table + op (simple batching)
  const groups = new Map<string, typeof items>()
  for (const it of items) {
    const key = `${it.table}:${it.op}`
    const arr = groups.get(key) || []
    arr.push(it)
    groups.set(key, arr)
  }

  // 2) Process each group
  for (const [key, group] of groups) {
    const [table, op] = key.split(':')
    try {
      if (table === 'ai_personas' && op === 'upsert') {
        const payload = group.map(g => g.payload)
        const { data, error } = await supabase.from('ai_personas').upsert(payload).select()
        if (error) throw error
        await db.transaction('rw', db.ai_personas, db.outbox, async () => {
          await db.ai_personas.bulkPut((data ?? []) as any)
          for (const g of group) await db.outbox.delete(g.id)
        })
      }
      if (table === 'ai_personas' && op === 'delete') {
        const ids = group.map(g => g.payload.id)
        const { error } = await supabase.from('ai_personas').delete().in('id', ids).eq('user_id', userId)
        if (error) throw error
        await db.transaction('rw', db.outbox, async () => { for (const g of group) await db.outbox.delete(g.id) })
      }
      // TODO: other tables similarly
    } catch (e: any) {
      const status = e?.status ?? e?.code
      const permanent = status === 401 || status === 403
      for (const g of group) {
        const attempts = (g.attempts ?? 0) + 1
        const next = permanent ? 0 : Math.min(30_000, 1000 * (2 ** Math.min(attempts, 5)))
        await db.outbox.update(g.id, { attempts, _error: permanent ? String(status) : undefined })
        if (!permanent && next > 0) await new Promise(r => setTimeout(r, jittered(next)))
      }
    }
  }
}

export function tick(userId: string) { /* small orchestrator: pull since watermark, then pushOutbox(userId) */ }
```

> Extend batching to calendars/categories/events where Supabase supports `upsert([...])` or `.in('id', ids)` deletes. Optionally, add a tiny server‑side LWW RPC.

---

## Sync status hook (tiny, optional)

Useful for a subtle header badge like “Offline” or “Syncing 3…”. Zero impact on data path.

```ts
// apps/calendar/src/lib/data/base/useSyncStatus.ts
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './dexie'

export function useSyncStatus(userId?: string) {
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)
  const outboxCount = useLiveQuery(async () => {
    if (!userId) return 0
    return db.outbox.where('user_id').equals(userId).count()
  }, [userId], 0)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return { online, outboxCount }
}
```

---

## Assembled events accessor (local join → `EventDTO[]`)

Use compound index when calendar filters are present.

```ts
// apps/calendar/src/lib/data/domains/events.ts (excerpt)
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../base/dexie'
import type { EventDTO } from '@/types'

async function baseEventsInRange(from: number, to: number, calendarIds?: string[]) {
  if (calendarIds?.length) {
    // Query per calendar using compound index, then merge
    const chunks = await Promise.all(
      calendarIds.map(calId =>
        db.events
          .where('[calendar_id+start_time_ms]')
          .between([calId, from], [calId, to])
          .toArray()
      )
    )
    return chunks.flat()
  }
  return db.events.where('start_time_ms').between(from, to, true, true).toArray()
}

async function assembleEvents(userId: string, from: number, to: number, calendarIds?: string[]): Promise<EventDTO[]> {
  const base = await baseEventsInRange(from, to, calendarIds)
  const ids = base.map(e => e.id)
  const [personal, roles] = await Promise.all([
    db.event_details_personal.where('user_id').equals(userId).filter(r => ids.includes(r.event_id)).toArray(),
    db.event_user_roles.where('user_id').equals(userId).filter(r => ids.includes(r.event_id)).toArray(),
  ])
  const perById = new Map(personal.map(p => [p.event_id, p]))
  const roleById = new Map(roles.map(r => [r.event_id, r]))
  return base.map<EventDTO>(e => {
    const pd = perById.get(e.id); const rl = roleById.get(e.id)
    return {
      id: e.id,
      title: (e as any).title,
      start_time: e.start_time as any,
      end_time: e.end_time as any,
      all_day: e.all_day as any,
      private: e.private as any,
      start_time_ms: e.start_time_ms,
      end_time_ms: e.end_time_ms,
      owner_id: e.owner_id as any,
      creator_id: (e as any).creator_id ?? null,
      show_time_as: pd?.show_time_as ?? 'busy',
      time_defense_level: pd?.time_defense_level ?? 'normal',
      ai_managed: pd?.ai_managed ?? false,
      ai_instructions: pd?.ai_instructions ?? null,
      calendar: pd?.calendar_id ? { id: pd.calendar_id, name: '', color: '' } : null,
      category: pd?.category_id ? { id: pd.category_id, name: '', color: '' } : null,
      role: rl?.role ?? 'owner',
      rsvp: rl?.rsvp ?? null,
      following: rl?.following ?? false,
      updated_at: e.updated_at,
    }
  })
}

export function useEventsRange(userId: string | undefined, range: { from: number; to: number; calendarIds?: string[] }) {
  return useLiveQuery(() => userId ? assembleEvents(userId, range.from, range.to, range.calendarIds) : Promise.resolve([] as EventDTO[]), [userId, range.from, range.to, JSON.stringify(range.calendarIds ?? [])], [] as EventDTO[])
}
```

---

## Testing checklist (lean but real)

**Unit (Dexie)**
- Inserts/updates in transactions persist and indexes resolve (`where().between()`, compound keys).
- Assembler returns expected `EventDTO` for mixed overlays.

**Sync (integration)**
- **Pull** merges newer `updated_at` rows; older ones are ignored (LWW).
- **Push** drains Outbox; on network error, attempts++ and backoff respects ceiling; permanent errors set `_error`.
- **Realtime** upsert/delete writes to Dexie; UI reflects via `useLiveQuery`.

**Offline UX**
- Disable network → reads still return cached Dexie data.
- Create/update/delete offline: local changes visible immediately; after reconnect, Outbox clears and server rows replace locals.

**Perf**
- Event range queries over typical window (<5k rows) resolve within ~ms budget. Compound indexes are used.

**CI smoke**
- Playwright: block `**/rest/*`, validate offline renders + edits; then unblock and wait for sync badge to clear.

---

## Rollout steps (concise)

1. **Dexie v2**: apply schema/index changes.
2. **Sync push upgrade**: batching + jittered backoff + locks for leader tab.
3. **Validators**: add Zod; call `.parse()` before outbox enqueue.
4. **Events assembled accessor**: add `assembleEvents` + `useEventsRange`.
5. **Status hook**: `useSyncStatus` (optional UI badge).
6. **Ship**: Components unchanged; hooks already read Dexie.

---

## Implementation Checklist

> Unchanged in structure; SPA/HMR notes folded into foundation + orchestration and push.

### Phase 1: Foundation (Week 1)

- **Create base directories** under `apps/calendar/src/lib/data/{base,domains}` and `apps/calendar/src/types`.
- **Install deps:** `dexie dexie-react-hooks zod uuid` (+ `@types/uuid`).
- **Dexie schema** (`base/dexie.ts`): define row interfaces, **v2** indexes, **HMR singleton** export `db`.
- **Supabase client** (`base/client.ts`): **HMR singleton** export `supabase`.
- **Validators** (`src/types/validators.ts`): Zod schemas **used before enqueue only**.
- **Sync utilities** (`base/sync.ts`): watermark helpers, jittered backoff, network detection, **locks leader**, **outbox de‑dupe by `${table}:${payload.id}`**.

### Phase 2: Sync Engine (Week 1–2)

- **Pull** per domain with watermark + LWW; init watermark after first success; events use **now±60d** window and record bounds; targeted pulls when user navigates outside window; seed **Default** and **Archived** calendars on first pull.
- **Push**: batched upsert/delete; **locks** to ensure single tab drains; 8‑attempt ceiling; mark `_error` on permanent failures; 401/403 non‑retriable; quota handling; optional server‑side LWW RPC.
- **Realtime**: per‑table subs filtered by `user_id`; handle INSERT/UPDATE/DELETE; clean up.
- **Orchestration**: `startSync(userId)` runs initial pull + push; install **online/offline**, **focus**, and **visibilitychange** listeners; `stopSync()` cleans up.

### Phase 3: Domains (Week 2–3)

- Personas, Profiles, Calendars, Categories: hooks via `useLiveQuery`; mutations are Dexie‑first + outbox enqueue with validation.
- Events: `assembleEvents` uses compound index when calendar filter present; `useEventsRange`, `useEvent`, full CRUD with overlays (EDP/roles).

### Phase 4: Integration & Status (Week 3)

- **useSyncStatus** hook for subtle badge.
- **DataProvider** wires auth → start/stop; requests `navigator.storage.persist?.()` and logs if denied; clears previous‑user data on logout.
- **Barrel exports** from `lib/data/index.ts` for all hooks + mutations + status.

### Phase 5–8: Migration, Testing, Readiness, Deploy

- Migration: grep for `supabase.from(` under `apps/calendar/src/` and replace with domain APIs; remove TanStack Query network usage for calendar data.
- Testing: unit/integration/E2E as listed; perf & memory; multi‑tab consistency.
- Readiness: logging (outbox processed, latency, failure codes), security (RLS, isolation), tuning (batch sizes, indexes), docs and ESLint rule blocking direct Supabase imports outside `base/*`.
- Deploy: stage → prod; monitor error/perf/UX; verify offline correctness.

---

## Summary

- **Lean & offline‑first**: Dexie read path only.
- **One network locus**: `sync.ts` (pull/push/realtime) with batching, jitter, and leader election.
- **SPA‑friendly**: singletons for Dexie/Supabase; visibility‑triggered ticks; no SSR dependencies.
- **Composable**: assembled events accessor and tiny



---

## Implementation Checklist

### Phase 1: Foundation (Week 1)

#### 📂 Directory Structure & Dependencies
- [ ] **Create base directory structure**
  ```bash
  mkdir -p apps/calendar/src/lib/data/base apps/calendar/src/lib/data/domains
  ```
- [ ] **Install dependencies**
  ```bash
  cd apps/calendar && pnpm add dexie dexie-react-hooks zod uuid
  cd apps/calendar && pnpm add -D @types/uuid
  ```
- [ ] **Create types directory structure**
  ```bash
  mkdir -p apps/calendar/src/types
  ```

#### 🗄️ Database Schema & Foundation
- [ ] **Create Dexie schema** (`apps/calendar/src/lib/data/base/dexie.ts`)
  - [ ] Define all interface types (AIPersonaRow, UserProfileRow, etc.)
  - [ ] Create AppDB class with v2 compound indexes
  - [ ] Export db instance
  - [ ] Test database creation and basic operations

- [ ] **Create Supabase client** (`apps/calendar/src/lib/data/base/client.ts`)
  - [ ] Import existing supabase client or create new one
  - [ ] Ensure proper configuration

- [ ] **Create validators** (`apps/calendar/src/types/validators.ts`)
  - [ ] AIPersonaSchema (use before enqueue only)
  - [ ] UserProfileSchema (use before enqueue only)
  - [ ] UserCalendarSchema (use before enqueue only)
  - [ ] UserCategorySchema (use before enqueue only)
  - [ ] EventSchema and EventPersonalSchema (use before enqueue only)
  - [ ] Test validation schemas

#### 🔄 Sync Engine Foundation
- [ ] **Create sync utilities** (`apps/calendar/src/lib/data/base/sync.ts`)
  - [ ] Watermark get/set functions
  - [ ] Jittered backoff utility
  - [ ] Basic error handling types
  - [ ] Network status detection
  - [ ] Multi-tab coordination setup (navigator.locks preferred, BroadcastChannel fallback)
  - [ ] Outbox deduplication helper (latest payload per key: `${table}:${payload.id}`)

### Phase 2: Sync Engine Implementation (Week 1-2)

#### 📥 Pull Functions
- [ ] **Implement pullPersonas**
  - [ ] Query with watermark filtering
  - [ ] LWW conflict resolution
  - [ ] Dexie transaction for atomicity
  - [ ] Initialize watermark after first successful pull (brand-new clients)
  - [ ] Watermark update

- [ ] **Implement pullProfiles**
  - [ ] User-specific profile sync
  - [ ] Initialize watermark after first successful pull
  - [ ] Proper error handling

- [ ] **Implement pullCalendars**
  - [ ] User-scoped calendar sync
  - [ ] Initialize watermark after first successful pull
  - [ ] Visible/hidden state handling

- [ ] **Implement pullCategories**
  - [ ] User-scoped category sync
  - [ ] Initialize watermark after first successful pull

- [ ] **Implement pullEvents**
  - [ ] Time window-based queries (now±60d policy)
  - [ ] Record window bounds in meta table
  - [ ] Targeted pull for new windows when user navigates outside cached range
  - [ ] Compound index utilization
  - [ ] Initialize watermark after first successful pull
  - [ ] Event details personal sync
  - [ ] Event user roles sync
  - [ ] Seed default "Default" and "Archived" calendars on first pull

#### 📤 Push Functions (Outbox)
- [ ] **Implement batched push for all domains**
  - [ ] Dedupe outbox items (latest payload per key: `${table}:${payload.id}`)
  - [ ] Multi-tab coordination (navigator.locks.request('outbox-drain'), only lock holder drains)
  - [ ] Group by table+op
  - [ ] Batch upsert operations
  - [ ] Batch delete operations
  - [ ] Adaptive backoff with jitter (cap at 8 attempts)
  - [ ] LWW check on push success (prevent realtime race)
  - [ ] Optional: server-side LWW RPC for edge-case protection
  - [ ] Set _error flag on permanent failures
  - [ ] Handle 401/403 (do NOT retry)
  - [ ] Handle quota exceeded gracefully
  - [ ] Transaction safety

- [ ] **Implement batched push for profiles**
- [ ] **Implement batched push for calendars**
- [ ] **Implement batched push for categories**
- [ ] **Implement batched push for events**
  - [ ] Handle event details personal
  - [ ] Handle event user roles

#### 🔴 Realtime Subscriptions
- [ ] **Implement subscribePersonas**
  - [ ] Filter by user_id
  - [ ] Handle INSERT/UPDATE/DELETE
  - [ ] Proper cleanup function

- [ ] **Implement subscribeProfiles**
- [ ] **Implement subscribeCalendars**
- [ ] **Implement subscribeCategories**
- [ ] **Implement subscribeEvents**
  - [ ] Multiple table subscriptions (events, event_details_personal, event_user_roles)

#### 🎯 Sync Orchestration
- [ ] **Implement startSync function**
  - [ ] Initial pull sequence
  - [ ] Push outbox on start
  - [ ] Set up all realtime subscriptions
  - [ ] Online/offline event listeners
  - [ ] Focus event listener
  - [ ] Cleanup management

- [ ] **Implement stopSync function**
  - [ ] Clean shutdown of all subscriptions
  - [ ] Remove event listeners
  - [ ] Clear intervals/timeouts

### Phase 3: Domain Implementation (Week 2-3)

#### 👤 Personas Domain
- [ ] **Create personas domain** (`apps/calendar/src/lib/data/domains/personas.ts`)
  - [ ] `useAIPersonas` hook with useLiveQuery
  - [ ] `createPersona` mutation with validation (before enqueue only)
  - [ ] `updatePersona` mutation with validation (before enqueue only)
  - [ ] `deletePersona` mutation
  - [ ] Test all operations offline/online

#### 📋 Profiles Domain
- [ ] **Create profiles domain** (`apps/calendar/src/lib/data/domains/profiles.ts`)
  - [ ] `useUserProfile` hook
  - [ ] `updateProfile` mutation with validation (before enqueue only)
  - [ ] Test profile updates

#### 📅 Calendars Domain
- [ ] **Create calendars domain** (`apps/calendar/src/lib/data/domains/calendars.ts`)
  - [ ] `useUserCalendars` hook
  - [ ] `createCalendar` mutation with validation (before enqueue only)
  - [ ] `updateCalendar` mutation with validation (before enqueue only)
  - [ ] `deleteCalendar` mutation
  - [ ] Test visibility filtering

#### 🏷️ Categories Domain
- [ ] **Create categories domain** (`apps/calendar/src/lib/data/domains/categories.ts`)
  - [ ] `useUserCategories` hook
  - [ ] `createCategory` mutation with validation (before enqueue only)
  - [ ] `updateCategory` mutation with validation (before enqueue only)
  - [ ] `deleteCategory` mutation

#### 📆 Events Domain
- [ ] **Create events domain** (`apps/calendar/src/lib/data/domains/events.ts`)
  - [ ] `assembleEvents` helper function with compound index optimization
  - [ ] Use `where('[owner_id+start_time_ms]').between()` for calendar filtering (O(log n))
  - [ ] `useEventsRange` hook with assembly
  - [ ] `useEvent` single event hook
  - [ ] `createEvent` mutation (with EDP/roles, validation before enqueue only)
  - [ ] `updateEvent` mutation with validation (before enqueue only)
  - [ ] `deleteEvent` mutation
  - [ ] Test compound index performance
  - [ ] Test calendar filtering

### Phase 4: Integration & Status (Week 3)

#### 📊 Sync Status Hook
- [ ] **Create sync status hook** (`apps/calendar/src/lib/data/base/useSyncStatus.ts`)
  - [ ] Online/offline detection
  - [ ] Outbox count tracking with useLiveQuery
  - [ ] Export clean interface

#### 🔗 Data Provider
- [ ] **Create DataProvider** (`apps/calendar/src/providers/DataProvider.tsx`)
  - [ ] useAuth integration
  - [ ] startSync/stopSync on user change
  - [ ] Call navigator.storage.persist?.() for persistent storage
  - [ ] Log warning if storage persistence fails
  - [ ] Account switching: clear Dexie data for previous user on logout
  - [ ] Proper cleanup

#### 📦 Barrel Exports
- [ ] **Create index exports** (`apps/calendar/src/lib/data/index.ts`)
  - [ ] Export all domain hooks
  - [ ] Export all mutation functions
  - [ ] Export sync status hook
  - [ ] Test import paths

### Phase 5: Migration & Component Updates (Week 3-4)

#### 🔄 Component Migration Strategy
- [ ] **Audit existing data usage**
  - [ ] Find all direct Supabase calls: `grep -r "supabase.from" apps/calendar/src/`
  - [ ] Find all TanStack Query usage for calendar data
  - [ ] Document component-by-component migration plan

#### 👤 Migrate Persona Components
- [ ] **Update persona-related components**
  - [ ] Replace useAIPersonas from old hooks
  - [ ] Update mutation calls to new functions
  - [ ] Test optimistic updates work
  - [ ] Test offline functionality

#### 📅 Migrate Calendar Components
- [ ] **Update calendar management components**
  - [ ] Replace calendar hooks
  - [ ] Update CRUD operations
  - [ ] Test visibility changes work immediately

#### 🏷️ Migrate Category Components
- [ ] **Update category management components**
  - [ ] Replace category hooks
  - [ ] Update CRUD operations

#### 📆 Migrate Event Components
- [ ] **Update main calendar view components**
  - [ ] Replace useEventsRange calls
  - [ ] Update event creation/editing
  - [ ] Test performance with compound indexes
  - [ ] Verify calendar filtering works
  - [ ] Test time range navigation

#### 🎨 Add Sync Status UI
- [ ] **Add offline indicator component**
  - [ ] Use useSyncStatus hook
  - [ ] Show online/offline state
  - [ ] Show pending sync count
  - [ ] Keep UI subtle and non-intrusive

### Phase 6: Testing & Validation (Week 4)

#### 🧪 Unit Tests
- [ ] **Test Dexie operations**
  - [ ] Schema creation and indexes
  - [ ] Transaction atomicity
  - [ ] Compound index queries
  - [ ] Assembly function correctness

- [ ] **Test sync functions**
  - [ ] Pull operations with watermarks
  - [ ] Push operations with batching
  - [ ] LWW conflict resolution
  - [ ] Adaptive backoff behavior

- [ ] **Test domain functions**
  - [ ] All CRUD operations
  - [ ] Validation schema enforcement
  - [ ] Optimistic update behavior

#### 🔌 Integration Tests
- [ ] **Test offline functionality**
  - [ ] Disable network in dev tools
  - [ ] Verify reads still work from Dexie
  - [ ] Verify writes queue in outbox
  - [ ] Verify sync works when reconnected

- [ ] **Test realtime updates**
  - [ ] Make changes via Supabase admin
  - [ ] Verify updates appear in UI via realtime
  - [ ] Test with multiple tabs/windows

- [ ] **Test performance**
  - [ ] Large event ranges (5k+ events)
  - [ ] Calendar filtering performance
  - [ ] Assembly function performance
  - [ ] Memory usage over time

#### 🎭 End-to-End Tests
- [ ] **Playwright offline tests**
  - [ ] Network blocking scenarios
  - [ ] Offline CRUD operations
  - [ ] Sync after reconnection
  - [ ] Status indicator behavior

- [ ] **Cross-tab consistency tests**
  - [ ] Changes in one tab appear in another
  - [ ] Realtime updates work across tabs

### Phase 7: Production Readiness (Week 4-5)

#### 🛡️ Error Handling & Resilience
- [ ] **Test error scenarios**
  - [ ] Network timeouts
  - [ ] Supabase rate limiting
  - [ ] Invalid data scenarios
  - [ ] Storage quota exceeded

- [ ] **Implement proper logging**
  - [ ] Sync operation logging
  - [ ] Error state logging
  - [ ] Performance metrics

#### 🔒 Security & Validation
- [ ] **Review security**
  - [ ] Ensure user data isolation
  - [ ] Validate all database constraints
  - [ ] Test RLS policies still work

- [ ] **Performance optimization**
  - [ ] Profile database operations
  - [ ] Optimize compound indexes if needed
  - [ ] Tune batch sizes
  - [ ] Optimize assembly function

#### 📋 Documentation & Cleanup
- [ ] **Update documentation**
  - [ ] Update component documentation
  - [ ] Document new data access patterns
  - [ ] Update architecture diagrams

- [ ] **Code cleanup**
  - [ ] Remove old hooks and utilities
  - [ ] Remove unused TanStack Query setups
  - [ ] Remove direct Supabase imports from components
  - [ ] Add ESLint no-restricted-syntax rule: error on supabase.from() outside base/sync.ts & base/client.ts

### Phase 8: Deployment & Monitoring (Week 5)

#### 🚀 Deployment Preparation
- [ ] **Database migration**
  - [ ] Plan Dexie schema version upgrade
  - [ ] Test migration on development data
  - [ ] Prepare rollback plan

#### 📊 Launch & Monitor
- [ ] **Deploy to staging**
  - [ ] Full functionality testing
  - [ ] Performance testing
  - [ ] Multi-user testing

- [ ] **Production deployment**
  - [ ] Monitor error rates
  - [ ] Monitor performance metrics
  - [ ] Monitor user experience
  - [ ] Verify offline functionality works

#### ✅ Post-Launch Validation
- [ ] **User acceptance testing**
  - [ ] Offline scenarios work correctly
  - [ ] No data loss reported
  - [ ] Performance is acceptable
  - [ ] Sync status is helpful

- [ ] **Performance monitoring**
  - [ ] Dexie operation performance
  - [ ] Sync frequency and success rates
  - [ ] User engagement metrics

---

## Success Criteria

### ✅ Functional
- [ ] All calendar features work completely offline
- [ ] Data syncs automatically when online
- [ ] No data loss during offline periods
- [ ] Real-time updates work across devices
- [ ] Optimistic updates provide immediate feedback

### ⚡ Performance
- [ ] Event range queries < 100ms from Dexie
- [ ] Assembly function < 50ms for typical ranges
- [ ] Sync operations don't block UI
- [ ] Memory usage stable over time

### 👥 User Experience
- [ ] No noticeable difference when online
- [ ] Subtle, helpful offline indicators
- [ ] Immediate feedback for all actions
- [ ] Smooth transitions between online/offline

### 🔧 Developer Experience
- [ ] Simple, consistent data access patterns
- [ ] Clear error messages and debugging
- [ ] No direct Supabase calls in components
- [ ] Easy to add new data domains

