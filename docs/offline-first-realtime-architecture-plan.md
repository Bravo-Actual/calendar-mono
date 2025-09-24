# Comprehensive Offline-First Realtime Architecture Plan

## Current State Analysis

### ✅ What's Working
- Dexie setup with proper IndexedDB storage
- TanStack Query for caching and synchronization
- Basic realtime subscriptions to core tables
- Offline-first data loading pattern

### ❌ Current Issues
1. **Realtime Problems**: Subscribing to views (calendar_events_view) which don't support realtime
2. **Inconsistent Data Flow**: Mix of direct table access and view-based queries
3. **Complex Event Fetching**: Events require view queries after realtime updates
4. **Scattered Hook System**: Different patterns across various data types
5. **Missing Tables**: Some tables not included in realtime (work_periods, AI personas, etc.)

## 🎯 Target Architecture

### Core Principles
1. **Offline-First**: All data stored in Dexie, UI reads from local cache
2. **Direct Table Subscriptions**: Subscribe to base tables only, never views
3. **Client-Side Transformations**: Handle data relationships and computed fields in React
4. **Unified Hook Pattern**: Consistent CRUD operations across all data types
5. **Smart Sync**: Efficient conflict resolution and optimistic updates

## 📋 Implementation Plan

### Phase 1: Database Schema Alignment

#### 1.1 Update Dexie Schema
```typescript
export class AppDB extends Dexie {
  // Core user data
  user_profiles!: Table<UserProfile, UUID>;
  user_calendars!: Table<UserCalendar, UUID>;
  user_categories!: Table<UserCategory, UUID>;
  user_work_periods!: Table<UserWorkPeriod, UUID>;

  // Events system (base tables only)
  events!: Table<Event, UUID>;
  event_details_personal!: Table<EventDetailsPersonal, UUID>;
  event_attendees!: Table<EventAttendee, UUID>;

  // AI system
  ai_personas!: Table<AIPersona, UUID>;

  // Future extensibility
  user_settings!: Table<UserSetting, UUID>;
}
```

#### 1.2 Add Missing Tables
- `events` (base table, not view)
- `event_details_personal`
- `event_attendees`
- `ai_personas`
- `user_settings`

### Phase 2: Unified Hook System

#### 2.1 Generic Hook Pattern
```typescript
// Base hook factory for consistent CRUD operations
function createDataHook<T, CreateT, UpdateT>(config: {
  tableName: string;
  queryKey: (userId: string) => string[];
  fetchFn: (userId: string) => Promise<T[]>;
  createFn: (data: CreateT) => Promise<T>;
  updateFn: (id: string, data: UpdateT) => Promise<T>;
  deleteFn: (id: string) => Promise<void>;
  dexieTable: Table<T, string>;
  userIdField?: keyof T;
}) {
  // Returns: { data, isLoading, error, create, update, delete, refetch }
}
```

#### 2.2 Standardized Hooks
- `useUserProfiles(userId)`
- `useUserCalendars(userId)`
- `useUserCategories(userId)`
- `useUserWorkPeriods(userId)`
- `useEvents(userId, dateRange)`
- `useEventDetails(userId)`
- `useEventAttendees(eventId)`
- `useAIPersonas(userId)`

### Phase 3: Direct Table Realtime Subscriptions

#### 3.1 Complete Table Coverage
```typescript
// Subscribe to ALL user-related tables
const realtimeTables = [
  'user_profiles',
  'user_calendars',
  'user_categories',
  'user_work_periods',
  'events',                    // Base table only!
  'event_details_personal',
  'event_attendees',
  'ai_personas'
];
```

#### 3.2 Smart Event Assembly
```typescript
// Client-side event composition from base tables
function assembleCalendarEvent(
  event: Event,
  personalDetails: EventDetailsPersonal | null,
  attendeeInfo: EventAttendee | null,
  calendar: UserCalendar | null,
  category: UserCategory | null
): CalendarEvent {
  // Combine data from multiple tables
  // Apply user-specific transformations
  // Calculate computed fields (timestamps, etc.)
}
```

