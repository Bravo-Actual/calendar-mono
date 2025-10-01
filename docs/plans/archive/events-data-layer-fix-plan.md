# Events Data Layer Fix Plan

## Current Problem
I fucked up the events data layer by adding fake `creator_id` fields and creating inconsistent patterns that don't follow the established offline-first architecture.

## Correct Pattern for Events

### Core Principle
Events are special because of complex relationships and business logic. They follow a hybrid pattern:

1. **Sync all individual tables normally** - events, event_details_personal, event_users, event_rsvps
2. **Mutations only on resolved events** - work with complete EventResolved structure
3. **Outbox routes to edge function** - edge function handles composite operations
4. **Sync brings back results** - all tables sync individually after edge function processes

### Architecture Flow

```
UI Mutation Request
↓
createEventResolved/updateEventResolved/deleteEventResolved
↓
Optimistic Dexie Update (full resolved event)
↓
Outbox Entry (composite event data)
↓
sync.ts routes to Edge Function
↓
Edge Function processes composite data → updates individual tables
↓
Individual table syncs pull back updated data
↓
Resolved hooks reactively update UI
```

## Implementation Plan

### 1. Individual Table Sync (Keep As-Is)
These work normally - just sync, no mutations:
- `events` table sync
- `event_details_personal` table sync
- `event_users` table sync
- `event_rsvps` table sync

### 2. Resolved Event Mutations (Fix These)
Only these functions exist for mutations:
- `createEventResolved()` - creates event + personal details + relationships
- `updateEventResolved()` - updates any part of resolved event
- `deleteEventResolved()` - deletes event and cascades to related tables

Each follows pattern:
1. Validate input
2. Optimistic update to Dexie (all affected tables)
3. Single outbox entry with composite data
4. Edge function handles server-side complexity

### 3. Outbox Routing (Fix sync.ts)
- Route ALL event-related table operations to edge function
- Edge function receives composite EventResolved data
- Edge function breaks apart and updates individual server tables
- No more "table not supported" errors

### 4. Edge Function (Already Working)
- Receives composite event data with personal_details
- Handles server-side validation and business logic
- Updates events, event_details_personal, event_users, event_rsvps tables
- Database triggers handle relationships

### 5. Sync Back (Keep As-Is)
- Individual table syncs bring back updated data
- useLiveQuery hooks reactively update UI
- EventResolved combines data from all tables

## Files to Fix

### 1. `/apps/calendar/src/lib/data-v2/domains/events-resolved.ts`
**Status**: Mostly correct, needs cleanup
- Remove direct edge function calls (let outbox handle)
- Ensure only resolved mutations exist
- Follow standard validation + optimistic + outbox pattern

### 2. `/apps/calendar/src/lib/data-v2/base/sync.ts`
**Status**: Needs fix
- `processEventTablesViaEdgeFunction()` should handle all event tables
- Remove "not yet supported" errors
- All event table outbox entries go to edge function

### 3. `/supabase/functions/events/index.ts`
**Status**: Working correctly
- Receives composite event data
- Handles personal_details properly
- Updates all related tables

### 4. `/apps/calendar/src/lib/data/base/mapping.ts`
**Status**: Mostly fixed
- `mapEventResolvedToServer()` works for edge function
- Standard mapping functions work for individual table sync

## Current Status
- ✅ Event creation working (400 error fixed by removing fake creator_id)
- ✅ Edge function properly handles composite data
- ✅ Individual table types are correct
- ❌ Need to clean up sync.ts routing
- ❌ Need to remove any remaining crud operations on individual tables

## Key Rules
1. **Never create individual table CRUD** - only sync functions
2. **Only resolved event mutations** - work with complete structure
3. **Outbox always routes events to edge function** - no direct Supabase calls
4. **Edge function handles complexity** - breaking apart composite data
5. **Sync brings back results** - individual tables sync normally

This pattern keeps the offline-first benefits while handling the complex event relationships through server-side business logic.