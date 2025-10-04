// realtime/subscriptions.ts - Minimal version for logout cleanup only
// Note: v2 system uses centralized realtime sync in base/sync.ts via DataProvider

import { db } from '../base/dexie';

// Clear ALL data from local cache (for complete reset)
export async function clearAllData() {
  await db.transaction(
    'rw',
    [
      db.user_categories,
      db.user_calendars,
      db.user_profiles,
      db.user_work_periods,
      db.ai_personas,
      db.ai_threads,
      db.user_annotations,
      db.events,
      db.event_details_personal,
      db.event_users,
      db.event_rsvps,
      db.outbox,
      db.meta,
    ],
    async () => {
      await db.user_categories.clear();
      await db.user_calendars.clear();
      await db.user_profiles.clear();
      await db.user_work_periods.clear();
      await db.ai_personas.clear();
      await db.ai_threads.clear();
      await db.user_annotations.clear();
      await db.events.clear();
      await db.event_details_personal.clear();
      await db.event_users.clear();
      await db.event_rsvps.clear();
      await db.outbox.clear();
      await db.meta.clear();
    }
  );
}

// Clear user data from local cache
export async function clearUserData(userId: string) {
  await db.transaction(
    'rw',
    [
      // Core user data tables
      db.user_categories,
      db.user_calendars,
      db.user_profiles,
      db.user_work_periods,
      db.ai_personas,
      db.ai_threads,
      db.user_annotations,

      // Event tables
      db.events,
      db.event_details_personal,
      db.event_users,
      db.event_rsvps,

      // Sync infrastructure
      db.outbox,
      db.meta,
    ],
    async () => {
      // Clear core user data
      await db.user_categories.where('user_id').equals(userId).delete();
      await db.user_calendars.where('user_id').equals(userId).delete();
      await db.user_profiles.where('id').equals(userId).delete();
      await db.user_work_periods.where('user_id').equals(userId).delete();
      await db.ai_personas.where('user_id').equals(userId).delete();
      await db.ai_threads.where('user_id').equals(userId).delete();
      await db.user_annotations.where('user_id').equals(userId).delete();

      // Clear event data (events use owner_id instead of user_id)
      await db.events.where('owner_id').equals(userId).delete();
      await db.event_details_personal.where('user_id').equals(userId).delete();
      await db.event_users.where('user_id').equals(userId).delete();
      await db.event_rsvps.where('user_id').equals(userId).delete();

      // Clear sync infrastructure for this user
      await db.outbox.where('user_id').equals(userId).delete();
      // Clear meta table sync watermarks to ensure fresh sync for next user
      await db.meta.where('key').startsWith(`${userId}:`).delete();
    }
  );
}
