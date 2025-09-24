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

## Implementation Checklist

### Phase 1: Foundation Replacement
- [ ] **Delete broken data layer files completely**
  - [ ] Remove `apps/calendar/src/lib/data/base/` directory entirely
  - [ ] Remove `apps/calendar/src/lib/data/domains/` directory entirely
  - [ ] Remove broken barrel export `apps/calendar/src/lib/data/index.ts`
  - [ ] Remove broken `apps/calendar/src/lib/realtime/subscriptions.ts`
  - [ ] Remove broken `apps/calendar/src/providers/QueryProvider.tsx`

- [ ] **Implement unified foundation (Document 1)**
  - [ ] Create `apps/calendar/src/lib/data/base/keys.ts` - canonical query keys
  - [ ] Create `apps/calendar/src/lib/data/base/mapping.ts` - PG→ISO normalizers
  - [ ] Create `apps/calendar/src/lib/data/base/dexie.ts` - single DB schema with indexes
  - [ ] Create `apps/calendar/src/lib/data/base/assembly.ts` - assembleEvent functions
  - [ ] Create `apps/calendar/src/lib/data/base/utils.ts` - helper functions

- [ ] **Create working domains (Document 1)**
  - [ ] Create `apps/calendar/src/lib/data/domains/events.ts` with:
    - [ ] `useEventsRange(uid, {from, to})`
    - [ ] `useEvent(uid, id)`
    - [ ] `useCreateEvent(uid)`
    - [ ] `useUpdateEvent(uid)`
    - [ ] `useDeleteEvent(uid)`
    - [ ] Convenience hooks: `useUpdateEventCategory`, `useUpdateEventCalendar`, `useUpdateEventShowTimeAs`, `useUpdateEventTimeDefense`, `useUpdateEventAI`
  - [ ] Create `apps/calendar/src/lib/data/domains/calendars.ts` with CRUD hooks
  - [ ] Create `apps/calendar/src/lib/data/domains/categories.ts` with CRUD hooks
  - [ ] Create `apps/calendar/src/lib/data/domains/personas.ts` with CRUD hooks

- [ ] **Implement realtime subscriptions (Document 1)**
  - [ ] Create `apps/calendar/src/lib/data/realtime/subscriptions.ts`
  - [ ] Base tables only: `events`, `event_details_personal`, `user_calendars`, `user_categories`, `ai_personas`
  - [ ] Use TanStack v5 `setQueriesData({ predicate })` pattern
  - [ ] Implement proper overlaps logic for event ranges

- [ ] **Create unified exports**
  - [ ] Create `apps/calendar/src/lib/data/queries.ts` - re-exports from domains only
  - [ ] Create `apps/calendar/src/lib/data/index.ts` - public surface

- [ ] **Update providers**
  - [ ] Replace `apps/calendar/src/providers/QueryProvider.tsx` with unified approach
  - [ ] Add `DataLayerBootstrap` component for realtime wiring

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