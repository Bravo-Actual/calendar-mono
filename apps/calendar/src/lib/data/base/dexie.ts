import Dexie, { Table } from 'dexie';
import type {
  ClientEventRow,
  ClientEDPRow,
  ClientEventUserRoleRow,
  ClientUserProfileRow,
  ClientUserCalendarRow,
  ClientUserCategoryRow,
  ClientUserWorkPeriodRow,
  ClientAIPersonaRow
} from './client-types';

// Use normalized client types for Dexie storage
export type Event = ClientEventRow;
export type EventDetailsPersonal = ClientEDPRow;
export type EventUserRole = ClientEventUserRoleRow;
export type UserProfile = ClientUserProfileRow;
export type UserCalendar = ClientUserCalendarRow;
export type UserCategory = ClientUserCategoryRow;
export type UserWorkPeriod = ClientUserWorkPeriodRow;
export type AIPersona = ClientAIPersonaRow;

// Type aliases for convenience
export type UUID = string;

export class AppDB extends Dexie {
  // User data tables
  user_profiles!: Table<UserProfile, UUID>;
  user_categories!: Table<UserCategory, UUID>;
  user_calendars!: Table<UserCalendar, UUID>;
  user_work_periods!: Table<UserWorkPeriod, UUID>;
  ai_personas!: Table<AIPersona, UUID>;

  // Event base tables - no more flattened view!
  events!: Table<Event, UUID>;
  event_details_personal!: Table<EventDetailsPersonal, [UUID, UUID]>; // Composite key: [event_id, user_id]
  event_user_roles!: Table<EventUserRole, UUID>;

  constructor() {
    super('calendar-app'); // IndexedDB database name
    this.version(6).stores({ // Increment version for schema migration (removed _ms fields)
      // User data tables - indexed by user_id for fast per-user queries
      user_profiles: 'id, email, slug, timezone, time_format, week_start_day, updated_at',
      user_categories: 'id, user_id, name, color, is_default, updated_at',
      user_calendars: 'id, user_id, name, color, type, visible, updated_at',
      user_work_periods: 'id, user_id, weekday, start_time, end_time, updated_at',
      ai_personas: 'id, user_id, name, is_default, updated_at',

      // Event base tables - direct from database, no more views
      events: 'id, owner_id, creator_id, series_id, start_time, end_time, all_day, updated_at',
      event_details_personal: '[event_id+user_id], event_id, user_id, calendar_id, category_id, show_time_as, ai_managed, updated_at',
      event_user_roles: 'id, event_id, user_id, invite_type, rsvp, role, following, updated_at',
    });
  }
}

// Export singleton instance
export const db = new AppDB();