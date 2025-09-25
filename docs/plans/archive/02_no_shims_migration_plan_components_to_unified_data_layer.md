# No‑Shims Migration Plan — Components to the Unified Offline‑First Data Layer

**Goal**: Refactor app experiences to read/write **only** via `@/lib/data` (Dexie + TanStack + Supabase Realtime). Delete legacy hooks and direct Supabase calls inside components. **No intermediate shims/adapters.**

---

## 0) Ground Rules

- **Single source of data**: `apps/calendar/src/lib/data` domain hooks (events, calendars, categories, personas).
- **Client types only** in components (ISO timestamps + `*_ms`). Never parse PG timestamps in UI.
- **Optimistic-first**: components rely on hooks to patch caches; avoid manual refetches.
- **Realtime only at app shell**: providers wire channels; components do not subscribe directly.
- **No Supabase in components**: enforce with lint rule and grep gate (see §9).

---

## 1) Required Rails (verify before touching UI)

1. **Exports** from `@/lib/data/queries`:
   - Events: `useEventsRange`, `useEvent`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`, convenience setters (`useUpdateEventCategory`, `useUpdateEventCalendar`, `useUpdateEventShowTimeAs`, `useUpdateEventTimeDefense`, `useUpdateEventAI`).
   - Calendars: `useUserCalendars`, `useCreateUserCalendar`, `useUpdateUserCalendar`, `useDeleteUserCalendar`.
   - Categories: same CRUD as calendars.
   - Personas: `useAIPersonas`, `useCreateAIPersona`, `useUpdateAIPersona`, `useDeleteAIPersona`, `useSetDefaultAIPersona`.
2. **Query keys** (TanStack v5):
   - List by range: `['events', { userId, from, to }]`.
   - Single: `['event', { userId, eventId }]`.
3. **Cache patch helpers** exist in `base/cache.ts` and are used by mutations & realtime.
4. **Dexie schema** includes: `events`, `event_details_personal`, `user_calendars`, `user_categories`, `ai_personas` with proper indexes for time & user filters.
5. **Realtime** mounted in providers (`realtime/subscriptions.ts`): base tables only; handlers write to Dexie then patch Query caches.

> If any of the above are missing, add them first. Components depend on this contract.

---

## 2) Migration Order (no shims)

Migrate per experience so the app stays usable:

1) Calendar Grid (week/month/day)
2) Quick Create / Inline Composer
3) Event Details Drawer/Inspector
4) Settings → Calendars
5) Settings → Categories
6) Settings → AI Personas (chat stays separate)
7) Global Search / Jump‑to
8) Cleanup: delete legacy hooks & direct calls

---

## 3) Calendar Grid (Week/Month/Day)

**Paths (expected)**
- `apps/calendar/src/app/calendar/page.tsx` or route segment components
- `apps/calendar/src/components/calendar/Grid*` (week/day/month views)

### Steps

1. **Replace imports**
```diff
- import { useCalendarEvents } from '@/hooks/use-calendar-events'
+ import { useEventsRange, useCreateEvent, useUpdateEvent, useDeleteEvent } from '@/lib/data/queries'
```

2. **Replace fetching**
```ts
const { data: events = [], isPending } = useEventsRange(user?.id, {
  from: startOfWeek(viewDate).getTime(),
  to: endOfWeek(viewDate).getTime(),
});
```

3. **Create (drag/select)**
```ts
const create = useCreateEvent(user?.id);
// ... on user action
create.mutate({ title, start_time: isoStart, duration, calendar_id, category_id });
```

4. **Move/Resize (drag/resize)**
```ts
const update = useUpdateEvent(user?.id);
update.mutate({ id: event.id, event: { start_time: newISO, duration: newMinutes } });
```

5. **Delete**
```ts
const del = useDeleteEvent(user?.id);
del.mutate(event.id);
```

6. **Render assembled fields**
Use `event.calendar?.color`, `event.category?.name`, `event.show_time_as`, `event.start_timestamp_ms`, `event.end_timestamp_ms`. **Do not join** in UI.

7. **Remove refetches**
Delete any `refetch()` on success. Optimistic + realtime handle cache.

---

## 4) Quick Create / Inline Composer

**Paths**: `components/calendar/QuickCreate*`, inline composer in grid.

### Steps
1. Import `useCreateEvent` only.
2. On submit, call `create.mutate` with base fields and optional personal fields (`calendar_id`, `category_id`, `show_time_as`, etc.).
3. Close modal on success (no refetch).

**Example**
```ts
const create = useCreateEvent(user?.id);

async function onSubmit(f) {
  await create.mutateAsync({
    title: f.title,
    start_time: f.startISO,
    duration: f.durationMin,
    calendar_id: f.calendarId,
    category_id: f.categoryId,
  });
  onClose();
}
```

---

## 5) Event Details Drawer / Inspector

**Paths**: `components/event/DetailsDrawer*`

### Steps
1. Import the **convenience hooks** and drop custom mutations.
```diff
- import { supabase } from '@/lib/supabase'
+ import {
+  useUpdateEventCategory,
+  useUpdateEventCalendar,
+  useUpdateEventShowTimeAs,
+  useUpdateEventTimeDefense,
+  useUpdateEventAI,
+ } from '@/lib/data/queries'
```
2. Wire actions:
```ts
const setCategory = useUpdateEventCategory(user?.id);
const setCalendar = useUpdateEventCalendar(user?.id);
const setShow = useUpdateEventShowTimeAs(user?.id);
const setDef = useUpdateEventTimeDefense(user?.id);
const setAI = useUpdateEventAI(user?.id);