### Phase 4: Optimistic Updates & Conflict Resolution

#### 4.1 Optimistic Update Pattern
```typescript
const updateEvent = useMutation({
  mutationFn: async (update: EventUpdate) => {
    // 1. Update Dexie immediately (optimistic)
    await db.events.update(update.id, update);

    // 2. Send to Supabase
    const result = await supabase
      .from('events')
      .update(update)
      .eq('id', update.id);

    // 3. Handle conflicts if needed
    if (result.error) {
      // Rollback Dexie change
      // Show user conflict resolution UI
    }

    return result;
  }
});
```

#### 4.2 Conflict Resolution Strategy
- **Last Write Wins**: For simple fields (title, description)
- **User Choice**: For complex conflicts (time changes)
- **Merge Strategy**: For non-conflicting concurrent edits
- **Rollback**: For failed optimistic updates

### Phase 5: Data Loading & Caching Strategy

#### 5.1 Cache Windows
```typescript
// Intelligent date range caching
const CACHE_WINDOW_DAYS = 60; // 30 days before, 30 days after today
const EXTENDED_WINDOW_DAYS = 90; // For background prefetching

function getCurrentCacheWindow() {
  const today = new Date();
  return {
    startDate: subDays(today, 30),
    endDate: addDays(today, 30)
  };
}
```

#### 5.2 Background Sync
- Periodic full sync for data consistency
- Delta sync for recent changes
- Conflict detection and resolution
- Offline queue for failed updates

## 🔄 Migration Strategy

### Step 1: Parallel Implementation (Week 1)
- Create new hook system alongside existing
- Add missing tables to Dexie
- Implement direct table realtime subscriptions
- Test in isolated components

### Step 2: Component Migration (Week 2-3)
- Migrate calendar components to new hooks
- Replace event queries with assembled data
- Update all CRUD operations
- Maintain backwards compatibility

### Step 3: Cleanup & Optimization (Week 4)
- Remove old hook patterns
- Clean up unused view queries
- Optimize caching strategies
- Performance testing

## 📁 File Structure Changes

```
src/lib/
├── db/
│   ├── dexie.ts                 # Enhanced schema
│   ├── types.ts                 # All database types
│   └── migrations.ts            # Schema version management
├── hooks/
│   ├── core/
│   │   ├── use-data-hook.ts     # Generic hook factory
│   │   ├── use-realtime.ts      # Realtime management
│   │   └── use-sync.ts          # Background sync
│   ├── data/
│   │   ├── use-events.ts        # Event hooks
│   │   ├── use-user-data.ts     # User profile/settings
│   │   ├── use-calendars.ts     # Calendar management
│   │   └── use-ai-personas.ts   # AI system hooks
│   └── mutations/
│       ├── use-event-mutations.ts
│       ├── use-user-mutations.ts
│       └── use-calendar-mutations.ts
├── realtime/
│   ├── subscriptions.ts         # All realtime subscriptions
│   ├── sync-manager.ts          # Background sync logic
│   └── conflict-resolution.ts   # Handle data conflicts
└── transformers/
    ├── event-assembler.ts       # Assemble events from tables
    ├── data-cleaners.ts         # Validate/clean data
    └── computed-fields.ts       # Calculate derived values
```

## 🔍 Specific Implementation Details

### Direct Table Subscriptions
```typescript
// Subscribe to events table directly
channel.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'events'
}, async ({ eventType, old, new: newRecord }) => {
  // Update Dexie immediately
  if (eventType === 'DELETE') {
    await db.events.delete(old.id);
  } else {
    await db.events.put(newRecord);
  }

  // Trigger React Query invalidation
  queryClient.invalidateQueries(['events']);
});
```

### Event Assembly in React
```typescript
export function useCalendarEvents(userId: string, dateRange: DateRange) {
  // Get raw data from multiple tables
  const { data: events } = useEvents(userId, dateRange);
  const { data: personalDetails } = useEventDetails(userId);
  const { data: calendars } = useUserCalendars(userId);
  const { data: categories } = useUserCategories(userId);

  // Assemble complete calendar events
  return useMemo(() => {
    return events?.map(event =>
      assembleCalendarEvent(
        event,
        personalDetails?.find(d => d.event_id === event.id),
        calendars?.find(c => c.id === event.calendar_id),
        categories?.find(c => c.id === event.category_id)
      )
    ) || [];
  }, [events, personalDetails, calendars, categories]);
}
```

