# Offline-First Data Layer Implementation Guide

This is the authoritative step-by-step guide for implementing new tables in the calendar application's offline-first data layer. This guide is based on the actual implementations of all v2 tables: `user_categories`, `user_calendars`, `user_profiles`, `user_work_periods`, and `ai_personas`.

## System Overview

### Architecture Summary

The offline-first data layer provides instant UI updates with eventual server synchronization through a carefully orchestrated system:

- **Dexie (IndexedDB)**: Single source of truth for all application data
- **useLiveQuery**: Reactive hooks that automatically update UI when data changes
- **Outbox Pattern**: Local mutations are queued for eventual server sync
- **Centralized Real-time**: Single WebSocket channel handles all table subscriptions
- **Optimistic Updates**: UI updates instantly, with server sync happening in background
- **Conflict Resolution**: Last-write-wins with duplicate key error handling

### Key Components

1. **Dexie Database**: Local IndexedDB with versioned schema
2. **Domain Files**: Per-table hooks and CRUD operations
3. **Mapping Functions**: Server ↔ Client timestamp conversion
4. **Validation Schemas**: Zod schemas for data integrity
5. **Centralized Sync**: Single channel for all real-time subscriptions
6. **DataProvider**: Orchestrates initial sync and real-time setup

### Data Flow

```
UI Component → useLiveQuery Hook → Dexie Database
                                        ↓
UI Mutation → Domain CRUD Function → Dexie (instant) → Outbox → Server
                                        ↓
Real-time Server Changes → Centralized Channel → Mapping → Dexie → useLiveQuery → UI
```

## Prerequisites

Before implementing a new table, ensure:

- Table exists in Supabase with proper RLS policies
- `ServerYourTable` and `ClientYourTable` types defined in `client-types.ts`
- `mapYourTableFromServer` function exists in `mapping.ts`
- `YourTableSchema` validation exists in `validators.ts`

## Implementation Checklist

Follow this exact checklist for every new table:

- [ ] **Step 1**: Add table to Dexie schema and increment version
- [ ] **Step 2**: Create domain file with hooks and CRUD functions
- [ ] **Step 3**: Add table to centralized realtime subscriptions
- [ ] **Step 4**: Update DataProvider to pull table data
- [ ] **Step 5**: Export functions from v2 index
- [ ] **Step 6**: Update UI components to use v2 hooks
- [ ] **Step 7**: Test all functionality

## Step-by-Step Implementation

### Step 1: Add Table to Dexie Schema

**File**: `apps/calendar/src/lib/data-v2/base/dexie.ts`

**Purpose**: Define the local IndexedDB table structure and indexes

```typescript
// 1. Import the client type
import type {
  ClientCategory,
  ClientCalendar,
  ClientUserProfile,
  ClientUserWorkPeriod,
  ClientPersona,
  ClientYourTable  // Add this
} from '../../data/base/client-types';

// 2. Add table declaration
export class OfflineDB extends Dexie {
  // Core tables
  user_categories!: Table<ClientCategory, string>;
  user_calendars!: Table<ClientCalendar, string>;
  user_profiles!: Table<ClientUserProfile, string>;
  user_work_periods!: Table<ClientUserWorkPeriod, string>;
  ai_personas!: Table<ClientPersona, string>;
  your_table!: Table<ClientYourTable, string>; // Add this

  // 3. Increment version and add schema
  constructor(name = 'calendar-db-v2') {
    super(name);

    this.version(5).stores({ // Increment version number
      // Categories with compound indexes per plan
      user_categories: 'id, user_id, updated_at',

      // Calendars with compound indexes
      user_calendars: 'id, user_id, updated_at, type, visible',

      // User profiles
      user_profiles: 'id, updated_at',

      // User work periods
      user_work_periods: 'id, user_id, updated_at',

      // AI personas
      ai_personas: 'id, user_id, updated_at',

      // Your table
      your_table: 'id, user_id, updated_at', // Add this with appropriate indexes

      // Outbox per plan spec
      outbox: 'id, user_id, table, op, created_at, attempts',

      // Meta for sync watermarks
      meta: 'key'
    });
  }
}
```

