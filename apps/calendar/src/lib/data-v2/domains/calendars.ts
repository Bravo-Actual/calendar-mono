// data-v2/domains/calendars.ts - Offline-first calendars implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID, nowISO } from '../../data/base/utils';
import { CalendarSchema, validateBeforeEnqueue } from '../base/validators';
import { pullTable } from '../base/sync';
import { mapCalendarFromServer } from '../../data/base/mapping';
import type { ClientCalendar } from '../../data/base/client-types';

// Read hooks using useLiveQuery (instant, reactive)
export function useUserCalendars(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientCalendar[]> => {
    if (!uid) return [];
    return await db.user_calendars.where('user_id').equals(uid).sortBy('name');
  }, [uid]);
}

export function useUserCalendar(uid: string | undefined, calendarId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientCalendar | undefined> => {
    if (!uid || !calendarId) return undefined;
    const calendar = await db.user_calendars.get(calendarId);
    return (calendar?.user_id === uid) ? calendar : undefined;
  }, [uid, calendarId]);
}

// Dexie-first mutations with outbox pattern
export async function createCalendar(
  uid: string,
  input: {
    name: string;
    color?: ClientCalendar['color'];
    type?: ClientCalendar['type'];
    visible?: boolean;
  }
): Promise<ClientCalendar> {
  const id = generateUUID();
  const now = nowISO();

  const calendar: ClientCalendar = {
    id,
    user_id: uid,
    name: input.name,
    color: input.color ?? 'neutral',
    type: input.type ?? 'user',
    visible: input.visible ?? true,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedCalendar = validateBeforeEnqueue(CalendarSchema, calendar);

  // 2. Write to Dexie first (instant optimistic update)
  await db.user_calendars.put(validatedCalendar);

  // 3. Enqueue in outbox for eventual server sync
  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'user_calendars',
    op: 'insert',
    payload: validatedCalendar,
    created_at: now,
    attempts: 0,
  });

  return calendar;
}

export async function updateCalendar(
  uid: string,
  calendarId: string,
  input: {
    name?: string;
    color?: ClientCalendar['color'];
    type?: ClientCalendar['type'];
    visible?: boolean;
  }
): Promise<void> {
  // 1. Get existing calendar from Dexie
  const existing = await db.user_calendars.get(calendarId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Calendar not found or access denied');
  }

  const now = nowISO();
  const updated: ClientCalendar = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedCalendar = validateBeforeEnqueue(CalendarSchema, updated);

  // 3. Write to Dexie first (instant optimistic update)
  await db.user_calendars.put(validatedCalendar);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'user_calendars',
    op: 'update',
    payload: validatedCalendar,
    created_at: now,
    attempts: 0,
  });
}

export async function deleteCalendar(uid: string, calendarId: string): Promise<void> {
  // 1. Get existing calendar from Dexie
  const existing = await db.user_calendars.get(calendarId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Calendar not found or access denied');
  }

  // 2. Prevent deletion of default and archive calendars
  if (existing.type === 'default' || existing.type === 'archive') {
    throw new Error('Cannot delete default or archive calendars');
  }

  const now = nowISO();

  // 3. Delete from Dexie first (instant optimistic update)
  await db.user_calendars.delete(calendarId);

  // 4. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'user_calendars',
    op: 'delete',
    payload: { id: calendarId },
    created_at: now,
    attempts: 0,
  });
}

// Data sync functions (called by DataProvider)
export async function pullCalendars(uid: string): Promise<void> {
  return pullTable('user_calendars', uid, mapCalendarFromServer);
}