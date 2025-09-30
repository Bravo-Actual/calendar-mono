// data-v2/domains/user-work-periods.ts - Offline-first user work periods implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientUserWorkPeriod } from '../base/client-types';
import { mapUserWorkPeriodFromServer, mapUserWorkPeriodToServer } from '../base/mapping';
import { generateUUID, nowISO } from '../base/utils';
import { db } from '../base/dexie';
import { pullTable } from '../base/sync';
import { UserWorkPeriodSchema, validateBeforeEnqueue } from '../base/validators';

// Read hooks using useLiveQuery (instant, reactive)
export function useUserWorkPeriods(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientUserWorkPeriod[]> => {
    if (!uid) return [];

    return await db.user_work_periods.where('user_id').equals(uid).sortBy('weekday');
  }, [uid]);
}

export function useUserWorkPeriod(uid: string | undefined, workPeriodId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientUserWorkPeriod | undefined> => {
    if (!uid || !workPeriodId) return undefined;

    const workPeriod = await db.user_work_periods.get(workPeriodId);
    return workPeriod?.user_id === uid ? workPeriod : undefined;
  }, [uid, workPeriodId]);
}

// Dexie-first mutations with outbox pattern
export async function createUserWorkPeriod(
  uid: string,
  input: {
    weekday: number;
    start_time: string;
    end_time: string;
  }
): Promise<ClientUserWorkPeriod> {
  const id = generateUUID();
  const now = new Date();

  const workPeriod: ClientUserWorkPeriod = {
    id,
    user_id: uid,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedWorkPeriod = validateBeforeEnqueue(UserWorkPeriodSchema, workPeriod);

  // 2. Write to Dexie first (instant optimistic update)
  await db.user_work_periods.put(validatedWorkPeriod);

  // 3. Enqueue in outbox for eventual server sync
  const outboxId = generateUUID();
  const serverPayload = mapUserWorkPeriodToServer(validatedWorkPeriod);

  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'user_work_periods',
    op: 'insert',
    payload: serverPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });

  return workPeriod;
}

export async function updateUserWorkPeriod(
  uid: string,
  workPeriodId: string,
  input: {
    weekday?: number;
    start_time?: string;
    end_time?: string;
  }
): Promise<void> {
  // 1. Get existing work period from Dexie
  const existing = await db.user_work_periods.get(workPeriodId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('User work period not found or access denied');
  }

  const now = new Date();
  const updated: ClientUserWorkPeriod = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedWorkPeriod = validateBeforeEnqueue(UserWorkPeriodSchema, updated);

  // 3. Write to Dexie first (instant optimistic update)
  await db.user_work_periods.put(validatedWorkPeriod);

  // 4. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapUserWorkPeriodToServer(validatedWorkPeriod);

  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'user_work_periods',
    op: 'update',
    payload: serverPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });
}

export async function deleteUserWorkPeriod(uid: string, workPeriodId: string): Promise<void> {
  // 1. Get existing work period from Dexie
  const existing = await db.user_work_periods.get(workPeriodId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('User work period not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.user_work_periods.delete(workPeriodId);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'user_work_periods',
    op: 'delete',
    payload: { id: workPeriodId },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Data sync functions (called by DataProvider)
export async function pullUserWorkPeriods(uid: string): Promise<void> {
  return pullTable('user_work_periods', uid, mapUserWorkPeriodFromServer);
}
