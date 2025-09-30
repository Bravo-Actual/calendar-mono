// data-v2/base/dexie.ts - Clean offline-first Dexie setup per plan
import Dexie, { type Table } from 'dexie';
import type {
  ClientAnnotation,
  ClientCalendar,
  ClientCategory,
  ClientEDP,
  ClientEvent,
  ClientEventRsvp,
  ClientEventUser,
  ClientPersona,
  ClientUserProfile,
  ClientUserWorkPeriod,
} from '../../data/base/client-types';

// Outbox operation interface (per plan specification)
export interface OutboxOperation {
  id: string;
  user_id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload: any;
  created_at: string;
  attempts: number;
  _error?: string;
}

// Meta table for sync watermarks
export interface MetaRow {
  key: string;
  value: any;
}

// Offline-first database schema (following plan structure)
export class OfflineDB extends Dexie {
  // Core tables
  user_categories!: Table<ClientCategory, string>;
  user_calendars!: Table<ClientCalendar, string>;
  user_profiles!: Table<ClientUserProfile, string>;
  user_work_periods!: Table<ClientUserWorkPeriod, string>;
  ai_personas!: Table<ClientPersona, string>;
  user_annotations!: Table<ClientAnnotation, string>;

  // Event tables
  events!: Table<ClientEvent, string>;
  event_details_personal!: Table<ClientEDP, [string, string]>; // Composite key: [event_id, user_id]
  event_users!: Table<ClientEventUser, [string, string]>; // Composite key: [event_id, user_id]
  event_rsvps!: Table<ClientEventRsvp, [string, string]>; // Composite key: [event_id, user_id]

  // Sync infrastructure
  outbox!: Table<OutboxOperation, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'calendar-db-v2') {
    super(name);

    this.version(6).stores({
      // Categories with compound indexes per plan
      user_categories: 'id, user_id, updated_at',

      // Calendars with compound indexes
      user_calendars: 'id, user_id, updated_at, type, visible',

      // User profiles
      user_profiles: 'id, updated_at',

      // User work periods
      user_work_periods: 'id, user_id, updated_at',

      // AI personas
      ai_personas: 'id, user_id, updated_at',

      // User annotations with compound indexes for time range queries
      user_annotations: 'id, user_id, updated_at, type, visible, start_time_ms, end_time_ms',

      // Events with time range indexes for calendar queries
      events: 'id, owner_id, updated_at, start_time_ms, end_time_ms, series_id',

      // Event details personal with composite primary key
      event_details_personal:
        '[event_id+user_id], event_id, user_id, updated_at, calendar_id, category_id',

      // Event users with composite primary key
      event_users: '[event_id+user_id], event_id, user_id, updated_at, role',

      // Event RSVPs with composite primary key
      event_rsvps: '[event_id+user_id], event_id, user_id, updated_at, rsvp_status, following',

      // Outbox per plan spec: 'id, user_id, table, op, created_at, attempts'
      outbox: 'id, user_id, table, op, created_at, attempts',

      // Meta for sync watermarks
      meta: 'key',
    });
  }
}

// HMR-safe singleton per plan specification
declare global {
  var __appDb: OfflineDB | undefined;
}

export const db = globalThis.__appDb ?? new OfflineDB();
if (!globalThis.__appDb) globalThis.__appDb = db;
