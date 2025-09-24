# User Annotations Offline-First Implementation Plan

This document provides a **comprehensive step-by-step plan** to implement offline-first data handling for the new `user_annotations` table following our existing architecture patterns.

## Overview

The `user_annotations` table will store AI highlights and future user annotations with these types:
- `ai_event_highlight` - AI highlights on specific events
- `ai_time_highlight` - AI highlights on arbitrary time ranges

**Stack**: React + TypeScript + TanStack Query + Dexie (IndexedDB) + Supabase + Factory Pattern

---

## Existing Patterns to Follow

### 1. **Type System Architecture**
- **Server Types**: Raw Supabase types (`ServerUserAnnotationRow`)
- **Client Types**: Normalized timestamps + computed fields (`ClientUserAnnotationRow`)
- **Dexie Types**: Re-exported client types (`UserAnnotation`)

### 2. **Data Layer Structure**
- **Factory Pattern**: Use `createCRUDHooks` from `factory.ts`
- **Domain Hooks**: Export from `domains/users.ts` for consistency
- **Query Keys**: Deterministic keys in `keys.ts`
- **Offline-First**: Dexie write → Supabase sync pattern

### 3. **Query Strategy**
- **Read Path**: Supabase fetch → Dexie store → React Query cache
- **Write Path**: Optimistic Dexie update → Supabase mutation → cache invalidation
- **Cache Management**: TanStack Query with surgical `setQueriesData` updates

---

## Implementation Steps

### Step 1: Add Database Types

**File**: `apps/calendar/src/lib/data/base/server-types.ts`

```typescript
// Add to existing exports
export type ServerUserAnnotationRow = Database['public']['Tables']['user_annotations']['Row'];
export type ServerUserAnnotationInsert = Database['public']['Tables']['user_annotations']['Insert'];
export type ServerUserAnnotationUpdate = Database['public']['Tables']['user_annotations']['Update'];
```

### Step 2: Create Client Types

**File**: `apps/calendar/src/lib/data/base/client-types.ts`

Add to imports:
```typescript
import type {
  // ... existing imports
  ServerUserAnnotationRow
} from './server-types';
```

Add client type (following existing pattern):
```typescript
// User annotation with normalized timestamps + computed fields
export type ClientUserAnnotationRow = Omit<
  ServerUserAnnotationRow,
  'start_time' | 'end_time' | 'created_at' | 'updated_at'
> & {
  start_time: ISODateString;
  end_time: ISODateString;
  created_at: ISODateString;
  updated_at: ISODateString;
  // Pre-computed milliseconds for calendar operations (follow event pattern)
  start_time_ms: Millis;
  end_time_ms: Millis;
};
```

### Step 3: Update Dexie Schema

**File**: `apps/calendar/src/lib/data/base/dexie.ts`

Add to imports:
```typescript
import type {
  // ... existing imports
  ClientUserAnnotationRow
} from './client-types';
```

Add type export:
```typescript
// ... existing exports
export type UserAnnotation = ClientUserAnnotationRow;
```

Add to AppDB class:
```typescript
export class AppDB extends Dexie {
  // ... existing tables
  user_annotations!: Table<UserAnnotation, UUID>;

  constructor() {
    super('calendar-app');
    this.version(7).stores({ // Increment version
      // ... existing stores
      user_annotations: 'id, user_id, type, event_id, [start_time+end_time], visible, updated_at',
    });
  }
}
```

**Index Strategy**:
- `user_id` - Fast per-user queries
- `type` - Filter by annotation type
- `event_id` - Fast event-based lookups
- `[start_time+end_time]` - Compound index for time range queries
- `visible` - Filter visible/hidden annotations
- `updated_at` - Sync ordering

### Step 4: Add Query Keys

**File**: `apps/calendar/src/lib/data/base/keys.ts`

