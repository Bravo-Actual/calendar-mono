# Timestamp Normalization Architecture Plan

## Overview

This plan addresses the timestamp format mismatch between PostgreSQL/Supabase (returns `"2025-09-25 20:00:00+00"`) and JavaScript Date parsing (expects `"2025-09-25T20:00:00+00:00"`). We'll implement a clean server-to-client type mapping architecture that normalizes timestamps once at the API boundary.

## Problem Statement

Currently, the calendar application is experiencing runtime errors due to invalid Date parsing:
- PostgreSQL returns timestamps with space separator: `"2025-09-25 20:00:00+00"`
- JavaScript `new Date()` expects ISO format with T separator: `"2025-09-25T20:00:00+00:00"`
- This causes `NaN` values in millisecond calculations throughout the app
- Multiple components are doing redundant timestamp calculations

## Goals

1. **Type Safety**: Maintain Supabase generated types while ensuring runtime safety
2. **Single Source of Truth**: Normalize timestamps once at API boundary
3. **Performance**: Pre-compute millisecond values for calendar operations
4. **Maintainability**: Clear separation between server and client data models
5. **Consistency**: All components work with normalized timestamps

## Architecture Strategy

### 1. Type System Separation

```typescript
// Server Types (from Supabase codegen)
export type ServerEventRow = Database['public']['Tables']['events']['Row'];
export type ServerEventInsert = Database['public']['Tables']['events']['Insert'];

// Client Types (normalized for runtime)
export type ClientEventRow = Omit<ServerEventRow, 'start_time' | 'end_time' | 'created_at' | 'updated_at'> & {
  start_time: ISODateString;     // normalized ISO format
  end_time: ISODateString;       // normalized ISO format
  created_at: ISODateString;
  updated_at: ISODateString;
  // Pre-computed milliseconds for calendar operations
  start_time_ms: Millis;
  end_time_ms: Millis;
};
```

### 2. Data Flow Architecture

```
Supabase DB (PostgreSQL format)
    ↓ SELECT queries
Server Types (raw PostgreSQL timestamps)
    ↓ mapEventFromServer() - SINGLE NORMALIZATION POINT
Client Types (ISO timestamps + computed ms)
    ↓ Store in Dexie
Calendar Components (always normalized data)
```

### 3. Boundary Transformation

All timestamp normalization happens at exactly one place:
- **Incoming**: Map server types → client types after Supabase queries
- **Outgoing**: Convert client types → server types before Supabase mutations
- **Storage**: Dexie stores only normalized client types
- **Components**: Always consume normalized client types

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Create Timestamp Utilities
**File**: `src/lib/data/base/time.ts`
```typescript
export type ISODateString = string;
export type Millis = number;

export function pgToIso(ts?: string | null): string | null {
  if (!ts) return ts ?? null;
  let out = ts.replace(' ', 'T');
  out = out.replace(/([+-]\d{2})(\d{2})$/, '$1:$2').replace(/([+-]\d{2})$/, '$1:00');
  return out;
}

export const toMs = (isoString: string): number => new Date(isoString).getTime();
```

#### 1.2 Define Type Aliases
**File**: `src/lib/data/base/server-types.ts`
```typescript
import type { Database } from '@repo/supabase';

// Server types (raw from Supabase)
export type ServerEventRow = Database['public']['Tables']['events']['Row'];
export type ServerEventInsert = Database['public']['Tables']['events']['Insert'];
export type ServerEventUpdate = Database['public']['Tables']['events']['Update'];
export type ServerEDPRow = Database['public']['Tables']['event_details_personal']['Row'];
export type ServerCalRow = Database['public']['Tables']['user_calendars']['Row'];
export type ServerCatRow = Database['public']['Tables']['user_categories']['Row'];
```