**Index Guidelines**:
- Always include: `id, user_id, updated_at` for user-scoped tables
- User profiles use `id, updated_at` (since id = user_id)
- Add additional indexes for common query patterns
- Use compound indexes for multi-field queries: `[user_id+type]`

### Step 2: Create Domain File

**File**: `apps/calendar/src/lib/data-v2/domains/your-table.ts`

**Purpose**: Provide reactive hooks and CRUD operations following the exact v2 pattern

```typescript
// data-v2/domains/your-table.ts - Offline-first your table implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { YourTableSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable } from '../base/sync';
import { mapYourTableFromServer } from '../../data/base/mapping';
import type { ClientYourTable } from '../../data/base/client-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useYourTables(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientYourTable[]> => {
    if (!uid) return [];

    return await db.your_table
      .where('user_id')
      .equals(uid)
      .sortBy('created_at'); // or 'name', 'updated_at', etc.
  }, [uid]);
}

export function useYourTable(uid: string | undefined, itemId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientYourTable | undefined> => {
    if (!uid || !itemId) return undefined;

    const item = await db.your_table.get(itemId);
    return item?.user_id === uid ? item : undefined;
  }, [uid, itemId]);
}

// Dexie-first mutations with outbox pattern
export async function createYourTable(
  uid: string,
  input: {
    name: string;
    // Add other fields based on your table structure
    color?: string;
    type?: 'default' | 'user' | 'archive';
    visible?: boolean;
  }
): Promise<ClientYourTable> {
  const id = generateUUID();
  const now = nowISO();

  const item: ClientYourTable = {
    id,
    user_id: uid,
    name: input.name,
    color: input.color ?? 'blue',
    type: input.type ?? 'user',
    visible: input.visible ?? true,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedItem = validateBeforeEnqueue(YourTableSchema, item);

  // 2. Write to Dexie first (instant optimistic update)
  await db.your_table.put(validatedItem);

  // 3. Enqueue in outbox for eventual server sync
  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'your_table',
    op: 'insert',
    payload: validatedItem,
    created_at: now,
    attempts: 0,
  });

  return item;
}

export async function updateYourTable(
  uid: string,
  itemId: string,
  input: {
    name?: string;
    color?: string;
    type?: 'default' | 'user' | 'archive';
    visible?: boolean;
  }
): Promise<void> {
  // 1. Get existing item from Dexie
  const existing = await db.your_table.get(itemId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Item not found or access denied');
  }

  const now = nowISO();
  const updated: ClientYourTable = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedItem = validateBeforeEnqueue(YourTableSchema, updated);

  // 3. Write to Dexie first (instant optimistic update)
  await db.your_table.put(validatedItem);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'your_table',
    op: 'update',
    payload: validatedItem,
    created_at: now,
    attempts: 0,
  });
}

export async function deleteYourTable(uid: string, itemId: string): Promise<void> {
  // 1. Get existing item from Dexie
  const existing = await db.your_table.get(itemId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Item not found or access denied');
  }

  // 2. Add business logic validation if needed
  // Example: Prevent deletion of default items
  // if (existing.type === 'default') {
  //   throw new Error('Cannot delete default item');
  // }

  // 3. Delete from Dexie first (instant optimistic update)
  await db.your_table.delete(itemId);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'your_table',
    op: 'delete',
    payload: { id: itemId },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Data sync functions (called by DataProvider)
export async function pullYourTable(uid: string): Promise<void> {
  return pullTable('your_table', uid, mapYourTableFromServer);
}
```

**Key Patterns**:
- **Import Structure**: Always identical across all domain files
- **Hook Naming**: `useYourTables()` (plural) and `useYourTable()` (singular)
- **CRUD Functions**: `create`, `update`, `delete` prefixed with table name
- **Error Handling**: Ownership validation in all mutation functions
- **Outbox Pattern**: Validate → Dexie → Outbox in exact order

