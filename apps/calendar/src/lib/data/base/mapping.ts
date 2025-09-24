/**
 * Server-to-Client Type Mapping Functions
 * Single normalization point for all timestamp conversions
 */

import { pgToIso, toMs } from './time';
import type {
  ServerEventRow,
  ServerEventInsert,
  ServerEventUpdate,
  ServerEDPRow,
  ServerEventUserRoleRow,
  ServerUserProfileRow,
  ServerUserCalendarRow,
  ServerUserCategoryRow,
  ServerUserWorkPeriodRow,
  ServerAIPersonaRow
} from './server-types';
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

// Event mapping - normalize timestamps + compute milliseconds
export const mapEventFromServer = (row: ServerEventRow): ClientEventRow => {
  const normalizedStartTime = pgToIso(row.start_time)!;
  const normalizedEndTime = pgToIso(row.end_time)!;

  return {
    ...row,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
    created_at: pgToIso(row.created_at)!,
    updated_at: pgToIso(row.updated_at)!,
    // Pre-computed milliseconds for calendar operations
    start_time_ms: toMs(normalizedStartTime),
    end_time_ms: toMs(normalizedEndTime),
  };
};

// Event to server - prepare for insert/update
export const mapEventToServer = (
  client: Partial<ClientEventRow>
): Partial<ServerEventInsert> => {
  const { start_time_ms, end_time_ms, ...serverData } = client;
  return {
    ...serverData,
    // Keep ISO format for server (PostgreSQL handles ISO correctly)
    start_time: client.start_time,
    end_time: client.end_time,
  };
};

// Event Details Personal mapping
export const mapEDPFromServer = (row: ServerEDPRow): ClientEDPRow => ({
  ...row,
  updated_at: pgToIso(row.updated_at)!,
});

// Event User Roles mapping
export const mapEventUserRoleFromServer = (
  row: ServerEventUserRoleRow
): ClientEventUserRoleRow => ({
  ...row,
  updated_at: pgToIso(row.updated_at)!,
});

// User Profile mapping
export const mapUserProfileFromServer = (
  row: ServerUserProfileRow
): ClientUserProfileRow => ({
  ...row,
  created_at: pgToIso(row.created_at)!,
  updated_at: pgToIso(row.updated_at)!,
});

// User Calendar mapping
export const mapUserCalendarFromServer = (
  row: ServerUserCalendarRow
): ClientUserCalendarRow => ({
  ...row,
  created_at: pgToIso(row.created_at)!,
  updated_at: pgToIso(row.updated_at)!,
});

// User Category mapping
export const mapUserCategoryFromServer = (
  row: ServerUserCategoryRow
): ClientUserCategoryRow => ({
  ...row,
  created_at: pgToIso(row.created_at)!,
  updated_at: pgToIso(row.updated_at)!,
});

// User Work Period mapping
export const mapUserWorkPeriodFromServer = (
  row: ServerUserWorkPeriodRow
): ClientUserWorkPeriodRow => ({
  ...row,
  created_at: pgToIso(row.created_at)!,
  updated_at: pgToIso(row.updated_at)!,
});

// AI Persona mapping
export const mapAIPersonaFromServer = (
  row: ServerAIPersonaRow
): ClientAIPersonaRow => ({
  ...row,
  created_at: pgToIso(row.created_at)!,
  updated_at: pgToIso(row.updated_at)!,
});