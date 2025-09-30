// data-v2/domains/event-rsvps.ts - Event RSVPs offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientEventRsvp } from '../base/client-types';
import { mapEventRsvpFromServer } from '../base/mapping';
import { db } from '../base/dexie';
import { pullTable } from '../base/sync';

// Read hooks using useLiveQuery (instant, reactive)
export function useEventRsvps(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventRsvp[]> => {
    if (!uid) return [];

    return await db.event_rsvps.where('user_id').equals(uid).sortBy('updated_at');
  }, [uid]);
}

export function useEventRsvp(
  uid: string | undefined,
  eventId: string | undefined,
  userId: string | undefined
) {
  return useLiveQuery(async (): Promise<ClientEventRsvp | undefined> => {
    if (!uid || !eventId || !userId) return undefined;

    const eventRsvp = await db.event_rsvps.get([eventId, userId]);
    return eventRsvp?.user_id === uid ? eventRsvp : undefined;
  }, [uid, eventId, userId]);
}

// Get event RSVPs for a specific event
export function useEventRsvpsByEvent(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventRsvp[]> => {
    if (!uid || !eventId) return [];

    return await db.event_rsvps.where('event_id').equals(eventId).sortBy('updated_at');
  }, [uid, eventId]);
}

// NOTE: Individual event_rsvps CRUD operations removed - use createEventResolved, updateEventResolved, deleteEventResolved instead
// These operate on the full resolved event structure and go through the edge function

// Sync functions using the centralized infrastructure
export async function pullEventRsvps(userId: string): Promise<void> {
  return pullTable('event_rsvps', userId, mapEventRsvpFromServer);
}
