// base/mapping.ts

import type {
  ClientAnnotation,
  ClientCalendar,
  ClientCategory,
  ClientEDP,
  ClientEvent,
  ClientEventRsvp,
  ClientEventUser,
  ClientPersona,
  ClientThread,
  ClientUserProfile,
  ClientUserWorkPeriod,
} from './client-types';
import type {
  ServerAnnotation,
  ServerCalendar,
  ServerCategory,
  ServerEDP,
  ServerEDPInsert,
  ServerEvent,
  ServerEventRsvp,
  ServerEventUser,
  ServerPersona,
  ServerThread,
  ServerUserProfile,
  ServerUserWorkPeriod,
} from './server-types';

// Convert server ISO strings to client Date objects
const toISO = (s: string | null | undefined): Date | null => (s ? new Date(s) : null);

// Convert client Date objects back to server ISO strings
const fromISO = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export const mapEventFromServer = (row: ServerEvent): ClientEvent => ({
  ...row,
  start_time: toISO(row.start_time) as Date,
  end_time: toISO(row.end_time) as Date,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
  // Supabase bigint often comes back as string → normalize
  start_time_ms: Number(row.start_time_ms),
  end_time_ms: Number(row.end_time_ms),
});

export const mapEventToServer = (
  event: ClientEvent
): Omit<ServerEvent, 'start_time_ms' | 'end_time_ms'> => {
  const { start_time_ms, end_time_ms, ...eventWithoutComputed } = event;
  return {
    ...eventWithoutComputed,
    start_time: fromISO(event.start_time) as string,
    end_time: fromISO(event.end_time) as string,
    created_at: fromISO(event.created_at) as string,
    updated_at: fromISO(event.updated_at) as string,
  };
};

// Map resolved event data to edge function payload format
export const mapEventResolvedToServer = (
  event: ClientEvent,
  personalDetails?: Partial<ServerEDPInsert>
) => {
  const eventPayload = mapEventToServer(event);

  return {
    ...eventPayload,
    ...(personalDetails && { personal_details: personalDetails }),
  };
};

export const mapEDPFromServer = (row: ServerEDP): ClientEDP => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapEventUserFromServer = (row: ServerEventUser): ClientEventUser => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapEventRsvpFromServer = (row: ServerEventRsvp): ClientEventRsvp => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapAnnotationFromServer = (row: ServerAnnotation): ClientAnnotation => ({
  ...row,
  start_time: toISO(row.start_time) as Date,
  end_time: toISO(row.end_time) as Date,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
  expires_at: toISO(row.expires_at),
  // Supabase bigint often comes back as string → normalize
  start_time_ms: Number(row.start_time_ms),
  end_time_ms: Number(row.end_time_ms),
});

export const mapUserProfileFromServer = (row: ServerUserProfile): ClientUserProfile => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapCalendarFromServer = (row: ServerCalendar): ClientCalendar => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapCategoryFromServer = (row: ServerCategory): ClientCategory => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapPersonaFromServer = (row: ServerPersona): ClientPersona => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapThreadFromServer = (row: ServerThread): ClientThread => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

export const mapUserWorkPeriodFromServer = (row: ServerUserWorkPeriod): ClientUserWorkPeriod => ({
  ...row,
  created_at: toISO(row.created_at) as Date,
  updated_at: toISO(row.updated_at) as Date,
});

// Bidirectional mapping functions for sync operations
export const mapAnnotationToServer = (annotation: ClientAnnotation): ServerAnnotation => ({
  ...annotation,
  start_time: fromISO(annotation.start_time) as string,
  end_time: fromISO(annotation.end_time) as string,
  created_at: fromISO(annotation.created_at) as string,
  updated_at: fromISO(annotation.updated_at) as string,
  expires_at: fromISO(annotation.expires_at),
});

export const mapUserProfileToServer = (profile: ClientUserProfile): ServerUserProfile => ({
  ...profile,
  created_at: fromISO(profile.created_at) as string,
  updated_at: fromISO(profile.updated_at) as string,
});

export const mapCalendarToServer = (calendar: ClientCalendar): ServerCalendar => ({
  ...calendar,
  created_at: fromISO(calendar.created_at) as string,
  updated_at: fromISO(calendar.updated_at) as string,
});

export const mapCategoryToServer = (category: ClientCategory): ServerCategory => ({
  ...category,
  created_at: fromISO(category.created_at) as string,
  updated_at: fromISO(category.updated_at) as string,
});

export const mapPersonaToServer = (persona: ClientPersona): ServerPersona => ({
  ...persona,
  created_at: fromISO(persona.created_at) as string,
  updated_at: fromISO(persona.updated_at) as string,
});

export const mapEDPToServer = (edp: ClientEDP): ServerEDP => ({
  ...edp,
  created_at: fromISO(edp.created_at) as string,
  updated_at: fromISO(edp.updated_at) as string,
});

export const mapUserWorkPeriodToServer = (
  workPeriod: ClientUserWorkPeriod
): ServerUserWorkPeriod => ({
  ...workPeriod,
  created_at: fromISO(workPeriod.created_at) as string,
  updated_at: fromISO(workPeriod.updated_at) as string,
});

export const mapEventUserToServer = (eventUser: ClientEventUser): ServerEventUser => ({
  ...eventUser,
  created_at: fromISO(eventUser.created_at) as string,
  updated_at: fromISO(eventUser.updated_at) as string,
});

export const mapEventRsvpToServer = (eventRsvp: ClientEventRsvp): ServerEventRsvp => ({
  ...eventRsvp,
  created_at: fromISO(eventRsvp.created_at) as string,
  updated_at: fromISO(eventRsvp.updated_at) as string,
});
