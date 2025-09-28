// data-v2/base/sync.ts - Central sync orchestration with multi-tab support
import { db } from './dexie';
import { supabase } from './client';
import { nowISO } from '../../data/base/utils';
import type { OutboxOperation } from './dexie';
import { mapCategoryFromServer, mapCalendarFromServer, mapUserProfileFromServer, mapUserWorkPeriodFromServer, mapPersonaFromServer, mapEventFromServer, mapEDPFromServer, mapEventUserFromServer, mapEventRsvpFromServer, mapAnnotationFromServer } from '../../data/base/mapping';

// Jittered exponential backoff per plan
function jittered(ms: number): number {
  const j = Math.random() * 0.1;
  return Math.round(ms * (1 + j));
}

// Watermark helpers
export async function getWatermark(table: string, userId: string): Promise<string | null> {
  const meta = await db.meta.get(`last_sync:${table}:${userId}`);
  return meta?.value || null;
}

export async function setWatermark(table: string, userId: string, timestamp: string): Promise<void> {
  await db.meta.put({
    key: `last_sync:${table}:${userId}`,
    value: timestamp
  });
}

// Process event-related tables via edge function
async function processEventTablesViaEdgeFunction(
  table: string,
  group: OutboxOperation[],
  userId: string
): Promise<void> {
  // All event-related tables route to the events edge function
  // The edge function handles composite operations on events, event_details_personal, etc.
  // Currently we only send 'events' table operations, but this supports future expansion
  const supportedEventTables = ['events', 'event_users', 'event_rsvps', 'event_details_personal'];
  if (!supportedEventTables.includes(table)) {
    throw new Error(`Table ${table} is not an event-related table`);
  }

  // Process each operation individually since edge function handles one at a time
  for (const operation of group) {
    try {
      if (operation.op === 'delete') {
        const { error } = await supabase.functions.invoke('events', {
          method: 'DELETE',
          body: {
            id: operation.payload.id,
          },
        });
        if (error) throw error;
      } else {
        // For insert/update operations, use appropriate HTTP method
        const method = operation.op === 'insert' ? 'POST' : 'PATCH';
        console.log(`🔍 [DEBUG] Calling edge function with method ${method} and payload:`, JSON.stringify(operation.payload, null, 2));
        const { error } = await supabase.functions.invoke('events', {
          method,
          body: operation.payload,
        });
        if (error) {
          console.error(`❌ [ERROR] Edge function error response:`, error);
          throw error;
        }
      }

      // Clear this operation from outbox on success
      await db.outbox.delete(operation.id);
    } catch (error) {
      console.error(`❌ [ERROR] Edge function failed for ${table} ${operation.op}:`, error);
      throw error;
    }
  }
}

// Multi-tab outbox draining with leader election
export async function pushOutbox(userId: string): Promise<void> {
  console.log(`🔄 [DEBUG] pushOutbox called for user ${userId}`);

  // Only one tab drains the outbox using Web Locks API
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request('outbox-drain', async () => {
      await drainOutbox(userId);
    });
  } else {
    // Fallback for environments without Web Locks API
    await drainOutbox(userId);
  }
}

async function drainOutbox(userId: string): Promise<void> {
  console.log(`🗃️ [DEBUG] drainOutbox starting for user ${userId}`);

  const raw = await db.outbox
    .where('user_id')
    .equals(userId)
    .sortBy('created_at');

  console.log(`🗃️ [DEBUG] Found ${raw.length} outbox items to sync`);

  if (raw.length === 0) return;

  // Dedupe: keep latest payload per table:record_id
  const latest = new Map<string, OutboxOperation>();
  for (const item of raw) {
    // Handle composite keys for junction tables
    let recordKey: string;
    if (item.table === 'event_users' || item.table === 'event_rsvps' || item.table === 'event_details_personal') {
      recordKey = `${item.payload?.event_id}:${item.payload?.user_id}`;
    } else {
      recordKey = item.payload?.id ?? item.id;
    }
    const key = `${item.table}:${recordKey}`;
    latest.set(key, item);
  }

  const items = Array.from(latest.values());

  // Group by table + operation for batching
  const groups = new Map<string, OutboxOperation[]>();
  for (const item of items) {
    const key = `${item.table}:${item.op}`;
    const arr = groups.get(key) || [];
    arr.push(item);
    groups.set(key, arr);
  }

  // Process each group
  for (const [key, group] of groups) {
    const [table, op] = key.split(':');
    await processOutboxGroup(table, op as 'insert' | 'update' | 'delete', group, userId);
  }
}

async function processOutboxGroup(
  table: string,
  op: 'insert' | 'update' | 'delete',
  group: OutboxOperation[],
  userId: string
): Promise<void> {
  try {
    if (op === 'insert' || op === 'update') {
      await processUpsertGroup(table, group, userId);
    } else if (op === 'delete') {
      await processDeleteGroup(table, group, userId);
    }
  } catch (error: any) {
    await handleOutboxError(error, group);
  }
}

