# Offline-First Calendar Events Plan (Complex Multi-Table Events with Realtime)

This document provides a **comprehensive step-by-step plan** to integrate offline-first data handling for the complex calendar events system which involves:

- `events` (core event data)
- `event_details_personal` (user-specific event settings)
- `event_user_roles` (user roles and RSVP data)
- `user_categories` (user's custom categories)
- `user_calendars` (user's calendars)

The approach: **Database View + Dexie + TanStack Query + Supabase Realtime** for flattened, efficient offline-first calendar events.

---

## Goals

1. **Instant Loading**: Calendar events render immediately from Dexie with no loading spinners
2. **Intelligent Caching**: Keep only relevant events (last 30 days + next 90 days = 120 days total)
3. **Complex Query Simplification**: Replace multi-table joins with single flattened view query
4. **Real-time Updates**: AI agent changes and multi-user updates appear instantly via Realtime
5. **Offline Resilience**: Calendar works when disconnected with relevant event data
6. **On-Demand Loading**: Historical/far-future events loaded only when needed
7. **Type Consolidation**: Single `CalendarEvent` type replaces duplicate `CalEvent` interface
8. **Performance**: Eliminate redundant complex queries and reduce network requests
9. **MCP Tool Compatibility**: Solve cache invalidation issues with agent tool changes

---

## File Layout

```
/supabase/migrations/20250923000000_calendar_events_view.sql   // Flattened DB view
/src/lib/db/dexie.ts                                           // Updated with CalendarEvent table
/src/lib/data/queries.ts                                       // New useCalendarEvents hook
/src/lib/data/mutations.ts                                     // Event CRUD with optimistic updates
/src/lib/realtime/subscriptions.ts                            // Updated with events subscriptions
/src/components/types.ts                                       // Remove CalEvent, use CalendarEvent
/src/hooks/use-calendar-events.ts                             // Legacy (to be replaced)
```

---

## Architecture Overview

### Current Problem:
- Complex multi-table query with joins in `useCalendarEvents`
- Separate `CalEvent` type that duplicates data structure
- No offline support for calendar events
- Cache invalidation issues with MCP tools
- Performance issues with complex queries on every render

### Proposed Solution:
1. **Database View**: Create `calendar_events_view` that flattens all joins server-side
2. **Type Consolidation**: Use single `CalendarEvent` type from Dexie throughout
3. **Offline-First**: Store flattened events in Dexie for instant loading
4. **Realtime Sync**: Subscribe to all related tables, update Dexie automatically
5. **Optimistic Updates**: Event CRUD operations update Dexie immediately

---

## Phase 1: Database Schema - Flattened View Approach

### 1.1 Create Calendar Events View

**File**: `/supabase/migrations/20250923000000_calendar_events_view.sql`

Create a materialized view that does all the complex joining on the database side:

```sql
-- Create comprehensive view that flattens all calendar event data
CREATE OR REPLACE VIEW calendar_events_view AS
SELECT
  -- Core event fields
  e.id, e.owner_id, e.creator_id, e.series_id, e.title, e.agenda,
  e.online_event, e.online_join_link, e.online_chat_link, e.in_person,
  e.start_time, e.duration, e.all_day, e.private, e.request_responses,
  e.allow_forwarding, e.invite_allow_reschedule_proposals, e.hide_attendees,
  e.history, e.discovery, e.join_model, e.created_at, e.updated_at,

  -- User perspective fields (from current user)
  COALESCE(eur.user_id, edp.user_id) as viewing_user_id,

  -- User role information
  CASE
    WHEN e.owner_id = COALESCE(eur.user_id, edp.user_id) THEN 'owner'::user_role
    ELSE COALESCE(eur.role, 'viewer'::user_role)
  END as user_role,
  eur.invite_type, eur.rsvp, eur.rsvp_timestamp, eur.attendance_type,
  COALESCE(eur.following, false) as following,

  -- User personal details
  edp.calendar_id, uc.name as calendar_name, uc.color as calendar_color,
  COALESCE(edp.show_time_as, 'busy'::show_time_as_extended) as show_time_as,
  edp.category_id, ucat.name as category_name, ucat.color as category_color,
  COALESCE(edp.time_defense_level, 'normal'::time_defense_level) as time_defense_level,
  COALESCE(edp.ai_managed, false) as ai_managed, edp.ai_instructions,

  -- Computed fields for efficient client queries
  e.start_time as start_time_iso,
  EXTRACT(EPOCH FROM e.start_time) * 1000 as start_timestamp_ms,
  EXTRACT(EPOCH FROM e.start_time + INTERVAL '1 minute' * e.duration) * 1000 as end_timestamp_ms,
  false as ai_suggested

FROM events e
LEFT JOIN event_user_roles eur ON e.id = eur.event_id
LEFT JOIN event_details_personal edp ON e.id = edp.event_id
  AND (eur.user_id IS NULL OR edp.user_id = eur.user_id)
LEFT JOIN user_calendars uc ON edp.calendar_id = uc.id
LEFT JOIN user_categories ucat ON edp.category_id = ucat.id

WHERE
  e.owner_id = COALESCE(eur.user_id, edp.user_id) OR
  e.creator_id = COALESCE(eur.user_id, edp.user_id) OR
  eur.user_id IS NOT NULL OR
  edp.user_id IS NOT NULL;

-- RLS policy: Users can only see their own calendar events
CREATE POLICY "Users can view their calendar events"
  ON calendar_events_view FOR SELECT
  USING (viewing_user_id = auth.uid());

-- Create indexes for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_view_user_time
  ON events USING btree (owner_id, start_time);
```

### 1.2 Update Dexie Schema

**File**: `/src/lib/db/dexie.ts`

Add CalendarEvent table with proper indexing for date range queries:

```typescript
// Calendar Events from the flattened view
export interface CalendarEvent {
  // Core event fields
  id: string;
  owner_id: string;
  creator_id: string;
  series_id?: string;
  title: string;
  agenda?: string;
  online_event: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person: boolean;
  start_time: string; // ISO timestamp
  duration: number; // minutes
  all_day: boolean;
  private: boolean;
  request_responses: boolean;
  allow_forwarding: boolean;
  invite_allow_reschedule_proposals: boolean;
  hide_attendees: boolean;
  history: unknown[]; // JSON array
  discovery: string;
  join_model: string;
  created_at: string;
  updated_at: string;

  // User perspective fields
  viewing_user_id: string;

  // User role information
  user_role: string;
  invite_type?: string;
  rsvp?: string;
  rsvp_timestamp?: string;
  attendance_type?: string;
  following: boolean;

  // User personal details
  calendar_id?: string;
  calendar_name?: string;
  calendar_color?: string;
  show_time_as: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  time_defense_level: string;
  ai_managed: boolean;
  ai_instructions?: string;

  // Computed fields for calendar rendering
  start_time_iso: string;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  ai_suggested: boolean;
}

export class AppDB extends Dexie {
  // ... existing tables
  calendar_events!: Table<CalendarEvent, string>;

  constructor() {
    super('calendar-app');
    this.version(2).stores({ // Increment version for schema change
      // ... existing stores
      // Indexes for efficient date range and user queries
      calendar_events: 'id, viewing_user_id, start_timestamp_ms, end_timestamp_ms, owner_id, calendar_id, category_id, updated_at',
    });
  }
}
```

---

## Phase 2: Query Layer - Offline-First Calendar Events

### 2.1 Create Offline-First Calendar Events Hook

**File**: `/src/lib/data/queries.ts` (add to existing file)

```typescript
import { startOfDay, endOfDay } from 'date-fns';

// Transform view data to CalendarEvent (with validation)
const cleanCalendarEvent = (data: any): CalendarEvent => {
  return {
    ...data,
    // Ensure computed fields are present
    start_timestamp_ms: data.start_timestamp_ms || new Date(data.start_time).getTime(),
    end_timestamp_ms: data.end_timestamp_ms || (new Date(data.start_time).getTime() + (data.duration * 60 * 1000)),
    // Ensure defaults for nullable fields
    following: data.following || false,
    ai_managed: data.ai_managed || false,
    ai_suggested: data.ai_suggested || false,
    show_time_as: data.show_time_as || 'busy',
    time_defense_level: data.time_defense_level || 'normal',
    user_role: data.user_role || 'viewer',
    history: data.history || [],
  };
};

// Calendar Events Hook - replaces complex useCalendarEvents
export function useCalendarEvents({
  userId,
  startDate,
  endDate,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
}: {
  userId: string | undefined;
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
  staleTime?: number;
}) {
  return useQuery({
    queryKey: [
      'calendar-events',
      userId,
      startOfDay(startDate).toISOString(),
      endOfDay(endDate).toISOString(),
    ],
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!userId) throw new Error('User ID is required');

      // Query the flattened view (much simpler than current complex joins)
      const { data, error } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('viewing_user_id', userId)
        .gte('start_time', startOfDay(startDate).toISOString())
        .lte('start_time', endOfDay(endDate).toISOString())
        .order('start_time');

      if (error) throw error;

      // Clean and validate data
      const cleanedEvents = (data || []).map(cleanCalendarEvent);

      // Store in Dexie for offline access using efficient bulk operation
      if (cleanedEvents.length > 0) {
        await db.calendar_events.bulkPut(cleanedEvents);
      }

      return cleanedEvents;
    },

    // Offline-first: Load from Dexie immediately for instant rendering
    initialData: async () => {
      if (!userId) return [];

      const startMs = startOfDay(startDate).getTime();
      const endMs = endOfDay(endDate).getTime();

      // Efficient date range query using indexed timestamps
      const cachedEvents = await db.calendar_events
        .where('viewing_user_id').equals(userId)
        .and(event =>
          event.start_timestamp_ms >= startMs &&
          event.start_timestamp_ms <= endMs
        )
        .toArray();

      return cachedEvents;
    },

    enabled: enabled && !!userId,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Utility function to invalidate calendar events for date ranges
export function useInvalidateCalendarEvents() {
  const queryClient = useQueryClient();

  return (userId?: string, startDate?: Date, endDate?: Date) => {
    if (startDate && endDate && userId) {
      // Invalidate specific date range
      queryClient.invalidateQueries({
        queryKey: [
          'calendar-events',
          userId,
          startOfDay(startDate).toISOString(),
          endOfDay(endDate).toISOString(),
        ],
      });
    } else {
      // Invalidate all calendar events for this user
      queryClient.invalidateQueries({
        queryKey: ['calendar-events', userId],
      });
    }
  };
}
```

### 2.2 Create Calendar Event Mutations

**File**: `/src/lib/data/mutations.ts` (add to existing file)

```typescript
// Calendar Event Mutations with Optimistic Updates

export interface CreateEventData {
  title: string;
  start_time: string;
  duration: number;
  all_day?: boolean;
  calendar_id?: string;
  category_id?: string;
  // ... other event fields
}

export interface UpdateEventData {
  id: string;
  title?: string;
  start_time?: string;
  duration?: number;
  // ... other updatable fields
}

// Create Calendar Event
export function useCreateCalendarEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEventData): Promise<CalendarEvent> => {
      if (!userId) throw new Error('User ID is required');

      // Create in events table (view will handle the joins)
      const { data: eventResult, error } = await supabase
        .from('events')
        .insert({
          owner_id: userId,
          creator_id: userId,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;

      // Create personal details if calendar_id or category_id provided
      if (data.calendar_id || data.category_id) {
        await supabase
          .from('event_details_personal')
          .insert({
            event_id: eventResult.id,
            user_id: userId,
            calendar_id: data.calendar_id,
            category_id: data.category_id,
          });
      }

      // Fetch the complete event from the view
      const { data: viewResult, error: viewError } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', eventResult.id)
        .eq('viewing_user_id', userId)
        .single();

      if (viewError) throw viewError;

      const cleanedEvent = cleanCalendarEvent(viewResult);

      // Store in Dexie
      await db.calendar_events.put(cleanedEvent);

      return cleanedEvent;
    },
    onSuccess: () => {
      // Invalidate all calendar events queries for this user
      queryClient.invalidateQueries({ queryKey: ['calendar-events', userId] });
    },
    onError: (error: any) => {
      console.error('Error creating calendar event:', error);
      toast.error('Failed to create event');
    },
  });
}

// Update Calendar Event
export function useUpdateCalendarEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateEventData): Promise<CalendarEvent> => {
      if (!userId) throw new Error('User ID is required');

      // Optimistic update to Dexie
      const current = await db.calendar_events.get(data.id);
      if (current) {
        const optimisticUpdate = {
          ...current,
          ...data,
          updated_at: new Date().toISOString()
        };
        await db.calendar_events.put(optimisticUpdate);
      }

      // Update events table
      const { data: eventResult, error } = await supabase
        .from('events')
        .update(data)
        .eq('id', data.id)
        .eq('owner_id', userId) // Security: only owner can update
        .select()
        .single();

      if (error) {
        // Rollback optimistic update
        if (current) {
          await db.calendar_events.put(current);
        }
        throw error;
      }

      // Fetch updated event from view
      const { data: viewResult, error: viewError } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', data.id)
        .eq('viewing_user_id', userId)
        .single();

      if (viewError) throw viewError;

      const cleanedEvent = cleanCalendarEvent(viewResult);

      // Store canonical result in Dexie
      await db.calendar_events.put(cleanedEvent);

      return cleanedEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events', userId] });
    },
    onError: (error: any) => {
      console.error('Error updating calendar event:', error);
      toast.error('Failed to update event');
    },
  });
}

// Delete Calendar Event
export function useDeleteCalendarEvent(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string): Promise<void> => {
      if (!userId) throw new Error('User ID is required');

      // Optimistic delete from Dexie
      const deletedEvent = await db.calendar_events.get(eventId);
      await db.calendar_events.delete(eventId);

      try {
        // Delete from server (cascades to related tables)
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
          .eq('owner_id', userId); // Security: only owner can delete

        if (error) throw error;
      } catch (error) {
        // Rollback optimistic delete
        if (deletedEvent) {
          await db.calendar_events.put(deletedEvent);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events', userId] });
    },
    onError: (error: any) => {
      console.error('Error deleting calendar event:', error);
      toast.error('Failed to delete event');
    },
  });
}
```

---

## Phase 3: Real-time Integration

### 3.1 Update Realtime Subscriptions (with Cache Window Awareness)

**File**: `/src/lib/realtime/subscriptions.ts` (update existing)

```typescript
// Add calendar events realtime subscriptions to existing function
export function startRealtime(userId: string, queryClient: QueryClient) {
  const ch = supabase.channel('rt:user-data');

  const inv = (key: string[]) => queryClient.invalidateQueries({ queryKey: key });

  // Helper to check if event is within our cache window
  const isEventInCacheWindow = (eventStartTime: string): boolean => {
    const { startDate, endDate } = getCurrentCacheWindow();
    const eventDate = new Date(eventStartTime);
    return eventDate >= startDate && eventDate <= endDate;
  };

  // ... existing subscriptions for profiles, categories, calendars

  // Events table changes
  ch.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'events',
      filter: `owner_id=eq.${userId}`
    },
    async ({ eventType, old, new: n }) => {
      const eventStartTime = eventType === 'DELETE' ? old.start_time : n.start_time;

      if (eventType === 'DELETE') {
        // Always remove from cache regardless of window
        await db.calendar_events.delete(old.id);
        inv(['calendar-events', userId]);
        return;
      }

      // Only sync events within our cache window
      if (!isEventInCacheWindow(eventStartTime)) {
        console.log('Event outside cache window, skipping realtime sync:', n.id);
        // Still invalidate queries in case user is viewing this time period
        inv(['calendar-events', userId]);
        return;
      }

      // Fetch updated event from view to get all joined data
      const { data: viewData, error } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', n.id)
        .eq('viewing_user_id', userId)
        .single();

      if (!error && viewData) {
        const cleanedEvent = cleanCalendarEvent(viewData);
        await db.calendar_events.put(cleanedEvent);
      }

      inv(['calendar-events', userId]);
    }
  );

  // Event personal details changes
  ch.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_details_personal',
      filter: `user_id=eq.${userId}`
    },
    async ({ eventType, old, new: n }) => {
      const eventId = eventType === 'DELETE' ? old.event_id : n.event_id;

      // For personal details changes, we need to check if the event is in cache
      const existingEvent = await db.calendar_events.get(eventId);

      if (eventType === 'DELETE') {
        if (existingEvent) {
          await db.calendar_events.delete(eventId);
        }
        inv(['calendar-events', userId]);
        return;
      }

      // Only sync if event is in our cache window or already cached
      const shouldSync = existingEvent || (
        await supabase
          .from('events')
          .select('start_time')
          .eq('id', eventId)
          .single()
          .then(({ data, error }) =>
            !error && data && isEventInCacheWindow(data.start_time)
          )
      );

      if (!shouldSync) {
        inv(['calendar-events', userId]);
        return;
      }

      // Fetch updated event from view
      const { data: viewData, error } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', eventId)
        .eq('viewing_user_id', userId)
        .single();

      if (!error && viewData) {
        const cleanedEvent = cleanCalendarEvent(viewData);
        await db.calendar_events.put(cleanedEvent);
      } else if (eventType === 'DELETE' || error) {
        await db.calendar_events.delete(eventId);
      }

      inv(['calendar-events', userId]);
    }
  );

  // Event user roles changes (for invited events)
  ch.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_user_roles',
      filter: `user_id=eq.${userId}`
    },
    async ({ eventType, old, new: n }) => {
      const eventId = eventType === 'DELETE' ? old.event_id : n.event_id;

      // Similar logic to personal details
      const existingEvent = await db.calendar_events.get(eventId);

      if (eventType === 'DELETE') {
        if (existingEvent) {
          await db.calendar_events.delete(eventId);
        }
        inv(['calendar-events', userId]);
        return;
      }

      // Check if we should sync this event
      const shouldSync = existingEvent || (
        await supabase
          .from('events')
          .select('start_time')
          .eq('id', eventId)
          .single()
          .then(({ data, error }) =>
            !error && data && isEventInCacheWindow(data.start_time)
          )
      );

      if (!shouldSync) {
        inv(['calendar-events', userId]);
        return;
      }

      // Fetch updated event from view
      const { data: viewData, error } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', eventId)
        .eq('viewing_user_id', userId)
        .single();

      if (!error && viewData) {
        const cleanedEvent = cleanCalendarEvent(viewData);
        await db.calendar_events.put(cleanedEvent);
      } else if (error) {
        await db.calendar_events.delete(eventId);
      }

      inv(['calendar-events', userId]);
    }
  );

  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}

// Enhanced user data clearing for calendar events
export async function clearUserData(userId: string) {
  try {
    // Clear existing user data
    await db.user_profiles.where('id').equals(userId).delete();
    await db.user_categories.where('user_id').equals(userId).delete();
    await db.user_calendars.where('user_id').equals(userId).delete();

    // Clear calendar events for this user
    await db.calendar_events.where('viewing_user_id').equals(userId).delete();

    console.log('Cleared user data for:', userId);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}
```

---

## Phase 4: Type Consolidation & Component Migration

### 4.1 Remove CalEvent Type, Use CalendarEvent Everywhere

**File**: `/src/components/types.ts`

```typescript
// Remove the entire CalEvent interface - replace with import
export type { CalendarEvent } from '@/lib/db/dexie';

// Keep other types but update references
export interface CalendarDayRangeProps {
  // ... existing props
  events?: CalendarEvent[]; // Changed from CalEvent[]
  onEventsChange?: (next: CalendarEvent[]) => void; // Changed from CalEvent[]
  onUpdateEvents?: (ids: EventId[], updates: Partial<CalendarEvent>) => void; // Changed
  // ... rest unchanged
}

// Update CalendarContext to use CalendarEvent
export interface CalendarContext {
  // ... existing fields
  selectedEvents: {
    events: CalendarEvent[] // Changed from CalEvent[]
    description: string
    summary: string
  }
  // ... rest unchanged
}
```

### 4.2 Update Calendar Page to Use New Hook

**File**: `/src/app/calendar/page.tsx`

```typescript
// Replace existing import
import { useCalendarEvents } from '@/lib/data/queries'; // New location
import type { CalendarEvent } from '@/lib/db/dexie'; // Use consolidated type

// Update component
export default function CalendarPage() {
  // ... existing state

  // Replace existing useCalendarEvents call
  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError
  } = useCalendarEvents({
    userId: user?.id,
    startDate: addDays(currentWeekStart, -7), // Load extra for smooth scrolling
    endDate: addDays(currentWeekStart, 14),
    staleTime: 2 * 60 * 1000, // 2 minutes for calendar data
  });

  // ... rest of component unchanged - events is now CalendarEvent[]
}
```

### 4.3 Update Event Components

**Files**: Event components that use CalEvent

```typescript
// Update imports in all event-related components
import type { CalendarEvent } from '@/lib/db/dexie';

// Replace CalEvent with CalendarEvent in:
// - EventCard component props
// - EventCardContent component props
// - DayColumn component props
// - Any other components using events

// The component logic stays the same, just type names change
export interface EventCardProps {
  event: CalendarEvent; // Changed from CalEvent
  // ... rest unchanged
}
```

---

## Phase 5: Performance Optimizations

### 5.1 Intelligent Date Range Management

**Strategy**: Keep only relevant events in Dexie (last 30 days + next 90 days = 120 days total) and load additional events on-demand.

```typescript
// Date range constants for efficient client-side storage
const PAST_DAYS_TO_KEEP = 30;   // Last 30 days
const FUTURE_DAYS_TO_KEEP = 90; // Next 90 days
const TOTAL_CACHE_WINDOW = 120; // Total days to keep locally

// Get the current cache window
export function getCurrentCacheWindow() {
  const now = new Date();
  const startDate = addDays(now, -PAST_DAYS_TO_KEEP);
  const endDate = addDays(now, FUTURE_DAYS_TO_KEEP);
  return { startDate, endDate };
}

// Enhanced useCalendarEvents with intelligent range management
export function useCalendarEvents({
  userId,
  startDate,
  endDate,
  enabled = true,
  staleTime = 5 * 60 * 1000,
}: {
  userId: string | undefined;
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
  staleTime?: number;
}) {
  const { startDate: cacheStart, endDate: cacheEnd } = getCurrentCacheWindow();

  // Determine if requested range is outside our cache window
  const isOutsideCacheWindow =
    startDate < cacheStart || endDate > cacheEnd;

  return useQuery({
    queryKey: [
      'calendar-events',
      userId,
      startOfDay(startDate).toISOString(),
      endOfDay(endDate).toISOString(),
    ],
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!userId) throw new Error('User ID is required');

      // If outside cache window, fetch directly without caching
      if (isOutsideCacheWindow) {
        console.log('Fetching events outside cache window:', { startDate, endDate });

        const { data, error } = await supabase
          .from('calendar_events_view')
          .select('*')
          .eq('viewing_user_id', userId)
          .gte('start_time', startOfDay(startDate).toISOString())
          .lte('start_time', endOfDay(endDate).toISOString())
          .order('start_time');

        if (error) throw error;

        // Don't store in Dexie - just return for this query
        return (data || []).map(cleanCalendarEvent);
      }

      // For cache window requests, fetch the entire cache window
      // This ensures we have a consistent 120-day sliding window
      const { data, error } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('viewing_user_id', userId)
        .gte('start_time', startOfDay(cacheStart).toISOString())
        .lte('start_time', endOfDay(cacheEnd).toISOString())
        .order('start_time');

      if (error) throw error;

      const cleanedEvents = (data || []).map(cleanCalendarEvent);

      // Replace entire cache window in Dexie (atomic operation)
      await db.transaction('rw', db.calendar_events, async () => {
        // Clear existing events for this user
        await db.calendar_events
          .where('viewing_user_id')
          .equals(userId)
          .delete();

        // Store new cache window
        if (cleanedEvents.length > 0) {
          await db.calendar_events.bulkPut(cleanedEvents);
        }
      });

      // Return only the requested subset
      const requestedStartMs = startOfDay(startDate).getTime();
      const requestedEndMs = endOfDay(endDate).getTime();

      return cleanedEvents.filter(event =>
        event.start_timestamp_ms >= requestedStartMs &&
        event.start_timestamp_ms <= requestedEndMs
      );
    },

    // Offline-first: Load from Dexie immediately for cache window
    initialData: async () => {
      if (!userId) return [];

      // If outside cache window, no initial data (will show loading)
      if (isOutsideCacheWindow) {
        return undefined; // Force loading state
      }

      const requestedStartMs = startOfDay(startDate).getTime();
      const requestedEndMs = endOfDay(endDate).getTime();

      // Load from Dexie for cache window requests
      const cachedEvents = await db.calendar_events
        .where('viewing_user_id').equals(userId)
        .and(event =>
          event.start_timestamp_ms >= requestedStartMs &&
          event.start_timestamp_ms <= requestedEndMs
        )
        .toArray();

      return cachedEvents;
    },

    enabled: enabled && !!userId,
    staleTime: isOutsideCacheWindow ? 0 : staleTime, // No stale time for historical data
    gcTime: isOutsideCacheWindow ? 1000 : 10 * 60 * 1000, // Quick GC for historical data
  });
}

// Background cache window maintenance
export function useCacheWindowMaintenance(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Run maintenance every hour to keep cache window current
    const interval = setInterval(async () => {
      const { startDate, endDate } = getCurrentCacheWindow();

      // Check if we need to update the cache window
      const oldestCached = await db.calendar_events
        .where('viewing_user_id').equals(userId)
        .orderBy('start_timestamp_ms')
        .first();

      const newestCached = await db.calendar_events
        .where('viewing_user_id').equals(userId)
        .orderBy('start_timestamp_ms')
        .reverse()
        .first();

      if (oldestCached && newestCached) {
        const cacheStartMs = startOfDay(startDate).getTime();
        const cacheEndMs = endOfDay(endDate).getTime();

        // If cache window has shifted significantly, refresh
        if (
          oldestCached.start_timestamp_ms < cacheStartMs - (7 * 24 * 60 * 60 * 1000) || // 7 days old
          newestCached.start_timestamp_ms < cacheEndMs - (7 * 24 * 60 * 60 * 1000)
        ) {
          console.log('Cache window maintenance: refreshing events');

          // Invalidate current cache window to trigger refresh
          queryClient.invalidateQueries({
            queryKey: ['calendar-events', userId],
            predicate: (query) => {
              const [, , startDateStr] = query.queryKey;
              if (typeof startDateStr === 'string') {
                const queryStart = new Date(startDateStr);
                return queryStart >= startDate && queryStart <= endDate;
              }
              return false;
            }
          });
        }
      }
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, [userId, queryClient]);
}
```

### 5.2 Background Sync Strategy

```typescript
// Add background sync for recently viewed date ranges
export function useBackgroundEventSync(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Sync events in background for next/previous weeks
    const now = new Date();
    const ranges = [
      { start: addDays(now, -21), end: addDays(now, -7) }, // Previous 2 weeks
      { start: addDays(now, 7), end: addDays(now, 21) },   // Next 2 weeks
    ];

    ranges.forEach(({ start, end }) => {
      queryClient.prefetchQuery({
        queryKey: [
          'calendar-events',
          userId,
          startOfDay(start).toISOString(),
          endOfDay(end).toISOString(),
        ],
        queryFn: () => fetchCalendarEvents(userId, start, end),
        staleTime: 10 * 60 * 1000, // 10 minutes for background sync
      });
    });
  }, [userId, queryClient]);
}
```

---

## Phase 6: Testing & Validation

### 6.1 Database View Testing

```sql
-- Test the view returns correct data
SELECT COUNT(*) FROM calendar_events_view WHERE viewing_user_id = 'test-user-id';

-- Test date range filtering
SELECT * FROM calendar_events_view
WHERE viewing_user_id = 'test-user-id'
AND start_time >= '2025-01-01'
AND start_time <= '2025-01-31';

-- Test join correctness
SELECT
  id, title, user_role, calendar_name, category_name
FROM calendar_events_view
WHERE viewing_user_id = 'test-user-id'
LIMIT 5;
```

### 6.2 Offline Functionality Testing

```typescript
// Test offline event loading
const testOfflineEvents = async () => {
  // 1. Load events online
  const events = await fetchCalendarEvents(userId, startDate, endDate);

  // 2. Go offline
  // 3. Clear React Query cache
  queryClient.clear();

  // 4. Verify events still load from Dexie
  const cachedEvents = await db.calendar_events
    .where('viewing_user_id').equals(userId)
    .toArray();

  expect(cachedEvents.length).toBeGreaterThan(0);
};
```

### 6.3 Real-time Sync Testing

```typescript
// Test real-time updates
const testRealtimeSync = async () => {
  // 1. Create event via mutation
  const newEvent = await createEventMutation.mutateAsync(eventData);

  // 2. Verify it appears in Dexie
  const cachedEvent = await db.calendar_events.get(newEvent.id);
  expect(cachedEvent).toBeDefined();

  // 3. Update via different client/MCP tool
  // 4. Verify realtime update appears in Dexie
  await waitFor(() => {
    const updatedEvent = db.calendar_events.get(newEvent.id);
    expect(updatedEvent.title).toBe(updatedTitle);
  });
};
```

---

## Implementation Checklist

### Phase 1: Database ✅
- [ ] **1.1** Apply database migration for `calendar_events_view`
- [ ] **1.2** Test view returns correct data for sample user
- [ ] **1.3** Verify RLS policies work correctly
- [ ] **1.4** Test view performance with large datasets

### Phase 2: Schema & Types ✅
- [ ] **2.1** Update Dexie schema with `calendar_events` table
- [ ] **2.2** Increment Dexie version for schema changes
- [ ] **2.3** Add `CalendarEvent` interface with all required fields
- [ ] **2.4** Test Dexie operations with new schema

### Phase 3: Query Layer ✅
- [ ] **3.1** Implement `useCalendarEvents` hook with offline-first pattern
- [ ] **3.2** Add data cleaning and validation functions
- [ ] **3.3** Implement efficient date range querying from Dexie
- [ ] **3.4** Add query invalidation utilities

### Phase 4: Mutations ✅
- [ ] **4.1** Implement `useCreateCalendarEvent` with optimistic updates
- [ ] **4.2** Implement `useUpdateCalendarEvent` with rollback
- [ ] **4.3** Implement `useDeleteCalendarEvent` with optimistic deletes
- [ ] **4.4** Add comprehensive error handling and recovery

### Phase 5: Real-time ✅
- [ ] **5.1** Add calendar events subscriptions to realtime manager
- [ ] **5.2** Handle complex multi-table sync via view queries
- [ ] **5.3** Update user data clearing for calendar events
- [ ] **5.4** Test real-time sync across multiple tables

### Phase 6: Component Migration ✅
- [ ] **6.1** Remove `CalEvent` type, replace with `CalendarEvent`
- [ ] **6.2** Update all component imports and type references
- [ ] **6.3** Migrate calendar page to use new hook
- [ ] **6.4** Update event components to use consolidated type

### Phase 7: Testing & Optimization ✅
- [ ] **7.1** Verify offline functionality works correctly
- [ ] **7.2** Test real-time updates from MCP tools
- [ ] **7.3** Performance test with large event datasets
- [ ] **7.4** Validate data consistency across all sync paths

---

## Success Metrics

### Performance Improvements:
- [ ] **Instant Loading**: Calendar events render in <100ms from Dexie
- [ ] **Reduced Network**: 80% fewer redundant event queries
- [ ] **Simplified Queries**: Single view query replaces complex joins
- [ ] **Background Sync**: Non-blocking real-time updates

### Storage Optimization:
- [ ] **Intelligent Caching**: Only 120 days of events stored locally (vs unlimited)
- [ ] **Sliding Window**: Automatic cache window maintenance
- [ ] **On-Demand Loading**: Historical events loaded only when viewed
- [ ] **Memory Efficiency**: <10MB IndexedDB storage for typical user

### Functionality Improvements:
- [ ] **Offline Support**: Calendar works completely offline within cache window
- [ ] **Real-time Sync**: MCP tool changes appear within 2 seconds
- [ ] **Type Safety**: Single `CalendarEvent` type across entire app
- [ ] **Data Consistency**: Automatic cleanup and validation
- [ ] **Smart Loading**: Fast for recent events, on-demand for historical

### Developer Experience:
- [ ] **Simpler API**: Single hook replaces complex multi-table logic
- [ ] **Better Types**: Consolidated type system
- [ ] **Easier Testing**: Isolated data layer with clear interfaces
- [ ] **Future-Proof**: Ready for advanced caching and sync strategies

---

## Risk Mitigation

### Rollback Strategy:
- [ ] Keep existing `useCalendarEvents` hook until new system is proven
- [ ] Feature flag to switch between old/new data layer
- [ ] Database view is additive (doesn't change existing tables)
- [ ] Gradual migration path with backwards compatibility

### Data Safety:
- [ ] Dexie as cache only (Supabase remains source of truth)
- [ ] View permissions properly scoped with RLS
- [ ] Optimistic updates with automatic rollback
- [ ] Comprehensive data validation and cleaning

This comprehensive plan transforms the complex, multi-table calendar events system into a **fast, offline-first, real-time synchronized** solution that solves the original MCP tool cache invalidation problem while providing significant performance and user experience improvements.