### Optimistic Updates
```typescript
export function useUpdateEvent() {
  return useMutation({
    mutationFn: async (update: EventUpdate) => {
      // 1. Optimistic Dexie update
      const oldEvent = await db.events.get(update.id);
      await db.events.update(update.id, update);

      try {
        // 2. Supabase update
        const { error } = await supabase
          .from('events')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;

      } catch (error) {
        // 3. Rollback on failure
        if (oldEvent) {
          await db.events.put(oldEvent);
        }
        throw error;
      }
    },
    onSettled: () => {
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries(['events']);
    }
  });
}
```

## ✅ Benefits of New Architecture

1. **True Offline-First**: All UI operations work without network
2. **Instant Updates**: Realtime changes from all users immediately visible
3. **Consistent API**: Same hook pattern for all data types
4. **Better Performance**: Direct IndexedDB queries, no view overhead
5. **Conflict Resolution**: Handle concurrent edits gracefully
6. **Extensible**: Easy to add new data types and relationships
7. **Type Safety**: Full TypeScript support across all layers

## 📊 Success Metrics

- [ ] All realtime updates working within 100ms
- [ ] Offline functionality for all CRUD operations
- [ ] Zero view queries in production code
- [ ] Consistent hook API across all data types
- [ ] <200ms query response times from Dexie
- [ ] Successful conflict resolution for concurrent edits
- [ ] 100% backwards compatibility during migration

## 🧹 Hook Consolidation & Cleanup Strategy

### Current Hook Audit (ROGUE PATTERNS TO REMOVE)

#### ❌ **Problematic Hooks - To Be Removed**
```typescript
// PATTERN 1: Direct Supabase queries without Dexie integration
- useUserCalendars() - Direct supabase.from() calls, no offline support
- useEventCategories() - Same pattern, bypasses Dexie completely
- useAIPersonas() - Direct queries, no caching strategy
- useAIModels() - Direct queries, no offline fallback

// PATTERN 2: Inconsistent mutation patterns
- useCreateEventCalendar() - Different error handling than other hooks
- useUpdateEventCalendar() - Inconsistent optimistic updates
- useDeleteEventCalendar() - Different invalidation strategy
- useToggleCalendarVisibility() - One-off pattern, should be unified

// PATTERN 3: Mixed type usage (not using Supabase types)
- UserEventCalendar - Custom interface, should use Database types
- CreateEventCalendarData - Custom interface, should use Supabase Insert types
- UpdateEventCalendarData - Custom interface, should use Supabase Update types

// PATTERN 4: Inconsistent naming and organization
- use-user-calendars.ts - Multiple hooks in one file
- use-event-categories.ts - Multiple hooks in one file (same pattern)
- useTimeSuggestions.ts - Non-data hook mixed with data hooks
```

#### ✅ **Good Hooks - To Be Migrated to New Pattern**
```typescript
// These hooks have good structure but need to follow new offline-first pattern
- useCreateEvent() - Good Supabase typing, needs Dexie integration
- useUpdateEvent() - Good separation of concerns, needs optimistic updates
- useDeleteEvent() - Simple pattern, easy to migrate
- useUserProfile() - Already in queries.ts, good pattern to extend
```

#### 🚫 **Utility Hooks - Keep As Is**
```typescript
// These don't need offline storage, keep unchanged
- useIsMobile() - DOM-based, no data
- useHydrated() - Client-side state, no data
- useConversationMessages() - Mastra-managed, different system
- useChatConversations() - Mastra-managed, different system
```

### New Unified Hook System

