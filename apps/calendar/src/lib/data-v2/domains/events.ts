// data-v2/domains/events.ts - Events offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { EventSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable, getWatermark, setWatermark } from '../base/sync';
import { supabase } from '../base/client';
import { mapEventFromServer } from '../../data/base/mapping';
import type { ClientEvent } from '../../data/base/client-types';
import type { Json } from '../../data/base/supabase-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useEvents(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEvent[]> => {
    if (!uid) return [];

    return await db.events
      .where('owner_id')
      .equals(uid)
      .sortBy('start_time_ms');
  }, [uid]);
}

export function useEvent(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEvent | undefined> => {
    if (!uid || !eventId) return undefined;

    const event = await db.events.get(eventId);
    return event?.owner_id === uid ? event : undefined;
  }, [uid, eventId]);
}

// Dexie-first mutations with outbox pattern
export async function createEvent(
  uid: string,
  input: {
    title: string;
    start_time: string; // ISO UTC
    end_time: string;   // ISO UTC
    series_id?: ClientEvent['series_id'];
    agenda?: ClientEvent['agenda'];
    online_event?: boolean;
    online_join_link?: ClientEvent['online_join_link'];
    online_chat_link?: ClientEvent['online_chat_link'];
    in_person?: boolean;
    all_day?: boolean;
    private?: boolean;
    request_responses?: boolean;
    allow_forwarding?: boolean;
    allow_reschedule_request?: boolean;
    hide_attendees?: boolean;
    discovery?: ClientEvent['discovery'];
    join_model?: ClientEvent['join_model'];
  }
): Promise<ClientEvent> {
  console.log(`📅 [DEBUG] createEvent called for user ${uid}:`, JSON.stringify(input, null, 2));

  const id = generateUUID();
  const now = new Date();
  const startTime = new Date(input.start_time);
  const endTime = new Date(input.end_time);

  const event: ClientEvent = {
    id,
    owner_id: uid,
    series_id: input.series_id ?? null,
    title: input.title,
    agenda: input.agenda ?? null,
    online_event: input.online_event ?? false,
    online_join_link: input.online_join_link ?? null,
    online_chat_link: input.online_chat_link ?? null,
    in_person: input.in_person ?? false,
    start_time: startTime,
    end_time: endTime,
    start_time_ms: startTime.getTime(),
    end_time_ms: endTime.getTime(),
    all_day: input.all_day ?? false,
    private: input.private ?? false,
    request_responses: input.request_responses ?? true,
    allow_forwarding: input.allow_forwarding ?? true,
    allow_reschedule_request: input.allow_reschedule_request ?? true,
    hide_attendees: input.hide_attendees ?? false,
    history: [] as Json,
    discovery: input.discovery ?? 'audience_only',
    join_model: input.join_model ?? 'invite_only',
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedEvent = validateBeforeEnqueue(EventSchema, event);

  // 2. Write to Dexie first (instant optimistic update)
  await db.events.put(validatedEvent);

  // 3. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = {
    ...validatedEvent,
    start_time: validatedEvent.start_time.toISOString(),
    end_time: validatedEvent.end_time.toISOString(),
    created_at: validatedEvent.created_at.toISOString(),
    updated_at: validatedEvent.updated_at.toISOString(),
  };

  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'events',
    op: 'insert',
    payload: serverPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });

  console.log(`📤 OUTBOX: Queued event creation`, {
    outboxId,
    eventId: event.id,
    title: event.title,
    op: 'insert'
  });

  return event;
}