#### 1.3 Define Client Types
**File**: `src/lib/data/base/client-types.ts`
```typescript
import type { ISODateString, Millis } from './time';

// Client types (normalized)
export type ClientEventRow = Omit<ServerEventRow, 'start_time' | 'end_time' | 'created_at' | 'updated_at'> & {
  start_time: ISODateString;
  end_time: ISODateString;
  created_at: ISODateString;
  updated_at: ISODateString;
  // Pre-computed for calendar operations
  start_time_ms: Millis;
  end_time_ms: Millis;
};

export type ClientEDPRow = Omit<ServerEDPRow, 'updated_at'> & {
  updated_at: ISODateString;
};

export type ClientCalRow = Omit<ServerCalRow, 'updated_at'> & {
  updated_at: ISODateString;
};

export type ClientCatRow = Omit<ServerCatRow, 'updated_at'> & {
  updated_at: ISODateString;
};
```

#### 1.4 Create Mapping Functions
**File**: `src/lib/data/base/mapping.ts`
```typescript
import { pgToIso, toMs } from './time';

export const mapEventFromServer = (row: ServerEventRow): ClientEventRow => {
  const normalizedStartTime = pgToIso(row.start_time)!;
  const normalizedEndTime = pgToIso(row.end_time)!;

  return {
    ...row,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
    created_at: pgToIso(row.created_at)!,
    updated_at: pgToIso(row.updated_at)!,
    start_time_ms: toMs(normalizedStartTime),
    end_time_ms: toMs(normalizedEndTime),
  };
};

export const mapEventToServer = (client: Partial<ClientEventRow>): Partial<ServerEventInsert> => ({
  ...client,
  // Keep ISO format for server (PostgreSQL handles ISO correctly for inserts)
  start_time: client.start_time,
  end_time: client.end_time,
  // Omit computed fields
  start_time_ms: undefined,
  end_time_ms: undefined,
});

// Similar mappers for EDP, Calendar, Category...
```

### Phase 2: Update Data Layer

#### 2.1 Update Dexie Schema and Types
**File**: `src/lib/data/base/dexie.ts`
```typescript
import type { ClientEventRow, ClientEDPRow, ClientCalRow, ClientCatRow } from './client-types';

// Update type exports to use client types
export type Event = ClientEventRow;
export type EventDetailsPersonal = ClientEDPRow;
export type UserCalendar = ClientCalRow;
export type UserCategory = ClientCatRow;

// Dexie schema remains the same (stores normalized data)
export class AppDB extends Dexie {
  events!: Table<Event, UUID>;
  event_details_personal!: Table<EventDetailsPersonal, [UUID, UUID]>;
  user_calendars!: Table<UserCalendar, UUID>;
  user_categories!: Table<UserCategory, UUID>;
}
```

#### 2.2 Update Assembly Function
**File**: `src/lib/data/base/assembly.ts`
```typescript
// Remove timestamp calculations - already done in mapping
export interface AssembledEvent {
  // Base event fields (already normalized with computed ms)
  ...Event,
  // No need to compute start_time_ms/end_time_ms - already available

  // User-specific fields
  calendar_id?: string | null;
  // ... rest remains the same
}

async function assembleEvents(
  events: Event[],  // Already normalized ClientEventRow types
  // ... other params
): Promise<AssembledEvent[]> {
  return events.map(event => ({
    ...event, // Already has start_time_ms, end_time_ms
    // Add user-specific fields
    calendar_id: details?.calendar_id || null,
    // ... rest of assembly logic
  }));
}
```

#### 2.3 Update CRUD Operations
**File**: `src/lib/data/domains/events.ts`
```typescript
import { mapEventFromServer, mapEventToServer } from '../base/mapping';

export function useCreateEvent(userId: string | undefined) {
  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<AssembledEvent> => {
      // ... optimistic logic with ClientEventRow types

      try {
        // Server insert with mapped data
        const serverPayload = mapEventToServer({
          id: optimisticEventId,
          owner_id: userId,
          creator_id: userId,
          ...input,
        });

        const { data: eventResult, error } = await supabase
          .from('events')
          .insert(serverPayload)
          .select()
          .single();

        if (error) throw error;

        // Map server response back to client type
        const normalizedEvent = mapEventFromServer(eventResult);

        // Store normalized data in Dexie
        await db.events.put(normalizedEvent);

        return assembleEvent(normalizedEvent, ...);
      } catch (error) {
        // ... error handling
      }
    }
  });
}
```

### Phase 3: Component Updates