#### **Generic Hook Factory Pattern**
```typescript
// /src/lib/hooks/core/create-data-hook.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table } from 'dexie';
import type { Database } from '@repo/supabase';

interface CreateDataHookConfig<
  TTable extends keyof Database['public']['Tables'],
  TRow = Database['public']['Tables'][TTable]['Row'],
  TInsert = Database['public']['Tables'][TTable]['Insert'],
  TUpdate = Database['public']['Tables'][TTable]['Update']
> {
  tableName: TTable;
  dexieTable: Table<TRow, string>;
  queryKeyFactory: (userId?: string, ...args: any[]) => string[];
  fetchFn: (userId: string, ...args: any[]) => Promise<TRow[]>;
  userIdField?: keyof TRow;
  cacheTime?: number;
  staleTime?: number;
}

export function createDataHook<
  TTable extends keyof Database['public']['Tables'],
  TRow = Database['public']['Tables'][TTable]['Row'],
  TInsert = Database['public']['Tables'][TTable]['Insert'],
  TUpdate = Database['public']['Tables'][TTable]['Update']
>(config: CreateDataHookConfig<TTable, TRow, TInsert, TUpdate>) {

  // Query hook
  const useQuery = (userId: string | undefined, ...args: any[]) => {
    return useQuery({
      queryKey: config.queryKeyFactory(userId, ...args),
      queryFn: () => config.fetchFn(userId!, ...args),
      enabled: !!userId,
      staleTime: config.staleTime || 1000 * 60 * 5,
      gcTime: config.cacheTime || 1000 * 60 * 15,
    });
  };

  // Create mutation
  const useCreate = (userId: string | undefined) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: TInsert) => {
        // 1. Optimistic Dexie update
        const newRecord = { ...data, id: crypto.randomUUID() } as TRow;
        await config.dexieTable.put(newRecord);

        try {
          // 2. Supabase insert
          const { data: result, error } = await supabase
            .from(config.tableName)
            .insert(data)
            .select()
            .single();

          if (error) throw error;

          // 3. Update Dexie with server ID
          await config.dexieTable.put(result as TRow);
          return result as TRow;

        } catch (error) {
          // Rollback optimistic update
          await config.dexieTable.delete(newRecord.id);
          throw error;
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: config.queryKeyFactory(userId)
        });
      }
    });
  };

  // Update mutation
  const useUpdate = (userId: string | undefined) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, ...updates }: { id: string } & TUpdate) => {
        // 1. Get original for rollback
        const original = await config.dexieTable.get(id);

        // 2. Optimistic Dexie update
        await config.dexieTable.update(id, updates);

        try {
          // 3. Supabase update
          const { data: result, error } = await supabase
            .from(config.tableName)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          // 4. Sync with server result
          await config.dexieTable.put(result as TRow);
          return result as TRow;

        } catch (error) {
          // Rollback optimistic update
          if (original) {
            await config.dexieTable.put(original);
          }
          throw error;
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: config.queryKeyFactory(userId)
        });
      }
    });
  };

  // Delete mutation
  const useDelete = (userId: string | undefined) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        // 1. Get original for rollback
        const original = await config.dexieTable.get(id);

        // 2. Optimistic Dexie delete
        await config.dexieTable.delete(id);

        try {
          // 3. Supabase delete
          const { error } = await supabase
            .from(config.tableName)
            .delete()
            .eq('id', id);

          if (error) throw error;

        } catch (error) {
          // Rollback optimistic delete
          if (original) {
            await config.dexieTable.put(original);
          }
          throw error;
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: config.queryKeyFactory(userId)
        });
      }
    });
  };

  return {
    useQuery,
    useCreate,
    useUpdate,
    useDelete
  };
}
```

