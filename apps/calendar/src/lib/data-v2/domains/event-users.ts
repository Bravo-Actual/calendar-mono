// data-v2/domains/event-users.ts - Event Users offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientEventUser, ClientUserProfile } from '../base/client-types';
import { db } from '../base/dexie';
import { mapEventUserFromServer } from '../base/mapping';
import { pullTable } from '../base/sync';

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
  return pullTable('event_users', userId, mapEventUserFromServer);
}