async function processUpsertGroup(table: string, group: OutboxOperation[], userId: string): Promise<void> {
  // Handle event-related tables via edge function
  const eventTables = ['events', 'event_users', 'event_rsvps', 'event_details_personal'];
  if (eventTables.includes(table)) {
    return await processEventTablesViaEdgeFunction(table, group, userId);
  }

  let payload = group.map(g => g.payload);

  // Ensure auth session exists
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user?.id) {
    throw new Error(`Sync requires authenticated session: ${authError?.message || 'No user'}`);
  }

  // Debug logging for non-event tables
  console.log(`🔍 [DEBUG] Upserting to ${table}:`, JSON.stringify(payload, null, 2));

  const { data, error } = await supabase
    .from(table as any)
    .upsert(payload)
    .select();

  if (error) {
    console.error(`❌ [ERROR] Failed to upsert to ${table}:`, error);
    console.error(`❌ [ERROR] Error details:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    console.error(`❌ [ERROR] Payload that failed:`, JSON.stringify(payload, null, 2));
    throw error;
  }

  // Update Dexie with server response and clear outbox
  await db.transaction('rw', [table, db.outbox], async () => {
    if (data?.length) {
      // Map server data back to client types before storing
      try {
        const mapped = data.map(serverRow => {
          switch (table) {
            case 'event_details_personal':
              return mapEDPFromServer(serverRow);
            case 'event_users':
              return mapEventUserFromServer(serverRow);
            case 'event_rsvps':
              return mapEventRsvpFromServer(serverRow);
            case 'user_categories':
              return mapCategoryFromServer(serverRow);
            case 'user_calendars':
              return mapCalendarFromServer(serverRow);
            case 'user_profiles':
              return mapUserProfileFromServer(serverRow);
            case 'user_work_periods':
              return mapUserWorkPeriodFromServer(serverRow);
            case 'ai_personas':
              return mapPersonaFromServer(serverRow);
            case 'user_annotations':
              return mapAnnotationFromServer(serverRow);
            default:
              return serverRow;
          }
        });
        await (db[table as keyof typeof db] as any).bulkPut(mapped);
        console.log(`✅ Successfully synced ${mapped.length} ${table} records to Dexie`);
      } catch (mappingError) {
        console.error(`❌ [ERROR] Failed to map server response for ${table}:`, mappingError);
        console.error(`❌ [ERROR] Raw server data:`, JSON.stringify(data, null, 2));
        throw mappingError;
      }
    }
    for (const g of group) {
      await db.outbox.delete(g.id);
    }
  });
}

async function processDeleteGroup(table: string, group: OutboxOperation[], userId: string): Promise<void> {
  // Handle event-related tables via edge function
  const eventTables = ['events', 'event_users', 'event_rsvps', 'event_details_personal'];
  if (eventTables.includes(table)) {
    return await processEventTablesViaEdgeFunction(table, group, userId);
  }

  const ids = group.map(g => g.payload.id);

  // Handle different user column names (events never reach this point)
  const userColumn = 'user_id';

  const { error } = await supabase
    .from(table as any)
    .delete()
    .in('id', ids)
    .eq(userColumn, userId);

  if (error) throw error;

  // Clear outbox items
  await db.transaction('rw', [db.outbox], async () => {
    for (const g of group) {
      await db.outbox.delete(g.id);
    }
  });
}

async function handleOutboxError(error: any, group: OutboxOperation[]): Promise<void> {
  const status = error?.status ?? error?.code;
  const code = error?.code;

  // Treat duplicate key errors as success (record already exists)
  if (status === 409 || code === '23505') {
    for (const g of group) {
      await db.outbox.delete(g.id);
    }
    return;
  }

  const permanent = status === 401 || status === 403;

  for (const g of group) {
    const attempts = (g.attempts ?? 0) + 1;
    const next = permanent ? 0 : Math.min(30_000, 1000 * (2 ** Math.min(attempts, 5)));

    await db.outbox.update(g.id, {
      attempts,
      _error: permanent ? String(status) : undefined
    });

    // Jittered backoff for non-permanent errors
    if (!permanent && next > 0) {
      await new Promise(resolve => setTimeout(resolve, jittered(next)));
    }
  }

  // Re-throw if not permanent to stop processing other groups
  if (!permanent) {
    throw error;
  }
}

// Generic pull function for any table
export async function pullTable<T>(
  table: string,
  userId: string,
  mapFromServer: (serverRow: any) => T,
  additionalFilters?: Record<string, any>
): Promise<void> {
  const watermark = await getWatermark(table, userId);

  let query = supabase
    .from(table as any)
    .select('*')
    .eq('user_id', userId);

  // Apply watermark for incremental sync
  if (watermark) {
    query = query.gt('updated_at', watermark);
  }

  // Apply additional filters if provided
  if (additionalFilters) {
    for (const [key, value] of Object.entries(additionalFilters)) {
      query = query.eq(key, value);
    }
  }

  const { data, error } = await query.order('updated_at');

  if (error) throw error;

  if (data?.length) {
    const mapped = data.map(mapFromServer);
    await (db[table as keyof typeof db] as any).bulkPut(mapped);

    // Update watermark to latest timestamp (convert server string to ISO for watermark storage)
    const latestTimestamp = (data[data.length - 1] as any).updated_at;
    await setWatermark(table, userId, latestTimestamp);
  }
}

// Centralized real-time subscription setup with single WebSocket connection
function setupCentralizedRealtimeSubscription(userId: string, onUpdate?: () => void) {
  const channel = supabase.channel(`user-data:${userId}`);

  // User Categories table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_categories',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.user_categories.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapCategoryFromServer(payload.new as any);
          await db.user_categories.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for user_categories:', error);
      }
    }
  );

  // User Calendars table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_calendars',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.user_calendars.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapCalendarFromServer(payload.new as any);
          await db.user_calendars.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for user_calendars:', error);
      }
    }
  );

  // User Profiles table (note: filter by id instead of user_id since id = user_id)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_profiles',
      filter: `id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.user_profiles.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapUserProfileFromServer(payload.new as any);
          await db.user_profiles.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for user_profiles:', error);
      }
    }
  );

  // User Work Periods table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_work_periods',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.user_work_periods.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapUserWorkPeriodFromServer(payload.new as any);
          await db.user_work_periods.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for user_work_periods:', error);
      }
    }
  );

  // AI Personas table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'ai_personas',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.ai_personas.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapPersonaFromServer(payload.new as any);
          await db.ai_personas.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for ai_personas:', error);
      }
    }
  );

  // Events table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'events',
      filter: `owner_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.events.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapEventFromServer(payload.new as any);
          await db.events.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for events:', error);
      }
    }
  );

  // Event Details Personal table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_details_personal',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.event_details_personal.delete([payload.old.event_id, payload.old.user_id]);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapEDPFromServer(payload.new as any);
          await db.event_details_personal.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for event_details_personal:', error);
      }
    }
  );

  // Event Users table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_users',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.event_users.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapEventUserFromServer(payload.new as any);
          await db.event_users.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for event_users:', error);
      }
    }
  );

  // Event RSVPs table
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'event_rsvps',
      filter: `user_id=eq.${userId}`,
    },
    async (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          await db.event_rsvps.delete(payload.old.id);
        } else {
          // Use proper mapping function for timestamp conversion
          const mapped = mapEventRsvpFromServer(payload.new as any);
          await db.event_rsvps.put(mapped);
        }
        onUpdate?.();
      } catch (error) {
        console.error('Error handling real-time update for event_rsvps:', error);
      }
    }
  );

  return channel.subscribe();
}

// Central sync orchestration
const syncState: {
  userId?: string;
  subscription?: any;
  listeners: (() => void)[];
  syncInterval?: NodeJS.Timeout;
} = {
  listeners: []
};

export async function startSync(userId: string): Promise<void> {
  // Clean up any existing sync
  await stopSync();

  syncState.userId = userId;

  // No immediate sync hooks - let regular sync intervals handle outbox processing
  // This follows the same pattern as other tables: write to Dexie, sync via intervals

  try {
    // Initial push of any pending outbox items
    await pushOutbox(userId);

    // Set up centralized real-time subscription with single WebSocket connection
    syncState.subscription = setupCentralizedRealtimeSubscription(userId);

    // Set up event listeners for sync triggers
    const onOnline = () => tick(userId);
    const onFocus = () => tick(userId);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tick(userId);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    syncState.listeners.push(
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('focus', onFocus),
      () => document.removeEventListener('visibilitychange', onVisible)
    );

    console.log(`Sync started for user ${userId}`);
  } catch (error) {
    console.error('Failed to start sync:', error);
    throw error;
  }
}

export async function stopSync(): Promise<void> {
  // Clean up event listeners
  syncState.listeners.forEach(cleanup => cleanup());
  syncState.listeners = [];

  // No outbox hooks to clean up

  // Clean up real-time subscription
  if (syncState.subscription) {
    syncState.subscription.unsubscribe();
    syncState.subscription = undefined;
  }

  syncState.userId = undefined;
  console.log('Sync stopped');
}

// Sync tick - orchestrates pull and push
export async function tick(userId: string): Promise<void> {
  if (syncState.userId !== userId) return;

  try {
    // Push any pending changes first
    await pushOutbox(userId);

  } catch (error) {
    console.error('Sync tick failed:', error);
  }
}