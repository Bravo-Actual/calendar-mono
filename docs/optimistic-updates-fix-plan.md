# Optimistic Updates Fix Plan

## Current Problem
Events are created successfully in the database but don't appear immediately on the calendar grid. They only show up after browser refresh.

## Root Cause Analysis (Confirmed)

### ✅ What Works
- Database event creation (events table)
- Database trigger (`create_owner_event_details_trigger`) creates `event_details_personal` records
- Events persist and show after refresh
- Optimistic update code executes (logs confirm)

### ❌ What's Broken
- TanStack Query v5 `setQueriesData` API misuse
- Data type mismatch between optimistic and cached data
- Missing simulation of database trigger in optimistic flow

## Technical Investigation Results

**Console Logs from Event Creation:**
```
🔄 Attempting optimistic cache update for user: f9714a03-0d6b-40dd-afef-12690013e3f2
📋 All cached queries: (15) [Array(2), Array(2), ...]
📅 Event queries in cache: (2) [Array(2), Array(2)]
Successfully created events: ['4a6ab4e3-b5f9-4e0c-9f71-d7e5d279b4fd']
```

**Missing Logs (Proves Cache Update Fails):**
- ❌ No `🔍 Query key check:` (matching function never called)
- ❌ No `📊 Old cache data:` (cache update callback never runs)

## Three Critical Issues Identified

### 1. TanStack Query v5 API Misuse
**Current (Broken):**
```typescript
queryClient.setQueriesData(
  { queryKey: (k: any) => Array.isArray(k) && k[0] === 'events' && k[1]?.uid === userId },
  (oldData) => [...oldData, optimisticEvent]
);
```

**Correct v5 Pattern:**
```typescript
queryClient.setQueriesData(
  {
    queryKey: ['events'],
    predicate: (query) => {
      const [, vars] = query.queryKey as [string, { uid?: string; from?: number; to?: number }];
      return vars?.uid === userId && rangesOverlap(vars?.from, vars?.to, startMs, endMs);
    }
  },
  (oldData) => upsertById(oldData || [], assembledOptimistic)
);
```

### 2. Data Type Mismatch
**Current (Broken):**
- Optimistic event: `Event` (base table only)
- Cache expects: `AssembledEvent[]` (joined data with calendar, category, personal details)

**Missing Fields in Optimistic Event:**
```typescript
// AssembledEvent has these but optimistic Event doesn't:
calendar_name, calendar_color, category_name, category_color,
show_time_as, time_defense_level, ai_managed, user_role, etc.
```

### 3. Database Trigger Not Simulated
**Database Flow:**
1. Insert into `events` table
2. Trigger automatically creates `event_details_personal` with default calendar
3. Query assembles complete event with joins

**Optimistic Flow (Missing):**
1. Create optimistic `Event` ✅
2. Simulate `event_details_personal` creation ❌
3. Assemble complete `AssembledEvent` for cache ❌

## Solution Implementation Plan

### Files to Modify
- **Primary**: `/apps/calendar/src/lib/data/domains/events.ts` (lines 94-200)
- **Helper**: Add utility functions for assembly and range overlap

### Implementation Steps
1. **Add Helper Functions:**
   ```typescript
   const rangesOverlap = (from?, to?, s?, e?) => !(e < from || s > to);
   const upsertById = <T>(arr: T[], item: T) => /* replace or append by id */;
   const assembleOptimisticEvent = (event, edp, calendar, category, userId) => AssembledEvent;
   ```

2. **Replace useCreateEvent with TanStack v5 Pattern:**
   - Use `onMutate` for optimistic updates
   - Use `predicate` in `setQueriesData`
   - Create local `event_details_personal` record in Dexie
   - Assemble complete `AssembledEvent` before cache update

3. **Simulate Database Trigger:**
   ```typescript
   // In onMutate:
   const defaultCalendar = await db.user_calendars
     .where({ user_id: userId, type: 'default' })
     .first();

   const optimisticEDP = {
     event_id: eventId,
     user_id: userId,
     calendar_id: input.calendar_id || defaultCalendar?.id,
     show_time_as: 'busy',
     time_defense_level: 'normal',
     ai_managed: false
   };

   await db.event_details_personal.put(optimisticEDP);
   ```

4. **Assembly and Cache Update:**
   ```typescript
   const assembled = assembleOptimisticEvent(optimisticEvent, optimisticEDP, calendar, category, userId);

   queryClient.setQueriesData(
     { queryKey: ['events'], predicate: matchesUserAndRange },
     (old) => upsertById(old || [], assembled)
   );
   ```

## Current Code Location
**File:** `/Users/mbrasket/dev/calendar-mono/apps/calendar/src/lib/data/domains/events.ts`
**Function:** `useCreateEvent` (lines ~94-200)
**Problematic patterns:** Lines 130-143 (setQueriesData), 115-125 (optimistic event creation)

## Expected Outcome
After fix:
- ✅ Events appear immediately on calendar grid
- ✅ Proper data structure in cache
- ✅ Seamless offline-first experience
- ✅ No duplicates when server response arrives

## Next Session Tasks
1. Implement the three helper functions
2. Rewrite `useCreateEvent` using TanStack v5 `onMutate` pattern
3. Test optimistic updates work immediately
4. Clean up debug logging
5. Apply same pattern to `useUpdateEvent` and `useDeleteEvent` if needed