#### 3.1 Remove Redundant Calculations

**Target Files**:
- `src/components/utils.ts` - All `new Date().getTime()` calls
- `src/components/event-card.tsx` - Use pre-computed `event.start_time_ms`
- `src/components/day-column.tsx` - Use pre-computed milliseconds
- `src/components/agenda-view.tsx` - Use pre-computed milliseconds

**Pattern**: Replace all instances of:
```typescript
// OLD: Redundant calculation
const startMs = new Date(event.start_time).getTime();

// NEW: Use pre-computed value
const startMs = event.start_time_ms;
```

#### 3.2 Update Type Imports

**Target Files**: All component files using event data
```typescript
// OLD
import type { CalendarEvent } from './types';

// NEW
import type { AssembledEvent } from '@/lib/data/base/assembly';
```

#### 3.3 Drag and Drop Fixes

**File**: `src/components/day-column.tsx`
```typescript
// Drag initialization now works with normalized data
setDrag({
  kind,
  id,
  origStart: evt.start_time_ms, // Pre-computed, always valid
  origEnd: evt.end_time_ms,     // Pre-computed, always valid
  // ... rest
});
```

### Phase 4: Realtime Updates

#### 4.1 Update Realtime Subscriptions
**File**: `src/lib/realtime/subscriptions.ts`
```typescript
import { mapEventFromServer } from '@/lib/data/base/mapping';

// In realtime handlers
const handleEventChange = (payload: any) => {
  const serverEvent = payload.new as ServerEventRow;
  const normalizedEvent = mapEventFromServer(serverEvent);

  // Store normalized data
  await db.events.put(normalizedEvent);

  // Update queries
  queryClient.invalidateQueries({ queryKey: ['events'] });
};
```

### Phase 5: Testing and Validation

#### 5.1 Unit Tests
- Test `pgToIso()` with various PostgreSQL timestamp formats
- Test mapping functions with sample server data
- Validate computed millisecond values

#### 5.2 Integration Tests
- Test complete data flow: Supabase → mapping → Dexie → components
- Verify drag and drop operations work correctly
- Test event creation/editing with new type system

#### 5.3 Manual Testing Checklist
- [ ] Event creation works without errors
- [ ] Event times display correctly in calendar
- [ ] Drag and drop operations work smoothly
- [ ] Time labels render properly
- [ ] No console errors related to Date parsing
- [ ] All calendar views (day, week, agenda) work correctly

## Migration Strategy

### Phase 1: Infrastructure (Day 1)
1. Create time utilities, type definitions, and mapping functions
2. No component changes yet - purely additive

### Phase 2: Data Layer (Day 2)
1. Update Dexie types to use client types
2. Update assembly function to remove redundant calculations
3. Update CRUD operations to use mapping functions

### Phase 3: Components (Day 3)
1. Remove all redundant `new Date().getTime()` calculations
2. Update components to use pre-computed millisecond fields
3. Fix drag and drop operations

### Phase 4: Realtime (Day 4)
1. Update realtime subscriptions to use mapping
2. Test end-to-end data flow

### Phase 5: Validation (Day 5)
1. Comprehensive testing
2. Performance validation
3. Bug fixes and polish

## Success Metrics

- [ ] Zero runtime errors related to Date parsing
- [ ] All calendar operations work smoothly
- [ ] Performance improvement (no redundant calculations)
- [ ] Type safety maintained throughout
- [ ] Clean separation between server and client data models
- [ ] Single source of truth for timestamp normalization

## Risk Mitigation

1. **Breaking Changes**: Implement incrementally, test each phase
2. **Performance**: Monitor for any performance regressions
3. **Type Errors**: Maintain strict TypeScript checking
4. **Data Consistency**: Validate mapping functions thoroughly
5. **Rollback Plan**: Keep old implementation available during migration

## Long-term Benefits

1. **Maintainability**: Clear data flow and single normalization point
2. **Performance**: Pre-computed values, no redundant calculations
3. **Type Safety**: Strict separation between server and client types
4. **Developer Experience**: Predictable data structures throughout app
5. **Scalability**: Clean foundation for future data model changes