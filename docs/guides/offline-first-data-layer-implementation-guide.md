# Offline-First Data Layer Implementation Guide

This guide provides step-by-step instructions for adding new tables to the offline-first data layer and connecting them to the UI. Based on successful implementations of Categories and Calendars.

## Overview

The offline-first data layer uses:
- **Dexie** for local IndexedDB storage (single source of truth)
- **useLiveQuery** hooks for reactive UI updates
- **Outbox pattern** for eventual server sync
- **Real-time subscriptions** for live updates from Supabase
- **Last-write-wins** conflict resolution

## Prerequisites

- Table exists in Supabase migration with RLS policies
- Server and Client types defined in existing data layer
- Mapping function exists in `mapping.ts`
- Validation schema available

## Step-by-Step Implementation

### 1. Add Table to Dexie Schema

**File:** `apps/calendar/src/lib/data-v2/base/dexie.ts`

```typescript
// 1. Import the client type
import type { ClientCategory, ClientCalendar, ClientYourTable } from '../../data/base/client-types';

// 2. Add table to OfflineDB class
export class OfflineDB extends Dexie {
  user_categories!: Table<ClientCategory, string>;
  user_calendars!: Table<ClientCalendar, string>;
  your_table!: Table<ClientYourTable, string>; // Add this line

  // 3. Add to stores configuration with indexes
  this.version(1).stores({
    user_categories: 'id, user_id, updated_at',
    user_calendars: 'id, user_id, updated_at, type, visible',
    your_table: 'id, user_id, updated_at, [any_other_indexes]', // Add this line

    outbox: 'id, user_id, table, op, created_at, attempts',
    meta: 'key'
  });
}
```

**Index Guidelines:**
- Always include: `id, user_id, updated_at`
- Add indexes for frequently queried fields
- Add compound indexes for common filter combinations

### 2. Create Domain File

**File:** `apps/calendar/src/lib/data-v2/domains/your-table.ts`

```typescript
// data-v2/domains/your-table.ts - Offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { YourTableSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable, setupRealtimeSubscription } from '../base/sync';
import { mapYourTableFromServer } from '../../data/base/mapping';
import type { ClientYourTable } from '../../data/base/client-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useYourTables(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientYourTable[]> => {
    if (!uid) return [];
    return await db.your_table.where('user_id').equals(uid).sortBy('name'); // or other sort field
  }, [uid]);
}

export function useYourTable(uid: string | undefined, itemId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientYourTable | undefined> => {
    if (!uid || !itemId) return undefined;
    const item = await db.your_table.get(itemId);
    return (item?.user_id === uid) ? item : undefined;
  }, [uid, itemId]);
}

// Dexie-first mutations with outbox pattern
export async function createYourTable(
  uid: string,
  input: {
    name: string;
    // Add other input fields with proper types
    field?: ClientYourTable['field'];
  }
): Promise<ClientYourTable> {
  const id = generateUUID();
  const now = nowISO();

  const item: ClientYourTable = {
    id,
    user_id: uid,
    name: input.name,
    // Set other fields with defaults
    field: input.field ?? 'default_value',
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedItem = validateBeforeEnqueue(YourTableSchema, item);

  // 2. Write to Dexie first (instant optimistic update)
  await db.your_table.put(validatedItem);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
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
    field?: ClientYourTable['field'];
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
  // if (existing.is_default) {
  //   throw new Error('Cannot delete default item');
  // }

  const now = nowISO();

  // 3. Delete from Dexie first (instant optimistic update)
  await db.your_table.delete(itemId);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'your_table',
    op: 'delete',
    payload: { id: itemId },
    created_at: now,
    attempts: 0,
  });
}

// Data sync functions (called by DataProvider)
export async function pullYourTable(uid: string): Promise<void> {
  return pullTable('your_table', uid, mapYourTableFromServer);
}

export function subscribeToYourTableRealtime(uid: string, onUpdate?: () => void) {
  return setupRealtimeSubscription(
    'your_table',
    uid,
    mapYourTableFromServer,
    onUpdate
  );
}
```

### 3. Add to Index Exports

**File:** `apps/calendar/src/lib/data-v2/index.ts`

```typescript
// Add type export
export type { ClientCategory, ClientCalendar, ClientYourTable } from '../data/base/client-types';

// Add domain exports
// YourTable domain
export {
  useYourTables,
  useYourTable,
  createYourTable,
  updateYourTable,
  deleteYourTable,
  pullYourTable,
  subscribeToYourTableRealtime,
} from './domains/your-table';
```

### 4. Add to DataProvider

**File:** `apps/calendar/src/lib/data-v2/providers/DataProvider.tsx`

```typescript
// 1. Import sync functions
import { pullYourTable, subscribeToYourTableRealtime } from '../domains/your-table';

// 2. Add to initial data pull
async function initializeSync() {
  // Initial data pull
  await pullCategories(user!.id);
  await pullCalendars(user!.id);
  await pullYourTable(user!.id); // Add this line

  // Set up real-time subscriptions
  const categoriesSubscription = subscribeToCategoriesRealtime(user!.id);
  const calendarsSubscription = subscribeToCalendarsRealtime(user!.id);
  const yourTableSubscription = subscribeToYourTableRealtime(user!.id); // Add this line

  subscriptions.push(
    categoriesSubscription,
    calendarsSubscription,
    yourTableSubscription // Add this line
  );
}
```

