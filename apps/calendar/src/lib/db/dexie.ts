import Dexie, { Table } from 'dexie';
import type { Database } from '@repo/supabase';

// Use existing Supabase generated types - no duplicates!
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserCalendar = Database['public']['Tables']['user_calendars']['Row'];
export type UserCategory = Database['public']['Tables']['user_categories']['Row'];

// Type aliases for convenience
export type UUID = string;

export class AppDB extends Dexie {
  user_profiles!: Table<UserProfile, UUID>;
  user_categories!: Table<UserCategory, UUID>;
  user_calendars!: Table<UserCalendar, UUID>;

  constructor() {
    super('calendar-app'); // IndexedDB database name
    this.version(1).stores({
      // Primary key + indexed fields for fast queries
      // Index by user_id for fast per-user queries
      // Index by updated_at for potential incremental sync (future)
      user_profiles: 'id, email, slug, timezone, time_format, week_start_day',
      user_categories: 'id, user_id, name, color, is_default, updated_at',
      user_calendars: 'id, user_id, name, color, is_default, visible, updated_at',
    });
  }
}

// Export singleton instance
export const db = new AppDB();