// base/dexie.ts
import Dexie, { type Table } from 'dexie';
import type {
  ClientAnnotation,
  ClientCalendar,
  ClientCategory,
  ClientEDP,
  ClientEvent,
  ClientPersona,
  ClientUserProfile,
} from './client-types';

export class AppDB extends Dexie {
  events!: Table<ClientEvent, string>;
  event_details_personal!: Table<ClientEDP, [string, string]>; // [event_id+user_id]
  user_profiles!: Table<ClientUserProfile, string>;
  user_calendars!: Table<ClientCalendar, string>;
  user_categories!: Table<ClientCategory, string>;
  ai_personas!: Table<ClientPersona, string>;
  user_annotations!: Table<ClientAnnotation, string>;

  constructor() {
    super('calendar-db');

    this.version(9).stores({
      events: 'id, owner_id, start_time_ms, end_time_ms, updated_at, [owner_id+start_time_ms]',
      event_details_personal: '[event_id+user_id], user_id, calendar_id, category_id, updated_at',
      user_profiles: 'id, updated_at',
      user_calendars: 'id, user_id, type, is_default, updated_at',
      user_categories: 'id, user_id, is_default, updated_at',
      ai_personas: 'id, user_id, is_default, updated_at',
      user_annotations:
        'id, user_id, type, start_time_ms, end_time_ms, event_id, visible, updated_at, [user_id+start_time_ms]',
    });
  }
}

export const db = new AppDB();