### Step 3: Add to Centralized Realtime Subscriptions

**File**: `apps/calendar/src/lib/data-v2/base/sync.ts`

**Purpose**: Add your table to the single WebSocket channel that handles all real-time updates

```typescript
// 1. Add mapping import
import {
  mapCategoryFromServer,
  mapCalendarFromServer,
  mapUserProfileFromServer,
  mapUserWorkPeriodFromServer,
  mapPersonaFromServer,
  mapYourTableFromServer // Add this
} from '../../data/base/mapping';

// 2. Add subscription handler in setupCentralizedRealtimeSubscription function
function setupCentralizedRealtimeSubscription(userId: string, onUpdate?: () => void) {
  const channel = supabase.channel(`user-data:${userId}`);

  // ... existing handlers for other tables ...

  // Your Table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'your_table',
      filter: `user_id=eq.${userId}`, // Use 'id=eq.${userId}' for user_profiles
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.your_table.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapYourTableFromServer(payload.new as any);
          await db.your_table.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for your_table:', error);
      }
    }
  );

  return channel.subscribe();
}
```

**Filter Patterns**:
- Most tables: `user_id=eq.${userId}`
- User profiles: `id=eq.${userId}` (since id = user_id for profiles)

### Step 4: Update DataProvider

**File**: `apps/calendar/src/lib/data-v2/providers/DataProvider.tsx`

**Purpose**: Add your table to the initial data pull sequence

```typescript
// 1. Add import
import { pullCategories } from '../domains/categories';
import { pullCalendars } from '../domains/calendars';
import { pullUserProfiles } from '../domains/user-profiles';
import { pullUserWorkPeriods } from '../domains/user-work-periods';
import { pullAIPersonas } from '../domains/ai-personas';
import { pullYourTable } from '../domains/your-table'; // Add this

// 2. Add to initial data pull sequence
async function initializeSync() {
  try {
    // ... storage permission code ...

    // Initial data pull
    await pullCategories(user!.id);
    await pullCalendars(user!.id);
    await pullUserProfiles(user!.id);
    await pullUserWorkPeriods(user!.id);
    await pullAIPersonas(user!.id);
    await pullYourTable(user!.id); // Add this

    // Start sync orchestration (includes centralized realtime subscriptions)
    await startSync(user!.id);

  } catch (error) {
    console.error('Failed to initialize data provider:', error);
  }
}
```

**Order**: Add your table pull after existing ones, maintaining alphabetical-ish order

### Step 5: Export from V2 Index

**File**: `apps/calendar/src/lib/data-v2/index.ts`

**Purpose**: Export all your table functions from the main v2 entry point

```typescript
// 1. Add type export
export type {
  ClientCategory,
  ClientCalendar,
  ClientUserProfile,
  ClientUserWorkPeriod,
  ClientPersona,
  ClientYourTable // Add this
} from '../data/base/client-types';

// 2. Add domain exports (add after existing domains)
// Your table domain
export {
  useYourTables,
  useYourTable,
  createYourTable,
  updateYourTable,
  deleteYourTable,
  pullYourTable,
} from './domains/your-table';
```

