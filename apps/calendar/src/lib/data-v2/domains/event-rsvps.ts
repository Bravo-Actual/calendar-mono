// data-v2/domains/event-rsvps.ts - Event RSVPs offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { EventRsvpSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable } from '../base/sync';
import { mapEventRsvpFromServer } from '../../data/base/mapping';
import type { ClientEventRsvp } from '../../data/base/client-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useEventRsvps(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventRsvp[]> => {
    if (!uid) return [];

    return await db.event_rsvps
      .where('user_id')
      .equals(uid)
      .sortBy('updated_at');
  }, [uid]);
}

export function useEventRsvp(uid: string | undefined, eventRsvpId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventRsvp | undefined> => {
    if (!uid || !eventRsvpId) return undefined;

    const eventRsvp = await db.event_rsvps.get(eventRsvpId);
    return eventRsvp?.user_id === uid ? eventRsvp : undefined;
  }, [uid, eventRsvpId]);
}

// Get event RSVPs for a specific event
export function useEventRsvpsByEvent(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventRsvp[]> => {
    if (!uid || !eventId) return [];

    return await db.event_rsvps
      .where('event_id')
      .equals(eventId)
      .sortBy('updated_at');
  }, [uid, eventId]);
}

// Dexie-first mutations with outbox pattern
export async function createEventRsvp(
  uid: string,
  input: {
    event_id: string;
    user_id: string;
    rsvp_status?: ClientEventRsvp['rsvp_status'];
    attendance_type?: ClientEventRsvp['attendance_type'];
    note?: string;
    following?: boolean;
  }
): Promise<ClientEventRsvp> {
  const id = generateUUID();
  const now = new Date();

  const eventRsvp: ClientEventRsvp = {
    id,
    event_id: input.event_id,
    user_id: input.user_id,
    rsvp_status: input.rsvp_status ?? 'tentative',
    attendance_type: input.attendance_type ?? 'unknown',
    note: input.note ?? null,
    following: input.following ?? false,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedEventRsvp = validateBeforeEnqueue(EventRsvpSchema, eventRsvp);

  // 2. Write to Dexie first (instant optimistic update)
  await db.event_rsvps.put(validatedEventRsvp);

  // 3. Enqueue in outbox for eventual server sync
  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'event_rsvps',
    op: 'insert',
    payload: validatedEventRsvp,
    created_at: now.toISOString(),
    attempts: 0,
  });

  return eventRsvp;
}

export async function updateEventRsvp(
  uid: string,
  eventRsvpId: string,
  input: {
    rsvp_status?: ClientEventRsvp['rsvp_status'];
    attendance_type?: ClientEventRsvp['attendance_type'];
    note?: string;
    following?: boolean;
  }
): Promise<void> {
  // 1. Get existing event RSVP from Dexie
  const existing = await db.event_rsvps.get(eventRsvpId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Event RSVP not found or access denied');
  }

  const now = new Date();
  const updated: ClientEventRsvp = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedEventRsvp = validateBeforeEnqueue(EventRsvpSchema, updated);

  // 3. Update in Dexie first (instant optimistic update)
  await db.event_rsvps.put(validatedEventRsvp);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'event_rsvps',
    op: 'update',
    payload: validatedEventRsvp,
    created_at: now.toISOString(),
    attempts: 0,
  });
}

export async function deleteEventRsvp(uid: string, eventRsvpId: string): Promise<void> {
  // 1. Get existing event RSVP from Dexie
  const existing = await db.event_rsvps.get(eventRsvpId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Event RSVP not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.event_rsvps.delete(eventRsvpId);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'event_rsvps',
    op: 'delete',
    payload: { id: eventRsvpId },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Sync functions using the centralized infrastructure
export async function pullEventRsvps(userId: string): Promise<void> {
  return pullTable('event_rsvps', userId, mapEventRsvpFromServer);
}