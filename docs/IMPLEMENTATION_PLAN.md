# Unified Data Layer Implementation Plan

**Reference Documents:**
- `01_calendar_mono_offline_first_data_layer_dexie_tan_stack_supabase_realtime.md`
- `02_no_shims_migration_plan_components_to_unified_data_layer.md`
- `03_high_impact_components_event_card_action_bar_data_layer_ready.md`

**Goal:** Implement a unified offline-first data layer with Dexie + TanStack Query + Supabase Realtime. Replace all existing data patterns with this single approach. **NO SHIMS, NO ADAPTERS, NO LEGACY COMPATIBILITY.**

---

## Ground Rules

1. **AssembledEvent type ONLY** - Replace all `CalendarEvent` usage with `AssembledEvent` from the unified data layer
2. **Single data source** - Components use domain hooks only, never direct Supabase calls
3. **Rewrite non-conforming code** - Do not maintain broken patterns "for compatibility"
4. **Step-by-step with testing** - Each phase must be tested before proceeding
5. **Working branch implementation** - All work happens in the working branch with commits at each major step

---

## Technical Notes

**Timestamp Handling**: Events use **database-computed generated columns** for millisecond timestamps (`start_time_ms`, `end_time_ms`) that are automatically calculated by PostgreSQL from the canonical `start_time`/`end_time` timestamptz columns. Clients **never write the `*_ms` fields** - they are server-authoritative and computed as `GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM start_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED`. The mapping layer converts these bigint values to numbers for client use.

**Type System**: The Supabase generated types in `packages/supabase/database.types.ts` are the **source of truth** for all database types. All interfaces must extend or reference these generated types (`Database['public']['Tables']['events']['Row']`, etc.) to ensure perfect consistency. The mapping layer converts Supabase bigint fields to numbers and PostgreSQL timestamps to ISO strings while preserving all original field names.

**Database Schema**: The current migration includes the computed timestamp columns. Clients only send/update `start_time` and `end_time` (ISO UTC strings). PostgreSQL automatically maintains `start_time_ms` and `end_time_ms` as generated stored columns for fast range queries and sorting.

**User Annotations Support**: Added full support for `user_annotations` table (AI event highlights and time highlights) throughout the data layer. Includes computed timestamp columns (`start_time_ms`, `end_time_ms`) and proper indexes for fast range queries. Domain hooks include `useUserAnnotations`, `useCreateAnnotation`, etc.

**Cross-Environment UUID Generation**: Implemented fallback UUID generation for HTTP environments where `crypto.randomUUID()` is not available. Uses secure crypto API when available (HTTPS) and Math.random-based UUID v4 generation as fallback.

**Show Time As Enum**: Collapsed `show_time_as` and `show_time_as_extended` into single `show_time_as` enum with values: `'free', 'tentative', 'busy', 'oof', 'working_elsewhere'`.

---

## Implementation Checklist

### Phase 0: Database Schema Update ✅ COMPLETE
- [x] **Reset database with computed timestamp columns**
  - [x] Run `npx supabase db reset` to apply updated migration with computed columns
  - [x] Regenerate TypeScript types: `npx supabase gen types --lang=typescript --local > packages/supabase/database.types.ts`
  - [x] Verify `start_time_ms` and `end_time_ms` appear in generated types as `number | null`
  - [x] **ADDED**: Extended `user_annotations` table with computed timestamp columns and proper indexes

### Phase 1: Foundation Replacement ✅ COMPLETE
- [x] **Delete broken data layer files completely**
  - [x] Remove `apps/calendar/src/lib/data/base/` directory entirely
  - [x] Remove `apps/calendar/src/lib/data/domains/` directory entirely
  - [x] Remove broken barrel export `apps/calendar/src/lib/data/index.ts`
  - [x] Remove broken `apps/calendar/src/lib/realtime/subscriptions.ts`
  - [x] Remove broken `apps/calendar/src/providers/QueryProvider.tsx`

- [x] **Implement unified foundation (Document 1)**
  - [x] Create `apps/calendar/src/lib/data/base/keys.ts` - canonical query keys **+ annotations support**
  - [x] Create `apps/calendar/src/lib/data/base/server-types.ts` - Supabase generated type references
  - [x] Create `apps/calendar/src/lib/data/base/client-types.ts` - ISO normalized types **+ annotations**
  - [x] Create `apps/calendar/src/lib/data/base/mapping.ts` - PG→ISO normalizers **+ annotations**
  - [x] Create `apps/calendar/src/lib/data/base/dexie.ts` - single DB schema with indexes **+ annotations**
  - [x] Create `apps/calendar/src/lib/data/base/assembly.ts` - assembleEvent functions
  - [x] Create `apps/calendar/src/lib/data/base/utils.ts` - helper functions **+ cross-env UUID generation**

