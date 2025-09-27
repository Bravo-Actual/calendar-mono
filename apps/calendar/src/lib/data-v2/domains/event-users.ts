// data-v2/domains/event-users.ts - Event Users offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { EventUserSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable } from '../base/sync';
import { mapEventUserFromServer } from '../../data/base/mapping';
import type { ClientEventUser } from '../../data/base/client-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useEventUsers(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventUser[]> => {
    if (!uid) return [];

    return await db.event_users
      .where('user_id')
      .equals(uid)
      .sortBy('updated_at');
  }, [uid]);
}

export function useEventUser(uid: string | undefined, eventUserId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventUser | undefined> => {
    if (!uid || !eventUserId) return undefined;

    const eventUser = await db.event_users.get(eventUserId);
    return eventUser?.user_id === uid ? eventUser : undefined;
  }, [uid, eventUserId]);
}

// Get event users for a specific event
export function useEventUsersByEvent(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventUser[]> => {
    if (!uid || !eventId) return [];

    return await db.event_users
      .where('event_id')
      .equals(eventId)
      .sortBy('updated_at');
  }, [uid, eventId]);
}

// Dexie-first mutations with outbox pattern
export async function createEventUser(
  uid: string,
  input: {
    event_id: string;
    user_id: string;
    role?: ClientEventUser['role'];
  }
): Promise<ClientEventUser> {
  const id = generateUUID();
  const now = new Date();

  const eventUser: ClientEventUser = {
    id,
    event_id: input.event_id,
    user_id: input.user_id,
    role: input.role ?? 'attendee',
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedEventUser = validateBeforeEnqueue(EventUserSchema, eventUser);

  // 2. Write to Dexie first (instant optimistic update)
  await db.event_users.put(validatedEventUser);

  // 3. Enqueue in outbox for eventual server sync
  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'event_users',
    op: 'insert',
    payload: validatedEventUser,
    created_at: now.toISOString(),
    attempts: 0,
  });

  return eventUser;
}

export async function updateEventUser(
  uid: string,
  eventUserId: string,
  input: {
    role?: ClientEventUser['role'];
  }
): Promise<void> {
  // 1. Get existing event user from Dexie
  const existing = await db.event_users.get(eventUserId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Event user not found or access denied');
  }

  const now = new Date();
  const updated: ClientEventUser = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedEventUser = validateBeforeEnqueue(EventUserSchema, updated);

  // 3. Update in Dexie first (instant optimistic update)
  await db.event_users.put(validatedEventUser);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'event_users',
    op: 'update',
    payload: validatedEventUser,
    created_at: now.toISOString(),
    attempts: 0,
  });
}

export async function deleteEventUser(uid: string, eventUserId: string): Promise<void> {
  // 1. Get existing event user from Dexie
  const existing = await db.event_users.get(eventUserId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Event user not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.event_users.delete(eventUserId);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'event_users',
    op: 'delete',
    payload: { id: eventUserId },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Sync functions using the centralized infrastructure
export async function pullEventUsers(userId: string): Promise<void> {
  return pullTable('event_users', userId, mapEventUserFromServer);
}