```typescript
export const keys = {
  // ... existing keys

  // User annotations
  annotations: (uid: string) => ['annotations', { uid }] as const,
  annotationsByType: (uid: string, type: 'ai_event_highlight' | 'ai_time_highlight') =>
    ['annotations', { uid, type }] as const,
  annotationsInRange: (uid: string, from: number, to: number) =>
    ['annotations', { uid, from, to }] as const,
} as const;

// Add type helpers
export type AnnotationsKey = ReturnType<typeof keys.annotations>;
export type AnnotationsByTypeKey = ReturnType<typeof keys.annotationsByType>;
```

### Step 5: Create Domain Hooks

**File**: `apps/calendar/src/lib/data/domains/users.ts`

Add to imports:
```typescript
import type {
  // ... existing imports
  UserAnnotation
} from '../base/dexie';
```

Add hooks implementation:
```typescript
// User Annotations (AI highlights and future user notes)
export const userAnnotationHooks = (userId: string | undefined) =>
  createCRUDHooks<UserAnnotation>({
    tableName: 'user_annotations',
    dexieTable: db.user_annotations,
    getQueryKey: () => keys.annotations(userId!),
    userId,
    userIdField: 'user_id',
    select: '*',
    orderBy: [
      { column: 'start_time', ascending: true }, // Chronological order
      { column: 'type', ascending: true },       // Group by type
    ],
    messages: {
      createSuccess: 'Annotation created',
      updateSuccess: 'Annotation updated',
      deleteSuccess: 'Annotation deleted',
      createError: 'Failed to create annotation',
      updateError: 'Failed to update annotation',
      deleteError: 'Failed to delete annotation',
    },
    invalidateQueries: {
      onCreate: () => [
        keys.annotations(userId!),
        keys.events(userId!), // Invalidate events to show new highlights
      ],
      onUpdate: () => [
        keys.annotations(userId!),
        keys.events(userId!),
      ],
      onDelete: () => [
        keys.annotations(userId!),
        keys.events(userId!),
      ],
    },
    // Transform data for client (add computed milliseconds)
    transformData: (data: any): UserAnnotation => ({
      ...data,
      start_time: data.start_time,
      end_time: data.end_time,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      // Pre-compute milliseconds for calendar operations
      start_time_ms: new Date(data.start_time).getTime(),
      end_time_ms: new Date(data.end_time).getTime(),
    }),
  });
```

### Step 6: Export Query Hooks

**File**: `apps/calendar/src/lib/data/queries.ts`

Add to imports:
```typescript
import {
  // ... existing imports
  UserAnnotation
} from './base/dexie';
import {
  // ... existing imports
  userAnnotationHooks
} from './domains/users';
```

