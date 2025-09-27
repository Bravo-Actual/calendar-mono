// data-v2/domains/event-details-personal.ts - Event Details Personal offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
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

// NOTE: Individual event_details_personal CRUD operations removed - use createEventResolved, updateEventResolved, deleteEventResolved instead
// These operate on the full resolved event structure and go through the edge function

// Sync functions using the centralized infrastructure
export async function pullEventDetailsPersonal(userId: string): Promise<void> {
  return pullTable('event_details_personal', userId, mapEDPFromServer);
}

