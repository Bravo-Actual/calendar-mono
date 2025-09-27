// base/client-types.ts
import type {
  ServerEvent,
  ServerEDP,
  ServerEventUser,
  ServerEventRsvp,
  ServerUserProfile,
  ServerCalendar,
  ServerCategory,
  ServerPersona,
  ServerAnnotation,
  ServerUserWorkPeriod
} from './server-types';

export type ISO = Date; // Date object (converted from server ISO strings)

export type ClientEvent = Omit<ServerEvent,
  'start_time' | 'end_time' | 'created_at' | 'updated_at' | 'start_time_ms' | 'end_time_ms'
> & {
  start_time: ISO;
  end_time:   ISO;
  created_at: ISO;
  updated_at: ISO;
  // ms columns come from DB as nullable, but we store as numbers locally
  start_time_ms: number;
  end_time_ms:   number;
};

export type ClientEDP = Omit<ServerEDP, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientEventUser = Omit<ServerEventUser, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientEventRsvp = Omit<ServerEventRsvp, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientAnnotation = Omit<ServerAnnotation,
  'start_time' | 'end_time' | 'created_at' | 'updated_at'
> & {
  start_time: ISO;
  end_time: ISO;
  created_at: ISO;
  updated_at: ISO;
  // ms columns come from DB as generated columns, nullable
  start_time_ms: number | null;
  end_time_ms: number | null;
};

export type ClientUserProfile = Omit<ServerUserProfile, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientCalendar = Omit<ServerCalendar, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientCategory = Omit<ServerCategory, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientPersona = Omit<ServerPersona, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};

export type ClientUserWorkPeriod = Omit<ServerUserWorkPeriod, 'created_at' | 'updated_at'> & {
  created_at: ISO;
  updated_at: ISO;
};


// V2 Resolved event type combining all event-related tables
export type EventResolved = ClientEvent & {
  // Personal details (from event_details_personal)
  personal_details: ClientEDP | null;

  // User role for this event (from event_users)
  user_role: ClientEventUser | null;

  // RSVP status for this event (from event_rsvps)
  rsvp: ClientEventRsvp | null;

  // UI convenience lookups
  calendar: { id: string; name: string; color: string } | null;
  category: { id: string; name: string; color: string } | null;

  // Computed convenience fields
  role: 'owner' | 'attendee' | 'viewer' | 'contributor' | 'delegate_full';
  following: boolean;
};