**Pattern**: Export all hooks, CRUD functions, and pull function. Do NOT export individual realtime subscription functions (they don't exist - we use centralized subscriptions).

### Step 6: Update UI Components

**Purpose**: Replace old TanStack Query patterns with v2 offline-first patterns

**Before (TanStack Query)**:
```typescript
import {
  useYourTables,
  useCreateYourTable,
  useUpdateYourTable,
  useDeleteYourTable,
  type ClientYourTable
} from '@/lib/data'

const { data: items = [], isLoading } = useYourTables(user?.id)
const createMutation = useCreateYourTable(user?.id)

const handleCreate = async () => {
  await createMutation.mutateAsync({ name: 'test' })
}
```

**After (V2 Offline-first)**:
```typescript
import {
  useYourTables,
  createYourTable,
  updateYourTable,
  deleteYourTable,
  type ClientYourTable
} from '@/lib/data-v2'

const items = useYourTables(user?.id)
const isLoading = !items && !!user?.id // Loading if user exists but no data yet

const handleCreate = async () => {
  if (!user?.id) return
  try {
    await createYourTable(user.id, { name: 'test' })
  } catch (error) {
    console.error('Failed to create item:', error)
  }
}
```

**Key Changes**:
1. **Hook Returns**: Direct data arrays, not `{ data, isLoading }` objects
2. **Loading State**: Calculate using `!data && !!userId` pattern
3. **Mutations**: Direct async function calls, not mutation objects
4. **Error Handling**: Use try/catch blocks
5. **User Validation**: Always check `user?.id` before mutations

### Step 7: Testing

Verify the following functionality:

**Data Operations**:
- [ ] Initial data loads on app start
- [ ] Create operations work offline and online
- [ ] Update operations work offline and online
- [ ] Delete operations work offline and online
- [ ] Data syncs when connection restored

**Real-time Updates**:
- [ ] Changes from other sessions appear immediately
- [ ] Real-time works in multiple browser tabs
- [ ] Real-time survives connection drops

**UI Behavior**:
- [ ] Loading states show correctly
- [ ] UI updates instantly on mutations
- [ ] Error states display properly
- [ ] No duplicate entries or flickering

## Key File Descriptions

### Core Files

| File | Purpose | Modifications Required |
|------|---------|------------------------|
| `dexie.ts` | Local database schema | Add table declaration and schema |
| `sync.ts` | Centralized real-time and sync | Add real-time subscription handler |
| `DataProvider.tsx` | Orchestrates initialization | Add table to initial pull sequence |
| `index.ts` | Main v2 exports | Export all table functions |

### Per-Table Files

| File | Purpose | Action |
|------|---------|--------|
| `domains/your-table.ts` | Hooks and CRUD operations | Create new file |
| `mapping.ts` | Server ↔ Client conversion | Should already exist |
| `validators.ts` | Zod validation schemas | Should already exist |
| `client-types.ts` | TypeScript interfaces | Should already exist |

## Common Patterns

### Error Handling
```typescript
const handleMutation = async () => {
  if (!user?.id) return

  try {
    await createYourTable(user.id, { name: inputValue })
    setInputValue('') // Clear form on success
  } catch (error) {
    console.error('Failed to create item:', error)
    // Show toast or error message
  }
}
```

### Business Logic Validation
```typescript
// In delete function
if (existing.is_default) {
  throw new Error('Cannot delete default items');
}

// In update function
if (input.type === 'archive' && existing.type === 'default') {
  throw new Error('Cannot archive default items');
}
```

### Complex Queries
```typescript
// Use compound indexes for multi-field queries
return await db.your_table
  .where('[user_id+type]')
  .equals([uid, 'active'])
  .sortBy('name');
```

## Migration Strategy

When migrating existing components:

1. **Create v2 domain** alongside existing old data layer
2. **Test in isolation** with a single component first
3. **Gradual migration** component by component
4. **Parallel operation** during transition period
5. **Complete cutover** remove old hooks after full testing

## Troubleshooting

### Common Issues

**"Cannot read properties of undefined"**
- Check that user ID exists before calling hooks
- Verify loading state calculation: `!data && !!userId`

**Data not syncing**
- Verify table added to DataProvider pull sequence
- Check RLS policies in Supabase
- Ensure real-time subscription added to sync.ts

**TypeScript errors**
- Use `ClientYourTable['field']` for proper enum types
- Verify all exports exist in index.ts

**Real-time not working**
- Check WebSocket connection in Network tab
- Verify filter pattern matches table structure
- Ensure mapping function handles all fields

This implementation guide ensures perfect consistency with the existing v2 data layer architecture used by all current tables.