Add specialized query hooks:
```typescript
// User Annotations Hook (follows existing pattern)
export function useUserAnnotations(userId: string | undefined) {
  const hooks = userAnnotationHooks(userId);
  return hooks.useQuery();
}

// Annotations by type (for filtering AI vs user annotations)
export function useUserAnnotationsByType(
  userId: string | undefined,
  type: 'ai_event_highlight' | 'ai_time_highlight'
) {
  return useQuery({
    queryKey: keys.annotationsByType(userId!, type),
    queryFn: async (): Promise<UserAnnotation[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_annotations')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Transform and store in Dexie
      const transformed = data.map(annotation => ({
        ...annotation,
        start_time_ms: new Date(annotation.start_time).getTime(),
        end_time_ms: new Date(annotation.end_time).getTime(),
      }));

      await db.user_annotations.bulkPut(transformed);
      return transformed;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Annotations in time range (for calendar view queries)
export function useUserAnnotationsInRange(
  userId: string | undefined,
  startMs: number,
  endMs: number
) {
  return useQuery({
    queryKey: keys.annotationsInRange(userId!, startMs, endMs),
    queryFn: async (): Promise<UserAnnotation[]> => {
      if (!userId) throw new Error('User ID is required');

      const startTime = new Date(startMs).toISOString();
      const endTime = new Date(endMs).toISOString();

      const { data, error } = await supabase
        .from('user_annotations')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startTime)
        .lte('end_time', endTime)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const transformed = data.map(annotation => ({
        ...annotation,
        start_time_ms: new Date(annotation.start_time).getTime(),
        end_time_ms: new Date(annotation.end_time).getTime(),
      }));

      await db.user_annotations.bulkPut(transformed);
      return transformed;
    },
    enabled: !!userId && startMs > 0 && endMs > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes (shorter for time ranges)
  });
}

// Mutation hooks (re-export from domain hooks)
export function useSaveUserAnnotation(userId: string | undefined) {
  const hooks = userAnnotationHooks(userId);
  return hooks.useCreate();
}

export function useUpdateUserAnnotation(userId: string | undefined) {
  const hooks = userAnnotationHooks(userId);
  return hooks.useUpdate();
}

export function useDeleteUserAnnotation(userId: string | undefined) {
  const hooks = userAnnotationHooks(userId);
  return hooks.useDelete();
}

// Bulk delete for clearing AI highlights
export function useBulkDeleteUserAnnotations(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (annotationIds: string[]) => {
      if (!userId) throw new Error('User ID is required');

      // Optimistic Dexie update
      await db.user_annotations.bulkDelete(annotationIds);

      // Server sync
      const { error } = await supabase
        .from('user_annotations')
        .delete()
        .in('id', annotationIds)
        .eq('user_id', userId);

      if (error) throw error;

      return annotationIds;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: keys.annotations(userId!) });
      queryClient.invalidateQueries({ queryKey: keys.events(userId!) });
      toast.success('Annotations deleted');
    },
    onError: (error) => {
      console.error('Error deleting annotations:', error);
      toast.error('Failed to delete annotations');
    },
  });
}
```

---

## Client Tool Integration

### Step 7: Create Client Tools for Agent

**File**: `apps/calendar/src/tools/highlight-events.ts` (update existing)

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '@/lib/data/base/dexie';
import { generateId } from '@/lib/data/base/utils';
import type { UserAnnotation } from '@/lib/data/base/dexie';