#### **Specific Hook Implementations**
```typescript
// /src/lib/hooks/data/use-user-calendars.ts
import { createDataHook } from '../core/create-data-hook';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/supabase';
import type { Database } from '@repo/supabase';

type UserCalendar = Database['public']['Tables']['user_calendars']['Row'];
type UserCalendarInsert = Database['public']['Tables']['user_calendars']['Insert'];
type UserCalendarUpdate = Database['public']['Tables']['user_calendars']['Update'];

const userCalendarHooks = createDataHook({
  tableName: 'user_calendars',
  dexieTable: db.user_calendars,
  queryKeyFactory: (userId) => ['userCalendars', userId],
  fetchFn: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_calendars')
      .select('*')
      .eq('user_id', userId)
      .order('type')
      .order('name');

    if (error) throw error;

    // Store in Dexie
    if (data) {
      await db.user_calendars.bulkPut(data);
    }

    return data || [];
  },
  userIdField: 'user_id'
});

// Export with descriptive names
export const useUserCalendars = userCalendarHooks.useQuery;
export const useCreateUserCalendar = userCalendarHooks.useCreate;
export const useUpdateUserCalendar = userCalendarHooks.useUpdate;
export const useDeleteUserCalendar = userCalendarHooks.useDelete;

// Special mutation for visibility toggle
export function useToggleUserCalendarVisibility(userId: string | undefined) {
  const updateCalendar = useUpdateUserCalendar(userId);

  return useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      return updateCalendar.mutateAsync({ id, visible });
    }
  });
}
```

#### **Migration Plan by Hook Category**

##### **Phase 1: Core User Data (Week 1)**
```typescript
// REMOVE these files entirely:
- use-user-calendars.ts (5 hooks → 4 clean hooks)
- use-event-categories.ts (4 hooks → 4 clean hooks)
- use-user-profile.ts (merge into queries.ts)
- use-update-profile.ts (merge into queries.ts)

// CREATE new clean hooks:
- /src/lib/hooks/data/use-user-calendars.ts
- /src/lib/hooks/data/use-user-categories.ts
- /src/lib/hooks/data/use-user-profiles.ts
- /src/lib/hooks/data/use-work-schedules.ts
```

##### **Phase 2: Event System (Week 2)**
```typescript
// REMOVE these files entirely:
- use-create-event.ts → use-events.ts (unified)
- use-update-event.ts → use-events.ts (unified)
- use-delete-event.ts → use-events.ts (unified)

// CREATE new event hooks:
- /src/lib/hooks/data/use-events.ts (all event CRUD)
- /src/lib/hooks/data/use-event-details.ts (personal settings)
- /src/lib/hooks/data/use-event-attendees.ts (attendee management)
```

##### **Phase 3: AI System (Week 3)**
```typescript
// REMOVE these files entirely:
- use-ai-personas.ts → unified AI hooks
- use-ai-models.ts → unified AI hooks
- use-ai-agents.ts → unified AI hooks

// CREATE new AI hooks:
- /src/lib/hooks/data/use-ai-personas.ts (using generic factory)
```

### Type Strategy with Supabase Types

#### **Strict Supabase Type Usage**
```typescript
// ✅ CORRECT: Use Supabase generated types directly
import type { Database } from '@repo/supabase';

type UserCalendar = Database['public']['Tables']['user_calendars']['Row'];
type UserCalendarInsert = Database['public']['Tables']['user_calendars']['Insert'];
type UserCalendarUpdate = Database['public']['Tables']['user_calendars']['Update'];

// ❌ WRONG: Custom interfaces that duplicate Supabase types
interface UserEventCalendar {
  id: string;
  name: string;
  // ... duplicating what Supabase already provides
}
```

#### **Extended Types for UI Components**
```typescript
// When we need computed fields or UI-specific properties
type UserCalendarWithUI = Database['public']['Tables']['user_calendars']['Row'] & {
  // Add UI-specific computed properties
  isVisible: boolean;
  eventCount?: number;
  lastUsed?: Date;
};

// Transform functions instead of custom types
function enhanceUserCalendar(calendar: UserCalendar): UserCalendarWithUI {
  return {
    ...calendar,
    isVisible: calendar.visible !== false,
    // ... other computed properties
  };
}
```

### File Removal Schedule

#### **Week 1 Removals**
- ❌ `hooks/use-user-calendars.ts` (224 lines) → ✅ `hooks/data/use-user-calendars.ts` (50 lines)
- ❌ `hooks/use-event-categories.ts` (180+ lines) → ✅ `hooks/data/use-user-categories.ts` (50 lines)
- ❌ `hooks/use-user-profile.ts` (merge into queries.ts)
- ❌ `hooks/use-update-profile.ts` (merge into queries.ts)
- ❌ `hooks/use-work-schedule.ts` (200+ lines) → ✅ `hooks/data/use-work-schedules.ts` (60 lines)

