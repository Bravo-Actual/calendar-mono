// base/client-types.ts
import type {
  ServerEvent,
  ServerEDP,
  ServerUserProfile,
  ServerCalendar,
  ServerCategory,
  ServerPersona,
  ServerAnnotation,
  ServerUserWorkPeriod
} from './server-types';

export type ISO = string; // ISO UTC string

export type ClientEvent = Omit<ServerEvent,
  'start_time' | 'end_time' | 'created_at' | 'updated_at'
> & {
  start_time: ISO;
  end_time:   ISO;
  created_at: ISO;
  updated_at: ISO;
  // ms columns come from DB, but we store as numbers locally
  start_time_ms: number;
  end_time_ms:   number;
};

export type ClientEDP = Omit<ServerEDP, 'created_at' | 'updated_at'> & {
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
  // ms columns come from DB, but we store as numbers locally
  start_time_ms: number;
  end_time_ms: number;
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

// Rich, assembled event the UI consumes
export type AssembledEvent = ClientEvent & {
  // Personal details (with defaults)
  show_time_as: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
  time_defense_level: 'flexible' | 'normal' | 'high' | 'hard_block';
  ai_managed: boolean;
  ai_instructions: string | null;

  // Lookups (optional enrichments)
  calendar: { id: string; name: string; color: string } | null;
  category: { id: string; name: string; color: string } | null;

  // Convenience flags
  role: 'owner' | 'viewer';
  following: boolean;
};