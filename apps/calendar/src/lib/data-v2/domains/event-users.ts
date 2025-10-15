// data-v2/domains/event-users.ts - Event Users offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientEventUser, ClientUserProfile } from '../base/client-types';
import { db } from '../base/dexie';
import { mapEventUserFromServer } from '../base/mapping';

export type EventUserWithProfile = ClientEventUser & {
  profile: ClientUserProfile | null;
};

// Read hooks using useLiveQuery (instant, reactive)
export function useEventUsers(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventUser[]> => {
    if (!uid) return [];

    return await db.event_users.where('user_id').equals(uid).sortBy('updated_at');
  }, [uid]);
}

export function useEventUser(
  uid: string | undefined,
  eventId: string | undefined,
  userId: string | undefined
) {
  return useLiveQuery(async (): Promise<ClientEventUser | undefined> => {
    if (!uid || !eventId || !userId) return undefined;

    const eventUser = await db.event_users.get([eventId, userId]);
    return eventUser?.user_id === uid ? eventUser : undefined;
  }, [uid, eventId, userId]);
}

// Get event users for a specific event
export function useEventUsersByEvent(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientEventUser[]> => {
    if (!uid || !eventId) return [];

    return await db.event_users.where('event_id').equals(eventId).sortBy('updated_at');
  }, [uid, eventId]);
}

// Get event users with their profiles for a specific event
export function useEventUsersWithProfiles(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<EventUserWithProfile[]> => {
    if (!uid || !eventId) return [];

    const eventUsers = await db.event_users.where('event_id').equals(eventId).sortBy('updated_at');

    // Fetch profiles for all users
    const usersWithProfiles = await Promise.all(
      eventUsers.map(async (eventUser) => {
        const profile = await db.user_profiles.get(eventUser.user_id);
        return {
          ...eventUser,
          profile: profile || null,
        };
      })
    );

    return usersWithProfiles;
  }, [uid, eventId]);
}

// NOTE: Individual event_users CRUD operations removed - use createEventResolved, updateEventResolved, deleteEventResolved instead
// These operate on the full resolved event structure and go through the edge function

// Sync functions using the centralized infrastructure
export async function pullEventUsers(userId: string): Promise<void> {
  // Custom implementation: fetch all event_users for events the user has access to
  // This is different from other tables because we need event_users for ALL attendees,
  // not just where user_id = currentUser

  const { getWatermark, setWatermark } = await import('../base/sync');
  const { supabase } = await import('../../supabase');

  const watermark = await getWatermark('event_users', userId);

  // Step 1: Get all event IDs the user has access to (as owner or attendee)
  const { data: userEventUsers, error: userEventUsersError } = await supabase
    .from('event_users')
    .select('event_id')
    .eq('user_id', userId);

  if (userEventUsersError) throw userEventUsersError;

  const eventIds = userEventUsers?.map(eu => eu.event_id) || [];

  if (eventIds.length === 0) return;

  // Step 2: Fetch all event_users for those events
  let query = supabase
    .from('event_users')
    .select('*')
    .in('event_id', eventIds);

  // Apply watermark for incremental sync
  if (watermark) {
    query = query.gt('updated_at', watermark);
  }

  const { data, error } = await query.order('updated_at');

  if (error) throw error;

  if (data?.length) {
    const mapped = data.map(mapEventUserFromServer);
    await db.event_users.bulkPut(mapped);

    // Update watermark to latest timestamp
    const latestTimestamp = data[data.length - 1].updated_at;
    if (latestTimestamp) {
      await setWatermark('event_users', userId, latestTimestamp);
    }
  }
}
