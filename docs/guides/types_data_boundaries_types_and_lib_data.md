# Types & Data Boundaries — **@/types** and **@/lib/data**

> This doc defines exactly **what lives in `@/types`**, where it comes from, **how it gets there**, and **when/why/how to use `@/lib/data`**. It’s opinionated on purpose to keep the app maintainable, testable, and fast.

---

## TL;DR (pin this)

- **`@/types` = Contracts** (no side‑effects, no runtime I/O)
  - DB types (Supabase codegen), app **domain DTOs**, shared **string unions/enums**, **runtime constants**, and optional **validators**.
  - Safe to import **from anywhere** (client, server, build scripts).
- **`@/lib/data` = Behavior** (I/O and state)
  - React Query hooks, non‑React fetchers, Supabase client, Dexie, mappers/assemblers, realtime handlers.
  - UI and server actions **call** this; it must **depend on** `@/types`, not the other way around.

---

## Folder layout (source of truth)

```
src/
  types/                 # <- contracts only (no I/O)
    db.ts                # Supabase codegen output (DB tables, enums)
    domain.ts            # App-level DTOs + domain aliases to DB enums
    constants.ts         # Runtime constants (as const objects) that pair with unions
    validators.ts        # (optional) zod schemas for runtime validation
    index.ts             # Barrel: re-export types/constants validators

  lib/
    data/                # <- behavior (I/O, hooks, mappers, realtime)
      base/
        client.ts        # Supabase client init (browser/server)
        dexie.ts         # Dexie schema & tables
        keys.ts          # React Query key factory
        mapping.ts       # stateless map DB rows -> domain DTOs
      domains/
        profiles.ts      # useUserProfile, useUpdateUserProfile, etc.
        calendars.ts     # useUserCalendars, mutations
        categories.ts    # useUserCategories, mutations
        events.ts        # useEvent, useEventsRange, event mutations
        personas.ts      # (if applicable)
      realtime/
        subscriptions.ts # Postgres Changes -> Dexie + cache patch
      index.ts           # Barrel: re-export hooks only (optionally type-only re-exports)
```

**Rule of thumb:** `@/types` is *imported by* `@/lib/data`, never the other way around.

---

## What goes in `@/types` (and why)

### 1) DB types (Supabase codegen) — `src/types/db.ts`
**What:** Generated TypeScript for tables, views (if any), functions, and DB enums.  
**Why:** Single source of truth for the database schema; avoids hand-written drift.

**How to generate (commit the file):**
```bash
# One-time: set SUPABASE_PROJECT_ID and service role key in env (local or CI)
# Recommended: generate types into src/types/db.ts and commit them.
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/types/db.ts
```

> We commit `db.ts` to keep editors, CI, and PR reviews stable. Re‑generate in PRs when the DB changes.

---

### 2) Domain types — `src/types/domain.ts`
**What:** App-facing DTOs and type aliases that the UI and data layer agree on (e.g., `EventDTO`, `CalendarDTO`).  
**Why:** Decouple UI from raw DB shapes; encode merge logic contracts (e.g., “assembled event” fields).

**Example:**
```ts
// src/types/domain.ts
import type { Database } from './db';

export type UUID = string;

export type ShowTimeAs =
  | 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';

export type TimeDefenseLevel =
  Database['public']['Enums']['time_defense_level']; // alias DB enum

export type EventDTO = {
  id: UUID;
  title: string;
  start_time: string;
  duration: number;
  all_day: boolean;
  private: boolean;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  owner_id: UUID;
  creator_id: UUID | null;
  show_time_as: ShowTimeAs;
  time_defense_level: TimeDefenseLevel;
  ai_managed: boolean;
  ai_instructions: string | null;
  calendar: { id: UUID; name: string; color: string } | null;
  category: { id: UUID; name: string; color: string } | null;
  role: 'viewer'|'contributor'|'owner'|'delegate_full';
  rsvp: 'tentative'|'accepted'|'declined'|null;
  following: boolean;
  updated_at: string;
};
```