- [x] **Create working domains (Document 1)**
  - [x] Create `apps/calendar/src/lib/data/domains/events.ts` with:
    - [x] `useEventsRange(uid, {from, to})` - Range queries with overlap logic
    - [x] `useEvent(uid, id)` - Single event with personal details
    - [x] `useCreateEvent(uid)` - Optimistic creation with default calendar
    - [x] `useUpdateEvent(uid)` - Base event + personal details updates
    - [x] `useDeleteEvent(uid)` - Optimistic deletion with rollback
    - [x] Convenience hooks: `useUpdateEventCategory`, `useUpdateEventCalendar`, `useUpdateEventShowTimeAs`, `useUpdateEventTimeDefense`, `useUpdateEventAI`
  - [x] Create `apps/calendar/src/lib/data/domains/calendars.ts` - Full CRUD with default/archive protection
  - [x] Create `apps/calendar/src/lib/data/domains/categories.ts` - Full CRUD with default category protection
  - [x] Create `apps/calendar/src/lib/data/domains/personas.ts` - Full CRUD + `useSetDefaultAIPersona`
  - [x] Create `apps/calendar/src/lib/data/domains/annotations.ts` - AI highlights CRUD + range queries + convenience hooks

- [x] **Implement realtime subscriptions (Document 1)**
  - [x] Create `apps/calendar/src/lib/data/realtime/subscriptions.ts`
  - [x] Base tables only: `events`, `event_details_personal`, `user_calendars`, `user_categories`, `ai_personas`, `user_annotations`
  - [x] Use TanStack v5 `setQueriesData({ predicate })` pattern for range updates
  - [x] Implement proper overlaps logic for event ranges and annotation ranges
  - [x] **Cache-first assembly**: Real-time handlers assemble events from Dexie cache for performance

- [x] **Create unified exports**
  - [x] Create `apps/calendar/src/lib/data/queries.ts` - re-exports from domains only
  - [x] Create `apps/calendar/src/lib/data/index.ts` - public surface + AssembledEvent types

- [x] **Update providers**
  - [x] Replace `apps/calendar/src/providers/QueryProvider.tsx` with unified approach
  - [x] Add `DataLayerBootstrap` component for realtime wiring with user-scoped subscriptions

### Phase 2: Component Migration (Document 2)
- [ ] **Calendar Grid Migration**
  - [ ] Fix `apps/calendar/src/app/calendar/page.tsx` imports:
    - [ ] Remove: `import {...} from "@/lib/data"` (broken barrel)
    - [ ] Add: `import {...} from "@/lib/data/queries"`
  - [ ] Replace event fetching with `useEventsRange(user?.id, {from, to})`
  - [ ] Update event mutations to use `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`
  - [ ] **Remove all CalendarEvent types, replace with AssembledEvent**
  - [ ] Update `apps/calendar/src/components/calendar-day-range.tsx` to use AssembledEvent
  - [ ] Update `apps/calendar/src/components/day-column.tsx` to use AssembledEvent
  - [ ] Remove all manual refetch calls - rely on optimistic updates

- [ ] **Event Card & Action Bar (Document 3)**
  - [ ] Replace `apps/calendar/src/components/event-card.tsx` with data-layer version
  - [ ] Replace `apps/calendar/src/components/action-bar.tsx` with data-layer version
  - [ ] Update to use AssembledEvent type and convenience hooks

- [ ] **Event Details Panel**
  - [ ] Update `apps/calendar/src/components/event-details-panel.tsx` imports:
    - [ ] Remove direct Supabase calls
    - [ ] Add convenience hooks: `useUpdateEventCategory`, `useUpdateEventCalendar`, etc.
  - [ ] Replace manual mutations with convenience hooks
  - [ ] Remove manual refetch calls

- [ ] **Settings Pages**
  - [ ] Update calendars settings to use `useUserCalendars` CRUD hooks
  - [ ] Update categories settings to use `useUserCategories` CRUD hooks
  - [ ] Update AI personas settings to use `useAIPersonas` CRUD hooks
  - [ ] Update AI annotations/highlights to use `useUserAnnotations` CRUD hooks
  - [ ] Remove direct Supabase calls from all settings components

### Phase 3: Type System Migration
- [ ] **Replace CalendarEvent throughout codebase**
  - [ ] Update `apps/calendar/src/components/types.ts` to export AssembledEvent
  - [ ] Find and replace CalendarEvent usage in all components
  - [ ] Update component props and interfaces
  - [ ] Update store types if using Zustand for event data

