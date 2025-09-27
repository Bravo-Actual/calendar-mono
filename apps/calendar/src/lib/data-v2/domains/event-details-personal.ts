// data-v2/domains/event-details-personal.ts - Event Details Personal offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { EventPersonalSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable } from '../base/sync';
import { mapEDPFromServer } from '../../data/base/mapping';
import type { ClientEDP } from '../../data/base/client-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useEventDetailsPersonal(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEDP[]> => {
    if (!uid) return [];

    return await db.event_details_personal
      .where('user_id')
      .equals(uid)
      .sortBy('updated_at');
  }, [uid]);
}

export function useEventDetailPersonal(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEDP | undefined> => {
    if (!uid || !eventId) return undefined;

    const detail = await db.event_details_personal.get([eventId, uid]);
    return detail?.user_id === uid ? detail : undefined;
  }, [uid, eventId]);
}

// Get personal details for multiple events
export function useEventDetailsPersonalByEvents(uid: string | undefined, eventIds: string[]) {
  return useLiveQuery(async (): Promise<ClientEDP[]> => {
    if (!uid || !eventIds.length) return [];

    const details = await Promise.all(
      eventIds.map(eventId => db.event_details_personal.get([eventId, uid]))
    );

    return details.filter((detail): detail is ClientEDP => detail !== undefined);
  }, [uid, ...eventIds]);
}

// Dexie-first mutations with outbox pattern
export async function createEventDetailPersonal(
  uid: string,
  input: {
    event_id: string;
    calendar_id?: string;
    category_id?: string;
    show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
    time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block';
    ai_managed?: boolean;
    ai_instructions?: string;
  }
): Promise<ClientEDP> {
  const now = new Date();

  const detail: ClientEDP = {
    event_id: input.event_id,
    user_id: uid,
    calendar_id: input.calendar_id ?? null,
    category_id: input.category_id ?? null,
    show_time_as: input.show_time_as ?? 'busy',
    time_defense_level: input.time_defense_level ?? 'normal',
    ai_managed: input.ai_managed ?? false,
    ai_instructions: input.ai_instructions ?? null,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedDetail = validateBeforeEnqueue(EventPersonalSchema, detail);

  // 2. Write to Dexie first (instant optimistic update)
  await db.event_details_personal.put(validatedDetail);

  // 3. Enqueue in outbox for eventual server sync
  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'event_details_personal',
    op: 'insert',
    payload: validatedDetail,
    created_at: now.toISOString(),
    attempts: 0,
  });

  return detail;
}

export async function updateEventDetailPersonal(
  uid: string,
  eventId: string,
  input: {
    calendar_id?: string;
    category_id?: string;
    show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
    time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block';
    ai_managed?: boolean;
    ai_instructions?: string;
  }
): Promise<void> {
  // 1. Get existing detail from Dexie
  const existing = await db.event_details_personal.get([eventId, uid]);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Event detail not found or access denied');
  }

  const now = new Date();
  const updated: ClientEDP = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedDetail = validateBeforeEnqueue(EventPersonalSchema, updated);

  // 3. Update in Dexie first (instant optimistic update)
  await db.event_details_personal.put(validatedDetail);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'event_details_personal',
    op: 'update',
    payload: validatedDetail,
    created_at: now.toISOString(),
    attempts: 0,
  });
}

export async function deleteEventDetailPersonal(uid: string, eventId: string): Promise<void> {
  // 1. Get existing detail from Dexie
  const existing = await db.event_details_personal.get([eventId, uid]);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Event detail not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.event_details_personal.delete([eventId, uid]);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'event_details_personal',
    op: 'delete',
    payload: { event_id: eventId, user_id: uid },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Sync functions using the centralized infrastructure
export async function pullEventDetailsPersonal(userId: string): Promise<void> {
  return pullTable('event_details_personal', userId, mapEDPFromServer);
}