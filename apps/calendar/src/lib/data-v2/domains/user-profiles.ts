// data-v2/domains/user-profiles.ts - Offline-first user profiles implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientUserProfile } from '../base/client-types';
import { db } from '../base/dexie';
import { mapUserProfileFromServer, mapUserProfileToServer } from '../base/mapping';
import { addToOutboxWithMerging } from '../base/outbox-utils';
import { pullTable } from '../base/sync';
import { generateUUID } from '../base/utils';
import { UserProfileSchema, validateBeforeEnqueue } from '../base/validators';

// Read hooks using useLiveQuery (instant, reactive)
export function useUserProfile(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientUserProfile | undefined> => {
    if (!uid) return undefined;
    return await db.user_profiles.get(uid);
  }, [uid]);
}

// Search user profiles by name or email (SERVER-SIDE)
export function useUserProfileSearch(searchQuery: string | undefined) {
  return useLiveQuery(async (): Promise<ClientUserProfile[]> => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];

    const query = searchQuery.toLowerCase().trim();

    // Search on server via Supabase REST API
    try {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Use ilike for case-insensitive search on multiple fields
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .or(`display_name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('Error searching user profiles:', error);
        return [];
      }

      // Map server data to client format
      return (data || []).map(mapUserProfileFromServer);
    } catch (error) {
      console.error('Error searching user profiles:', error);
      return [];
    }
  }, [searchQuery]);
}

// Dexie-first mutations with outbox pattern
export async function updateUserProfile(
  uid: string,
  input: {
    first_name?: string;
    last_name?: string;
    display_name?: string | null;
    title?: string | null;
    organization?: string | null;
    avatar_url?: string | null;
    timezone?: string | null;
    time_format?: '12_hour' | '24_hour' | null;
    week_start_day?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | null;
  }
): Promise<void> {
  // 1. Get existing profile from Dexie
  const existing = await db.user_profiles.get(uid);
  if (!existing) {
    throw new Error('User profile not found');
  }

  const now = new Date();
  const updated: ClientUserProfile = {
    ...existing,
    ...input,
    user_id: uid, // Ensure user_id is always set
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedProfile = validateBeforeEnqueue(UserProfileSchema, updated);

  // 3. Write to Dexie first (instant optimistic update)
  await db.user_profiles.put(validatedProfile);

  // 4. Enqueue in outbox for eventual server sync
  const serverPayload = mapUserProfileToServer(validatedProfile);
  await addToOutboxWithMerging(uid, 'user_profiles', 'update', serverPayload, uid);
}

// Data sync functions (called by DataProvider)
export async function pullUserProfiles(uid: string): Promise<void> {
  return pullTable('user_profiles', uid, mapUserProfileFromServer);
}