- [ ] **Update AI integration**
  - [ ] Verify AI tools work with AssembledEvent type
  - [ ] Update time highlighting to use AssembledEvent fields
  - [ ] Test AI time suggestions with new event structure

### Phase 4: Cleanup & Enforcement
- [ ] **Delete legacy files**
  - [ ] Remove all files in `apps/calendar/src/hooks/` that made direct Supabase calls
  - [ ] Remove any remaining direct Supabase imports from components
  - [ ] Clean up unused imports and dead code

- [ ] **Add enforcement (Document 2)**
  - [ ] Add ESLint rule to prevent `@/lib/supabase` imports in components
  - [ ] Add CI grep gate: `grep -R "from '@/lib/supabase'" apps/calendar/src/app apps/calendar/src/components && echo '❌ Supabase in UI' && exit 1`

- [ ] **Testing & Validation**
  - [ ] **Offline test**: Network offline → create/update/delete → UI updates instantly → online → syncs to server
  - [ ] **Realtime test**: Update record in SQL editor → UI reflects within seconds
  - [ ] **Cache test**: Viewport queries update on create/move due to overlaps predicate
  - [ ] **Performance test**: Large week views render smoothly with Dexie indexes

---

## Commit Strategy

Each major phase should be committed separately:

1. **Foundation commit**: New data layer files, deleted old files
2. **Calendar migration commit**: Main calendar page and grid components migrated
3. **Components commit**: Event card, action bar, details panel migrated
4. **Settings commit**: Settings pages migrated
5. **Types commit**: CalendarEvent → AssembledEvent migration complete
6. **Cleanup commit**: Legacy files deleted, enforcement added

---

## Success Criteria

- [ ] No component imports `@/lib/supabase` directly
- [ ] All components use AssembledEvent type exclusively
- [ ] Calendar grid renders from `useEventsRange` with proper offline/realtime behavior
- [ ] All CRUD operations are optimistic with automatic cache updates
- [ ] Realtime subscriptions update UI without manual refetches
- [ ] App works offline and syncs when reconnected
- [ ] No legacy hooks or broken data layer files remain

---

## Notes

- **Document 1** provides the complete technical implementation
- **Document 2** provides the migration strategy and component-by-component approach
- **Document 3** provides ready-to-use EventCard and ActionBar components that follow the pattern
- All timestamp handling is normalized at the boundary (mapping.ts)
- AI chat remains separate; only AI personas go through the data layer
- This plan completely replaces the broken data layer - no compatibility shims

---

## Implementation Decisions & Extensions

### Database Schema Enhancements
1. **Computed Timestamp Columns**: Added `start_time_ms` and `end_time_ms` as PostgreSQL generated columns using `EXTRACT(EPOCH FROM start_time AT TIME ZONE 'UTC') * 1000` for immutable, timezone-independent millisecond timestamps
2. **User Annotations Integration**: Extended plan to include full `user_annotations` support with computed timestamp columns and optimized indexes for AI highlights
3. **Single show_time_as Enum**: Simplified from dual enum system to single enum with comprehensive values

### Foundation Architecture Decisions
1. **Cross-Environment UUID**: Implemented fallback UUID generation for HTTP environments using crypto.randomUUID() when available, Math.random-based UUID v4 as fallback
2. **Extended Type System**: Added comprehensive client/server type mappings for all entities (events, annotations, calendars, categories, personas, profiles)
3. **Dexie Schema v9**: Designed optimized IndexedDB schema with compound indexes for fast user-scoped queries and range lookups

### Progress Status
- ✅ **Phase 0 & 1**: Database schema and foundation complete with annotations support
- ✅ **Phase 1**: Complete unified data layer with 15 files:
  - **Foundation (7)**: Keys, types, mapping, Dexie schema v9, assembly, utils
  - **Domains (5)**: Events, calendars, categories, personas, annotations - all with full CRUD + convenience hooks
  - **Realtime (1)**: Real-time subscriptions for 6 base tables with overlap logic
  - **Exports (2)**: Unified query exports + public API surface
- 🚧 **Phase 2**: Ready to begin component migration to AssembledEvent + domain hooks
- ⏳ **Phases 3-4**: Component migration and enforcement pending

### Data Layer Architecture Notes
- **15 total files**: Complete offline-first architecture following Document 1 exactly
- **6 base tables**: All with real-time subscriptions and optimistic updates
- **Cache-first performance**: Real-time handlers use Dexie cache for event assembly
- **Range query optimization**: Millisecond-based overlap predicates for calendar views
- **Cross-environment support**: UUID generation, immutable computed columns
- **Type safety**: Supabase generated types as source of truth throughout