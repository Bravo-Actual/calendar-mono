// realtime/subscriptions.ts - Minimal version for logout cleanup only
// Note: v2 system uses centralized realtime sync in base/sync.ts via DataProvider

import { db } from '../base/dexie';

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
      await db.user_annotations.where('user_id').equals(userId).delete();

      // Clear event data (events use owner_id instead of user_id)
      await db.events.where('owner_id').equals(userId).delete();
      await db.event_details_personal.where('user_id').equals(userId).delete();
      await db.event_users.where('user_id').equals(userId).delete();
      await db.event_rsvps.where('user_id').equals(userId).delete();

      // Clear sync infrastructure for this user
      await db.outbox.where('user_id').equals(userId).delete();
      // Note: meta table contains sync watermarks - consider if we want to clear these
      // await db.meta.where('key').startsWith(`${userId}:`).delete();
    }
  );
}
