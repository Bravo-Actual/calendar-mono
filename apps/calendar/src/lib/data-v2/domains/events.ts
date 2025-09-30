// data-v2/domains/events.ts - Events offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientEvent } from '../../data/base/client-types';
import { mapEventFromServer } from '../../data/base/mapping';
import { supabase } from '../base/client';
import { db } from '../base/dexie';
import { getWatermark, setWatermark } from '../base/sync';

// Read hooks using useLiveQuery (instant, reactive)
export function useEvents(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEvent[]> => {
    if (!uid) return [];

    return await db.events.where('owner_id').equals(uid).sortBy('start_time_ms');
  }, [uid]);
}

export function useEvent(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEvent | undefined> => {
    if (!uid || !eventId) return undefined;

    const event = await db.events.get(eventId);
    return event?.owner_id === uid ? event : undefined;
  }, [uid, eventId]);
}

// NOTE: Individual event CRUD operations removed - use createEventResolved, updateEventResolved, deleteEventResolved instead
// These operate on the full resolved event structure and go through the edge function

// Sync functions using the centralized infrastructure
export async function pullEvents(userId: string): Promise<void> {
  // Events use owner_id instead of user_id, so use custom sync logic
  const watermark = await getWatermark('events', userId);

  let query = supabase.from('events').select('*').eq('owner_id', userId);

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
        .map((op) => (op.payload as any)?.id)
        .filter((id) => id)
    );

    const eventsToUpdate = [];
    for (const serverEvent of mapped) {
      // Skip if client has pending changes for this event
      if (pendingEventIds.has(serverEvent.id)) {
        continue;
      }

      // Check if client version is newer
      const clientEvent = await db.events.get(serverEvent.id);
      if (clientEvent && clientEvent.updated_at > serverEvent.updated_at) {
        continue;
      }

      eventsToUpdate.push(serverEvent);
    }

    if (eventsToUpdate.length > 0) {
      await db.events.bulkPut(eventsToUpdate);
    }

    // Update watermark to latest timestamp
    const latestTimestamp = data[data.length - 1].updated_at;
    if (latestTimestamp) {
      await setWatermark('events', userId, latestTimestamp);
    }
  }
}