### 5. Update UI Component

Replace existing TanStack Query hooks with offline-first hooks:

```typescript
// Before (TanStack Query)
import {
  useYourTables,
  useCreateYourTable,
  useUpdateYourTable,
  useDeleteYourTable,
  type ClientYourTable
} from '@/lib/data'

const { data: items = [], isLoading } = useYourTables(user?.id)
const createMutation = useCreateYourTable(user?.id)

// After (Offline-first)
import {
  useYourTables,
  createYourTable,
  updateYourTable,
  deleteYourTable,
  type ClientYourTable
} from '@/lib/data-v2'

const items = useYourTables(user?.id) || []
const isLoading = !items && !!user?.id // Loading if user exists but no data yet

// Replace mutation calls
// Before
await createMutation.mutateAsync({ name: 'test', field: 'value' })

// After
if (!user?.id) return
await createYourTable(user.id, { name: 'test', field: 'value' })
```

**Key Changes in UI Components:**
1. **Hook returns**: Direct arrays instead of `{ data, isLoading }`
2. **Loading state**: Calculate from data availability
3. **Mutations**: Direct function calls instead of mutation objects
4. **Error handling**: Use try/catch blocks
5. **User ID checks**: Always validate `user?.id` before mutations

## Common Patterns & Best Practices

### Input Type Definitions
```typescript
// Use proper types from the client interface
input: {
  name: string;
  color?: ClientYourTable['color']; // Use interface property types
  type?: ClientYourTable['type'];
  visible?: boolean;
}
```

### Error Handling
```typescript
const handleCreate = async () => {
  if (!newItemName.trim() || !user?.id) return

  try {
    await createYourTable(user.id, {
      name: newItemName.trim(),
      field: selectedValue,
    })
    setNewItemName('')
    setSelectedValue('default')
  } catch (error) {
    console.error('Failed to create item:', error)
    // TODO: Show toast error
  }
}
```

### Business Logic Validation
```typescript
// In delete function
if (existing.is_default || existing.type === 'system') {
  throw new Error('Cannot delete system items');
}

// In update function
if (input.type === 'archive' && existing.type === 'default') {
  throw new Error('Cannot change default items to archive');
}
```

### Index Optimization
```typescript
// For complex queries, add compound indexes
this.version(1).stores({
  your_table: 'id, user_id, updated_at, type, [user_id+type], [user_id+visible]'
});

// Then use in queries
return await db.your_table
  .where('[user_id+type]')
  .equals([uid, 'active'])
  .sortBy('name');
```

## Validation Schema Requirements

Make sure your validation schema exists in `validators.ts`:

```typescript
export const YourTableSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(120),
  field: z.enum(['value1', 'value2']).nullable(),
  type: z.enum(['default', 'user', 'archive']),
  visible: z.boolean(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});
```

## Testing Checklist

After implementation, verify:

- [ ] **Initial sync**: Data loads on first app open
- [ ] **Real-time updates**: Changes from other sessions appear immediately
- [ ] **Offline creation**: New items work without internet
- [ ] **Offline updates**: Edits work without internet
- [ ] **Offline deletion**: Deletes work without internet
- [ ] **Sync on reconnect**: Offline changes sync when internet returns
- [ ] **Conflict resolution**: Duplicate key errors handled gracefully
- [ ] **UI reactivity**: Changes appear instantly in UI
- [ ] **Loading states**: Proper loading indicators
- [ ] **Error handling**: Graceful error messages

## Troubleshooting

### Common Issues

1. **"object is not a function" in pullTable**
   - Check parameter order: `pullTable(table, userId, mapFromServer)`
   - Verify mapping function import

2. **TypeScript errors with input types**
   - Use `ClientYourTable['field']` for proper enum types
   - Check that validation schema matches client interface

3. **Data not syncing**
   - Verify table added to DataProvider
   - Check RLS policies in Supabase
   - Ensure mapping function exists

4. **Duplicate key errors**
   - Already handled in sync error handling
   - Check that table has proper unique constraints

5. **Real-time not working**
   - Verify WebSocket connection (hostname vs IP issues)
   - Check that subscription is added to DataProvider

## Migration Strategy

When migrating existing components:

1. **Parallel Implementation**: Create new domain alongside existing
2. **Component Testing**: Update one component at a time
3. **Gradual Migration**: Use feature flags if needed
4. **Data Consistency**: Ensure both systems work during transition
5. **Full Cutover**: Remove old hooks after testing

## Performance Considerations

- **Index Strategy**: Add indexes for common query patterns
- **Batch Operations**: Use `bulkPut` for large datasets
- **Query Optimization**: Use compound indexes for complex filters
- **Memory Usage**: Consider pagination for very large datasets

## Security Notes

- **RLS Policies**: Ensure proper row-level security in Supabase
- **Input Validation**: Always validate before enqueue
- **User Isolation**: Verify `user_id` matches in all operations
- **Access Control**: Check ownership before mutations

This guide provides the complete pattern for implementing offline-first data layers based on our successful Categories and Calendars implementations.