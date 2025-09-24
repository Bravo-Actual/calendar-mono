/**
 * Client Types - Normalized types for runtime use
 * These have ISO timestamps and pre-computed millisecond values
 */

import type { ISODateString, Millis } from './time';
import type {
  ServerEventRow,
  ServerEDPRow,
  ServerEventUserRoleRow,
  ServerUserProfileRow,
  ServerUserCalendarRow,
  ServerUserCategoryRow,
  ServerUserWorkPeriodRow,
  ServerAIPersonaRow
} from './server-types';

// Event with normalized timestamps + pre-computed milliseconds
export type ClientEventRow = Omit<
  ServerEventRow,
  'start_time' | 'end_time' | 'created_at' | 'updated_at'
> & {
  start_time: ISODateString;
  end_time: ISODateString;
  created_at: ISODateString;
  updated_at: ISODateString;
  // Pre-computed milliseconds for calendar operations
  start_time_ms: Millis;
  end_time_ms: Millis;
};

// Event details personal with normalized timestamps
export type ClientEDPRow = Omit<ServerEDPRow, 'updated_at'> & {
  updated_at: ISODateString;
};

// Event user roles with normalized timestamps
export type ClientEventUserRoleRow = Omit<ServerEventUserRoleRow, 'updated_at'> & {
  updated_at: ISODateString;
};

// User profile with normalized timestamps
export type ClientUserProfileRow = Omit<
  ServerUserProfileRow,
  'created_at' | 'updated_at'
> & {
  created_at: ISODateString;
  updated_at: ISODateString;
};

// User calendar with normalized timestamps
export type ClientUserCalendarRow = Omit<
  ServerUserCalendarRow,
  'created_at' | 'updated_at'
> & {
  created_at: ISODateString;
  updated_at: ISODateString;
};

// User category with normalized timestamps
export type ClientUserCategoryRow = Omit<
  ServerUserCategoryRow,
  'created_at' | 'updated_at'
> & {
  created_at: ISODateString;
  updated_at: ISODateString;
};

// User work periods with normalized timestamps
export type ClientUserWorkPeriodRow = Omit<
  ServerUserWorkPeriodRow,
  'created_at' | 'updated_at'
> & {
  created_at: ISODateString;
  updated_at: ISODateString;
};

// AI persona with normalized timestamps
export type ClientAIPersonaRow = Omit<
  ServerAIPersonaRow,
  'created_at' | 'updated_at'
> & {
  created_at: ISODateString;
  updated_at: ISODateString;
};