export const addAIEventHighlight = createTool({
  id: 'addAIEventHighlight',
  description: 'Add AI highlights to specific events in the calendar',
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe('Array of event IDs to highlight'),
    action: z.enum(['add', 'replace', 'clear']).default('replace').describe('How to apply highlights'),
    title: z.string().optional().describe('Title for the highlight'),
    message: z.string().optional().describe('Description of why this is highlighted'),
    emoji_icon: z.string().optional().describe('Emoji icon for the highlight'),
  }),
  execute: async ({ context }) => {
    const { eventIds, action, title, message, emoji_icon } = context;

    try {
      if (action === 'clear') {
        // Clear all AI event highlights for user
        await db.user_annotations
          .where('type').equals('ai_event_highlight')
          .delete();
        return { success: true, message: 'Cleared all AI event highlights' };
      }

      if (action === 'replace') {
        // Clear existing AI event highlights
        await db.user_annotations
          .where('type').equals('ai_event_highlight')
          .delete();
      }

      // Create annotations for each event
      const annotations: UserAnnotation[] = [];
      for (const eventId of eventIds) {
        // Get event details for start/end times
        const event = await db.events.get(eventId);
        if (!event) continue;

        const annotation: UserAnnotation = {
          id: generateId(),
          user_id: event.owner_id, // Assume current user owns the event
          type: 'ai_event_highlight',
          event_id: eventId,
          start_time: event.start_time,
          end_time: event.end_time,
          start_time_ms: event.start_time_ms,
          end_time_ms: event.end_time_ms,
          title,
          message,
          emoji_icon,
          visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        annotations.push(annotation);
      }

      // Bulk insert to Dexie
      await db.user_annotations.bulkAdd(annotations);

      return {
        success: true,
        highlightedCount: annotations.length,
        message: `AI highlighted ${annotations.length} event${annotations.length !== 1 ? 's' : ''}`,
      };
    } catch (error) {
      console.error('Error adding AI event highlights:', error);
      return { success: false, error: error.message };
    }
  },
});
```

**File**: `apps/calendar/src/tools/highlight-time-ranges.ts` (update existing)

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '@/lib/data/base/dexie';
import { generateId } from '@/lib/data/base/utils';
import type { UserAnnotation } from '@/lib/data/base/dexie';

export const addAITimeHighlight = createTool({
  id: 'addAITimeHighlight',
  description: 'Add AI highlights to specific time ranges on the calendar',
  inputSchema: z.object({
    timeRanges: z.array(z.object({
      start: z.string().describe('ISO timestamp for start'),
      end: z.string().describe('ISO timestamp for end'),
      title: z.string().optional().describe('Title for this time range'),
      message: z.string().optional().describe('Description of this time range'),
      emoji_icon: z.string().optional().describe('Emoji icon for this time range'),
    })).describe('Array of time ranges to highlight'),
    action: z.enum(['add', 'replace', 'clear']).default('replace').describe('How to apply highlights'),
    userId: z.string().describe('User ID for the annotations'),
  }),
  execute: async ({ context }) => {
    const { timeRanges, action, userId } = context;

    try {
      if (action === 'clear') {
        // Clear all AI time highlights for user
        await db.user_annotations
          .where('user_id').equals(userId)
          .and(ann => ann.type === 'ai_time_highlight')
          .delete();
        return { success: true, message: 'Cleared all AI time highlights' };
      }

      if (action === 'replace') {
        // Clear existing AI time highlights for user
        await db.user_annotations
          .where('user_id').equals(userId)
          .and(ann => ann.type === 'ai_time_highlight')
          .delete();
      }

      // Create annotations for each time range
      const annotations: UserAnnotation[] = timeRanges.map(range => ({
        id: generateId(),
        user_id: userId,
        type: 'ai_time_highlight',
        event_id: null,
        start_time: range.start,
        end_time: range.end,
        start_time_ms: new Date(range.start).getTime(),
        end_time_ms: new Date(range.end).getTime(),
        title: range.title,
        message: range.message,
        emoji_icon: range.emoji_icon,
        visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Bulk insert to Dexie
      await db.user_annotations.bulkAdd(annotations);

      return {
        success: true,
        highlightedRanges: annotations.length,
        message: `AI highlighted ${annotations.length} time range${annotations.length !== 1 ? 's' : ''}`,
      };
    } catch (error) {
      console.error('Error adding AI time highlights:', error);
      return { success: false, error: error.message };
    }
  },
});
```

---

## Calendar Integration

### Step 8: Connect to Calendar Component

**File**: `apps/calendar/src/app/calendar/page.tsx`

Update to read annotations and convert to calendar format:

```typescript
// Add to imports
import { useUserAnnotationsInRange } from '@/lib/data/queries';
import { useAppStore } from '@/store/app';

// Inside component, replace the current aiHighlights logic:
const { data: userAnnotations = [] } = useUserAnnotationsInRange(
  user?.id,
  viewRangeStartMs,
  viewRangeEndMs
);

// Convert annotations to TimeHighlight format (replacing aiHighlightedTimeRanges)
const aiHighlights: TimeHighlight[] = useMemo(() => {
  return userAnnotations
    .filter(annotation => annotation.type === 'ai_time_highlight' && annotation.visible)
    .map((annotation, index) => ({
      id: annotation.id,
      startAbs: annotation.start_time_ms,
      endAbs: annotation.end_time_ms,
      intent: annotation.title || annotation.message || '',
    }));
}, [userAnnotations]);

// Convert annotations to event highlights (replacing aiHighlightedEvents)
const aiEventHighlights = useMemo(() => {
  return userAnnotations
    .filter(annotation => annotation.type === 'ai_event_highlight' && annotation.visible)
    .map(annotation => annotation.event_id!)
    .filter(Boolean);
}, [userAnnotations]);
```

---

## Migration Strategy

### Step 9: Data Migration (Optional)

Since we're replacing the old Zustand-based AI highlights, create a migration function:

**File**: `apps/calendar/src/lib/data/migrations/migrate-ai-highlights.ts`

