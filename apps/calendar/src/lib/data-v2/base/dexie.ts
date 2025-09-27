// data-v2/base/dexie.ts - Clean offline-first Dexie setup per plan
import Dexie, { Table } from 'dexie';
import type { ClientCategory, ClientCalendar, ClientUserProfile } from '../../data/base/client-types';

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

  // Sync infrastructure
  outbox!: Table<OutboxOperation, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'calendar-db-v2') {
    super(name);

    this.version(2).stores({
      // Categories with compound indexes per plan
      user_categories: 'id, user_id, updated_at',

      // Calendars with compound indexes
      user_calendars: 'id, user_id, updated_at, type, visible',

      // User profiles
      user_profiles: 'id, updated_at',

      // Outbox per plan spec: 'id, user_id, table, op, created_at, attempts'
      outbox: 'id, user_id, table, op, created_at, attempts',

      // Meta for sync watermarks
      meta: 'key'
    });
  }
}

// HMR-safe singleton per plan specification
declare global {
  var __appDb: OfflineDB | undefined;
}

export const db = globalThis.__appDb ?? new OfflineDB();
if (!globalThis.__appDb) globalThis.__appDb = db;