---

### 3) Runtime constants (with union types) — `src/types/constants.ts`
Prefer **string unions + `as const` objects** over TS `enum` (no runtime bloat, tree-shakeable).

```ts
export const CALENDAR_KIND = {
  NORMAL: 'normal',
  ARCHIVED: 'archived',
} as const;

export type CalendarKind = typeof CALENDAR_KIND[keyof typeof CALENDAR_KIND];
```

Use these values across UI and data without circular imports.

---

### 4) Validators (optional) — `src/types/validators.ts`
If you validate payloads at runtime, colocate zod/yup schemas here:

```ts
import { z } from 'zod';
export const ShowTimeAsSchema = z.enum(['free','tentative','busy','oof','working_elsewhere']);
```

---

### 5) Barrel — `src/types/index.ts`
Re-export the things above; **no behavior**.

```ts
export * from './db';
export * from './domain';
export * from './constants';
export * from './validators';
```

---

## What **does not** go in `@/types`

- **No I/O** (no Supabase clients, no Dexie instances, no fetchers).
- **No React** (no hooks, no contexts).
- **No runtime state or side effects.**

This keeps `@/types` importable from anywhere (server actions, build scripts, tests) without pulling in the browser or DB client.

---

## What lives in `@/lib/data` (and why)

- **React Query hooks** (`useEventsRange`, `useEvent`, `useCreateCalendar`, etc.).
- **Non-React fetchers** for server actions (e.g., `fetchEventDTO(userId, eventId)`).
- **Mapping/assembly** helpers (DB rows → domain DTOs).
- **Dexie** schema & access (offline cache).
- **Supabase client** for reads/writes/RPCs.
- **Realtime** subscriptions that upsert into Dexie and patch React Query caches.

**Important boundaries:**
- `@/lib/data` **imports types** from `@/types`.
- **Components import hooks** from `@/lib/data` and **types** from `@/types`.
- If you need to share a *type* for a hook, **type-only re-export** it from the data barrel:
  ```ts
  // src/lib/data/index.ts
  export * from './domains/events';
  export type { EventDTO } from '@/types';
  ```

---

## When/why/how to use each

### Use `@/types` when…
- You need a **type** or **constant** with zero runtime cost (DTOs, unions, DB enums).  
- You’re in **server** or **shared** code that must not import browser-only modules.  
- You’re writing **mappers**: import types here, but keep the mapper function implementation in `@/lib/data/base/mapping.ts`.

### Use `@/lib/data` when…
- You need to **read/write data** (Supabase, Dexie, Realtime).  
- You need **offline-first hooks** (TanStack Query + Dexie seed/merge).  
- You need **assembled** domain objects (`EventDTO`) without re-implementing the join logic in a component.  

**Example (component):**
```ts
import { useEventsRange } from '@/lib/data';
import type { EventDTO } from '@/types';

const { data: events } = useEventsRange(userId, { from, to }); // EventDTO[]
```

**Example (server action):**
```ts
import { fetchEventDTO } from '@/lib/data/server';
import type { EventDTO } from '@/types';

export async function getEvent(id: string, uid: string): Promise<EventDTO | null> {
  return await fetchEventDTO(uid, id);
}
```

---

## Codegen & update workflow (DB → `@/types`)

1. **Change DB** (SQL migrations).  
2. **Regenerate DB types**:
   ```bash
   npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/types/db.ts
   ```
3. **Update domain aliases** (if enums/columns changed) in `src/types/domain.ts`.  
4. **Adjust mappers** (if shapes changed) in `@/lib/data/base/mapping.ts`.  
5. **Run tests**, commit, and ship.

**PR checklist:**
- [ ] `src/types/db.ts` updated
- [ ] `src/types/domain.ts` aligns with DB changes
- [ ] `@/lib/data` mappers & hooks compile
- [ ] Query keys and realtime handlers patched if needed
- [ ] Bump persisted-cache `buster` if you changed DTO shape