setCategory.mutate({ eventId: id, categoryId });
setCalendar.mutate({ eventId: id, calendarId });
setShow.mutate({ eventId: id, showTimeAs: 'busy' });
setDef.mutate({ eventId: id, timeDefenseLevel: 'protected' });
setAI.mutate({ eventId: id, aiManaged: true, aiInstructions: '...' });
```
3. Remove any local re‑querying. The hook updates are optimistic and realtime reconciles.

---

## 6) Settings — Calendars

**Paths**: `app/settings/calendars`, `components/settings/Calendars*`

### Steps
1. Replace imports to domain hooks.
```diff
- import { useUserCalendars } from '@/hooks/use-user-calendars'
+ import {
+   useUserCalendars,
+   useCreateUserCalendar,
+   useUpdateUserCalendar,
+   useDeleteUserCalendar,
+ } from '@/lib/data/queries'
```
2. List view uses `useUserCalendars(user?.id)`; forms use create/update/delete.
3. Remove any direct Supabase calls and manual cache massaging.

---

## 7) Settings — Categories

Mirror Calendars. Replace with `useUserCategories` CRUD from data layer.

---

## 8) Settings — AI Personas

**Chat stays separate**, but personas are part of data layer.

**Paths**: `app/settings/ai`, `components/settings/Personas*`

### Steps
1. Import persona hooks from data layer.
```ts
import {
  useAIPersonas,
  useCreateAIPersona,
  useUpdateAIPersona,
  useDeleteAIPersona,
  useSetDefaultAIPersona,
} from '@/lib/data/queries'
```
2. Replace any direct Supabase/rogue hooks calls.
3. Chat UI reads the selected persona id from store or `useAIPersonas`; do **not** query Supabase directly.

---

## 9) Enforce “No Supabase in Components”

Add a lightweight guard so this sticks.

**ESLint rule (custom)**
```js
// .eslintrc.cjs
module.exports = {
  rules: {
    'no-direct-supabase-in-ui': [
      'error',
      { match: ['apps/calendar/src/app/**', 'apps/calendar/src/components/**'] }
    ],
  },
}
```
*(Implementation detail: use no-restricted-imports with pattern '@/lib/supabase' for those globs.)*

**CI grep gate**
```bash
grep -R "from '@/lib/supabase'" apps/calendar/src/app apps/calendar/src/components && \
  echo '❌ Supabase import in UI. Use data layer.' && exit 1 || echo '✅ Clean UI'
```

---

## 10) Delete Legacy Hooks & Direct Calls

After each feature migrates and passes QA:

- Remove files under `apps/calendar/src/hooks/*` that access Supabase directly.
- Search & delete any helper using `supabase.from(...)` in components.
- Replace re-exports in `lib/data/queries.ts` to point only to **domains**.

---

## 11) Testing Checklist (per feature)

- **Offline** (DevTools → Network offline): create/move/delete → UI updates instantly; go online → persistent.
- **Realtime**: update a record in SQL editor → UI reflects within seconds.
- **Cache**: viewport window queries update on create/move due to correct `overlaps` predicate.
- **Types**: UI never touches PG timestamps; uses `start_time` ISO + `*_ms`.
- **Performance**: large weeks render smoothly (verify Dexie indexes are hit).

---

## 12) Rollout Plan (no shims)

1. **PR A — Rails ready**: verify exports, realtime, Dexie schema.
2. **PR B — Calendar Grid**: refactor fetch/mutate; remove legacy imports in grid.
3. **PR C — Details Drawer**: swap to convenience hooks; delete old mutations.
4. **PR D — Settings (Calendars)**: switch list & forms to CRUD domain hooks.
5. **PR E — Settings (Categories)**: ditto.
6. **PR F — Personas**: move to data layer; ensure chat reads persona id/state only.
7. **PR G — Cleanup**: delete rogue hooks; add lint + CI gate.

---

## 13) Mini‑Diff Templates

**Find/Replace Imports**
```diff
- import { supabase } from '@/lib/supabase'
- import { use-*-event } from '@/hooks/use-*-event'
+ import { useEventsRange, useCreateEvent, useUpdateEvent, useDeleteEvent } from '@/lib/data/queries'
```

**Remove Refetch‑on‑Success**
```diff
- await create();
- await refetch();
+ await create(); // cache is already patched; realtime will reconcile
```

**Switch Category Update**
```diff
- await supabase.from('event_details_personal').update({ category_id }).eq('event_id', id)
+ setCategory.mutate({ eventId: id, categoryId })
```

---

## 14) Done Criteria

- No component imports `@/lib/supabase`.
- All feature screens render from data‑layer hooks.
- Optimistic updates + realtime work in grid and details.
- Dexie contains events, EDP, calendars, categories, personas, and powers UI offline.
- Legacy hooks removed; CI gate prevents regression.

---

**Ship it.** This guide assumes your domain hooks and realtime wiring follow the contract already agreed (base tables only, assemble events client‑side). If you want, tell me a file path and I’ll add an exact before/after patch for that component.

