// base/mapping.ts
import type {
  ServerEvent,
  ServerEDP,
  ServerUserProfile,
  ServerCalendar,
  ServerCategory,
  ServerPersona,
  ServerAnnotation
} from './server-types';
import type {
  ClientEvent,
  ClientEDP,
  ClientUserProfile,
  ClientCalendar,
  ClientCategory,
  ClientPersona,
  ClientAnnotation
} from './client-types';

const toISO = (s: string | null | undefined) => (s ? new Date(s).toISOString() : s ?? null);

export const mapEventFromServer = (row: ServerEvent): ClientEvent => ({
  ...row,
  start_time: toISO(row.start_time)!,
  end_time:   toISO(row.end_time)!,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
  // Supabase bigint often comes back as string → normalize
  start_time_ms: Number(row.start_time_ms),
  end_time_ms:   Number(row.end_time_ms),
});

export const mapEDPFromServer = (row: ServerEDP): ClientEDP => ({
  ...row,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
});

export const mapAnnotationFromServer = (row: ServerAnnotation): ClientAnnotation => ({
  ...row,
  start_time: toISO(row.start_time)!,
  end_time: toISO(row.end_time)!,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
  // Supabase bigint often comes back as string → normalize
  start_time_ms: Number(row.start_time_ms),
  end_time_ms: Number(row.end_time_ms),
});

export const mapUserProfileFromServer = (row: ServerUserProfile): ClientUserProfile => ({
  ...row,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
});

export const mapCalendarFromServer = (row: ServerCalendar): ClientCalendar => ({
  ...row,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
});

export const mapCategoryFromServer = (row: ServerCategory): ClientCategory => ({
  ...row,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
});

export const mapPersonaFromServer = (row: ServerPersona): ClientPersona => ({
  ...row,
  created_at: toISO(row.created_at)!,
  updated_at: toISO(row.updated_at)!,
});