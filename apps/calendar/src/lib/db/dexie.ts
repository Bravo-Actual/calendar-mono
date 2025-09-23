import Dexie, { Table } from 'dexie';
import type { Database } from '@repo/supabase';

// Use existing Supabase generated types - no duplicates!
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserCalendar = Database['public']['Tables']['user_calendars']['Row'];
export type UserCategory = Database['public']['Tables']['user_categories']['Row'];

// Calendar Events from the flattened view
export interface CalendarEvent {
  // Core event fields
  id: string;
  owner_id: string;
  creator_id: string;
  series_id?: string;
  title: string;
  agenda?: string;
  online_event: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person: boolean;
  start_time: string; // ISO timestamp
  duration: number; // minutes
  all_day: boolean;
  private: boolean;
  request_responses: boolean;
  allow_forwarding: boolean;
  invite_allow_reschedule_proposals: boolean;
  hide_attendees: boolean;
  history: unknown[]; // JSON array
  discovery: string;
  join_model: string;
  created_at: string;
  updated_at: string;

  // User perspective fields
  viewing_user_id: string;

  // User role information
  user_role: string;
  invite_type?: string;
  rsvp?: string;
  rsvp_timestamp?: string;
  attendance_type?: string;
  following: boolean;

  // User personal details
  calendar_id?: string;
  calendar_name?: string;
  calendar_color?: string;
  show_time_as: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  time_defense_level: string;
  ai_managed: boolean;
  ai_instructions?: string;

  // Computed fields
  start_time_iso: string;
  start_timestamp_ms: number;
  end_timestamp_ms: number;
  ai_suggested: boolean;
}

// Type aliases for convenience
export type UUID = string;

export class AppDB extends Dexie {
  user_profiles!: Table<UserProfile, UUID>;
  user_categories!: Table<UserCategory, UUID>;
  user_calendars!: Table<UserCalendar, UUID>;
  calendar_events!: Table<CalendarEvent, UUID>;

  constructor() {
    super('calendar-app'); // IndexedDB database name
    this.version(2).stores({ // Increment version for calendar events schema
      // Primary key + indexed fields for fast queries
      // Index by user_id for fast per-user queries
      // Index by updated_at for potential incremental sync (future)
      user_profiles: 'id, email, slug, timezone, time_format, week_start_day',
      user_categories: 'id, user_id, name, color, is_default, updated_at',
      user_calendars: 'id, user_id, name, color, is_default, visible, updated_at',
      // Calendar events with indexes for efficient date range queries
      calendar_events: 'id, viewing_user_id, start_timestamp_ms, end_timestamp_ms, owner_id, calendar_id, category_id, updated_at',
    });
  }
}

// Export singleton instance
export const db = new AppDB();