```typescript
import { db } from '../base/dexie';
import { useAppStore } from '@/store/app';
import { generateId } from '../base/utils';

export async function migrateAIHighlights(userId: string) {
  try {
    // Check if already migrated
    const existingAnnotations = await db.user_annotations
      .where('user_id').equals(userId)
      .count();

    if (existingAnnotations > 0) {
      console.log('AI highlights already migrated');
      return;
    }

    // Get current Zustand AI highlights
    const { aiHighlightedEvents, aiHighlightedTimeRanges } = useAppStore.getState();

    const annotations = [];

    // Migrate event highlights
    for (const eventId of Array.from(aiHighlightedEvents)) {
      const event = await db.events.get(eventId);
      if (event) {
        annotations.push({
          id: generateId(),
          user_id: userId,
          type: 'ai_event_highlight' as const,
          event_id: eventId,
          start_time: event.start_time,
          end_time: event.end_time,
          start_time_ms: event.start_time_ms,
          end_time_ms: event.end_time_ms,
          title: 'AI Highlight',
          message: 'Migrated from Zustand store',
          emoji_icon: null,
          visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Migrate time range highlights
    for (const range of aiHighlightedTimeRanges) {
      annotations.push({
        id: generateId(),
        user_id: userId,
        type: 'ai_time_highlight' as const,
        event_id: null,
        start_time: range.start,
        end_time: range.end,
        start_time_ms: new Date(range.start).getTime(),
        end_time_ms: new Date(range.end).getTime(),
        title: 'AI Highlight',
        message: range.description || 'Migrated from Zustand store',
        emoji_icon: null,
        visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (annotations.length > 0) {
      await db.user_annotations.bulkAdd(annotations);
      console.log(`Migrated ${annotations.length} AI highlights to persistent storage`);

      // Clear old Zustand state
      useAppStore.getState().clearAllAiHighlights();
    }
  } catch (error) {
    console.error('Error migrating AI highlights:', error);
  }
}
```

---

## Testing Strategy

### Step 10: Verify Implementation

1. **Database Schema**: Verify `user_annotations` table exists with proper constraints
2. **Dexie Schema**: Check IndexedDB has correct schema and indexes
3. **Hook Integration**: Test CRUD operations work offline and sync online
4. **Agent Tools**: Verify agent can create/modify annotations via client tools
5. **Calendar Display**: Confirm annotations render as highlights
6. **Data Persistence**: Verify highlights survive browser refresh and navigation

### Test Cases:

```typescript
// Test basic CRUD
const { mutate: createAnnotation } = useSaveUserAnnotation(userId);
createAnnotation({
  type: 'ai_time_highlight',
  start_time: '2024-09-24T09:00:00.000Z',
  end_time: '2024-09-24T10:00:00.000Z',
  title: 'Test Highlight',
  message: 'This is a test',
  emoji_icon: '⭐',
});

// Test agent tools
await addAITimeHighlight.execute({
  context: {
    userId: 'user-123',
    timeRanges: [{
      start: '2024-09-24T14:00:00.000Z',
      end: '2024-09-24T15:00:00.000Z',
      title: 'Meeting suggestion',
      emoji_icon: '💡',
    }],
    action: 'add'
  }
});

// Test calendar integration
const annotations = useUserAnnotationsInRange(userId, startMs, endMs);
expect(annotations.data).toHaveLength(2);
```

---

## Success Criteria

✅ **Persistent Storage**: AI highlights survive browser refresh
✅ **Offline-First**: Annotations work without internet connection
✅ **Agent Control**: Agent can add/remove highlights via client tools
✅ **Calendar Integration**: Highlights render properly on calendar
✅ **Performance**: No noticeable performance impact on calendar rendering
✅ **Type Safety**: Full TypeScript support throughout the stack
✅ **Pattern Consistency**: Follows existing patterns for maintainability

This implementation provides a solid foundation for the user annotations system while maintaining consistency with existing offline-first patterns and preparing for future annotation types beyond AI highlights.