#### **Week 2 Removals**
- ❌ `hooks/use-create-event.ts` (150+ lines) → ✅ `hooks/data/use-events.ts`
- ❌ `hooks/use-update-event.ts` (200+ lines) → ✅ `hooks/data/use-events.ts`
- ❌ `hooks/use-delete-event.ts` (50 lines) → ✅ `hooks/data/use-events.ts`

#### **Week 3 Removals**
- ❌ `hooks/use-ai-personas.ts` (100+ lines) → ✅ `hooks/data/use-ai-personas.ts` (40 lines)
- ❌ `hooks/use-ai-models.ts` (80+ lines) → ✅ `hooks/data/use-ai-models.ts` (40 lines)
- ❌ `hooks/use-ai-agents.ts` (60+ lines) → ✅ `hooks/data/use-ai-agents.ts` (40 lines)

**Total Reduction**: ~1400 lines of inconsistent hook code → ~400 lines of unified, type-safe, offline-first hooks

## 🚀 Implementation Phases

### **Phase 1: Foundation (Week 1)**
- ✅ Create the plan document
- ✅ Hook audit and consolidation plan
- 🔲 Expand Dexie schema with all base tables
- 🔲 Implement generic hook factory
- 🔲 Create direct table realtime subscriptions (no views)

### **Phase 2: Core Data Hooks (Week 2)**
- 🔲 Remove rogue user data hooks: `use-user-calendars.ts`, `use-event-categories.ts`, `use-user-profile.ts`, `use-update-profile.ts`, `use-work-schedule.ts`
- 🔲 Create clean hooks: `use-user-calendars.ts`, `use-user-categories.ts`, `use-user-profiles.ts`, `use-work-schedules.ts`
- 🔲 Test offline-first functionality and optimistic updates

### **Phase 3: Event System (Week 3)**
- 🔲 Remove event hooks: `use-create-event.ts`, `use-update-event.ts`, `use-delete-event.ts`
- 🔲 Implement client-side event assembly from base tables
- 🔲 Create unified `use-events.ts` with full CRUD operations
- 🔲 Add event details and attendee management hooks

### **Phase 4: AI System & Final Cleanup (Week 4)**
- 🔲 Remove AI hooks: `use-ai-personas.ts`, `use-ai-models.ts`, `use-ai-agents.ts`
- 🔲 Create clean AI hooks using generic factory pattern
- 🔲 Migrate all components to use new hook system
- 🔲 Test and validate all realtime updates work properly
- 🔲 Performance optimization and conflict resolution testing

### **Success Metrics**
- [ ] All realtime updates working within 100ms
- [ ] Offline functionality for all CRUD operations
- [ ] Zero view queries in production code
- [ ] Consistent hook API across all data types
- [ ] <200ms query response times from Dexie
- [ ] Successful conflict resolution for concurrent edits
- [ ] ~70% reduction in hook code (1400+ lines → ~400 lines)

## 📊 Implementation Summary

**✅ COMPLETED:**
- Comprehensive architecture plan with detailed technical specifications
- Hook audit identifying 17 problematic hooks across 16 files
- Generic hook factory design with full TypeScript support
- Migration strategy with backwards compatibility
- Type strategy enforcing Supabase types throughout

**🎯 BENEFITS OF NEW SYSTEM:**
- **True offline-first**: All operations work without network
- **Instant realtime updates**: Direct table subscriptions, no view delays
- **Consistent API**: Same CRUD pattern for all data types
- **Type safety**: Full Supabase type integration
- **Optimistic updates**: Automatic rollback on failures
- **Massive code reduction**: 1400+ lines → ~400 lines of clean, maintainable hooks

This plan provides a complete roadmap for achieving production-ready offline-first architecture with robust realtime synchronization, unified consistent hooks, and proper Supabase type usage throughout.