---

## Enforcing boundaries

**ESLint guard** (prevent deep imports):
```jsonc
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        { "group": ["@/lib/data/base/*", "@/lib/data/domains/*"], "message": "Import hooks from `@/lib/data` barrel instead." }
      ]
    }]
  }
}
```

**tsconfig paths**:
```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## Do / Don’t (quick reference)

- ✅ **Do** put shared types, DTOs, unions, constants in `@/types`.
- ✅ **Do** import all data hooks from `@/lib/data` (single barrel).
- ✅ **Do** map DB → DTO in the data layer (not in components).
- ✅ **Do** alias DB enums in `domain.ts` so the app uses consistent names.
- ❌ **Don’t** put hooks/clients/state in `@/types`.
- ❌ **Don’t** import from `@/lib/data/domains/*` or `base/*` in app code.
- ❌ **Don’t** duplicate DB enums by hand—regenerate and alias.
- ❌ **Don’t** assemble events inside components—use the provided hooks/fetchers.

---

## Examples (copy/paste)

**`src/types/domain.ts`**
```ts
import type { Database } from './db';
export type UUID = string;
export type TimeDefenseLevel = Database['public']['Enums']['time_defense_level'];
export type ShowTimeAs = 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';

export type EventDTO = {
  id: UUID;
  title: string;
  start_time: string;
  duration: number;
  all_day: boolean;
  private: boolean;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  owner_id: UUID;
  creator_id: UUID | null;
  show_time_as: ShowTimeAs;
  time_defense_level: TimeDefenseLevel;
  ai_managed: boolean;
  ai_instructions: string | null;
  calendar: { id: UUID; name: string; color: string } | null;
  category: { id: UUID; name: string; color: string } | null;
  role: 'viewer'|'contributor'|'owner'|'delegate_full';
  rsvp: 'tentative'|'accepted'|'declined'|null;
  following: boolean;
  updated_at: string;
};
```

**`src/types/constants.ts`**
```ts
export const CALENDAR_KIND = {
  NORMAL: 'normal',
  ARCHIVED: 'archived',
} as const;
export type CalendarKind = typeof CALENDAR_KIND[keyof typeof CALENDAR_KIND];
```

**`src/lib/data/index.ts` (barrel)**  
```ts
export * from './domains/events';
export * from './domains/calendars';
export * from './domains/categories';
export * from './domains/profiles';
export * from './domains/personas';

// Optional type-only convenience re-exports
export type { EventDTO } from '@/types';
```

**Component usage**
```tsx
import { useEventsRange } from '@/lib/data';
import type { EventDTO } from '@/types';

export function Agenda({ userId, from, to }: { userId: string; from: number; to: number }) {
  const { data: events } = useEventsRange(userId, { from, to });
  return <>{events?.map((e: EventDTO) => <div key={e.id}>{e.title}</div>)}</>;
}
```

---

## FAQ

**Q: Should enums live in `@/lib/data`?**  
A: No. Put DB enums in `@/types/db.ts` (codegen) and app unions/aliases in `@/types/domain.ts`. You may *type-only re-export* from the data barrel for convenience.

**Q: What if a type is UI-only?**  
A: Keep it near the component or in a feature‑level `types.ts`. Only promote to `@/types` if it’s shared across features/layers.

**Q: How do I handle breaking DTO changes?**  
A: Bump the persisted cache `buster`, update mappers, and coordinate a small migration if Dexie schema changed.

**Q: Can server actions call `@/lib/data`?**  
A: Yes, via non‑React fetchers you export from a `server/` module under `@/lib/data`. Keep the hooks browser‑only.

---

**Bottom line:**  
- `@/types` = **contracts** (safe anywhere).  
- `@/lib/data` = **behavior** (hooks, fetchers, assembly, realtime, offline).  
- UI imports **hooks from `@/lib/data`** and **types from `@/types`**.  
That’s the whole story.