export async function updateEvent(
  uid: string,
  eventId: string,
  input: {
    title?: string;
    start_time?: Date;
    end_time?: Date;
    series_id?: string;
    agenda?: string;
    online_event?: boolean;
    online_join_link?: string;
    online_chat_link?: string;
    in_person?: boolean;
    all_day?: boolean;
    private?: boolean;
    request_responses?: boolean;
    allow_forwarding?: boolean;
    allow_reschedule_request?: boolean;
    hide_attendees?: boolean;
    discovery?: 'audience_only' | 'tenant_only' | 'public';
    join_model?: 'invite_only' | 'request_to_join' | 'open_join';
  }
): Promise<void> {
  // 1. Get existing event from Dexie
  const existing = await db.events.get(eventId);
  if (!existing || existing.owner_id !== uid) {
    throw new Error('Event not found or access denied');
  }

  const now = new Date();

  const startTime = input.start_time || existing.start_time;
  const endTime = input.end_time || existing.end_time;

  // Debug: Check what types we actually have in Dexie
  console.log('🔍 DEBUG: Existing event data types:', {
    eventId: existing.id,
    start_time: { value: existing.start_time, type: typeof existing.start_time, isDate: existing.start_time instanceof Date },
    end_time: { value: existing.end_time, type: typeof existing.end_time, isDate: existing.end_time instanceof Date },
    created_at: { value: existing.created_at, type: typeof existing.created_at, isDate: existing.created_at instanceof Date },
    updated_at: { value: existing.updated_at, type: typeof existing.updated_at, isDate: existing.updated_at instanceof Date }
  });

  const updated: ClientEvent = {
    ...existing,
    ...input,
    start_time: startTime,
    end_time: endTime,
    start_time_ms: startTime.getTime(),
    end_time_ms: endTime.getTime(),
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedEvent = validateBeforeEnqueue(EventSchema, updated);

  // 3. Update in Dexie first (instant optimistic update)
  await db.events.put(validatedEvent);

  // 4. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = {
    ...validatedEvent,
    start_time: validatedEvent.start_time.toISOString(),
    end_time: validatedEvent.end_time.toISOString(),
    created_at: validatedEvent.created_at.toISOString(),
    updated_at: validatedEvent.updated_at.toISOString(),
  };

  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'events',
    op: 'update',
    payload: serverPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });


  console.log(`📤 OUTBOX: Queued event update`, {
    eventId: validatedEvent.id,
    title: validatedEvent.title,
    changes: Object.keys(input),
    timestamp: now.toISOString()
  });
}

export async function deleteEvent(uid: string, eventId: string): Promise<void> {
  // 1. Get existing event from Dexie
  const existing = await db.events.get(eventId);
  if (!existing || existing.owner_id !== uid) {
    throw new Error('Event not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.events.delete(eventId);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'events',
    op: 'delete',
    payload: { id: eventId },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Sync functions using the centralized infrastructure
export async function pullEvents(userId: string): Promise<void> {
  // Events use owner_id instead of user_id, so use custom sync logic
  const watermark = await getWatermark('events', userId);

  let query = supabase
    .from('events')
    .select('*')
    .eq('owner_id', userId);

  // Apply watermark for incremental sync
  if (watermark) {
    query = query.gt('updated_at', watermark);
  }

  const { data, error } = await query.order('updated_at');

  if (error) throw error;

  if (data?.length) {
    const mapped = data.map(mapEventFromServer);

    // Conflict resolution: check for pending client changes
    const pendingEventIds = new Set(
      (await db.outbox.where('table').equals('events').toArray())
        .map(op => (op.payload as any)?.id)
        .filter(id => id)
    );

    const eventsToUpdate = [];
    for (const serverEvent of mapped) {
      // Skip if client has pending changes for this event
      if (pendingEventIds.has(serverEvent.id)) {
        console.log(`⚠️ Skipping server update for event ${serverEvent.id} - client has pending changes`);
        continue;
      }

      // Check if client version is newer
      const clientEvent = await db.events.get(serverEvent.id);
      if (clientEvent && clientEvent.updated_at > serverEvent.updated_at) {
        console.log(`⚠️ Skipping server update for event ${serverEvent.id} - client is newer`);
        continue;
      }

      eventsToUpdate.push(serverEvent);
    }

    if (eventsToUpdate.length > 0) {
      await db.events.bulkPut(eventsToUpdate);
      console.log(`📥 Updated ${eventsToUpdate.length} events from server (skipped ${mapped.length - eventsToUpdate.length} with local changes)`);
    }

    // Update watermark to latest timestamp
    const latestTimestamp = data[data.length - 1].updated_at;
    if (latestTimestamp) {
      await setWatermark('events', userId, latestTimestamp);
    }
  }
}

