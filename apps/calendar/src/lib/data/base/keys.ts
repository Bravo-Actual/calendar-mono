/**
 * Deterministic Query Key Factory
 * Consistent query keys across all data domains
 */

export const keys = {
  // User profile
  profile: (uid: string) => ['profile', { uid }] as const,

  // User calendars
  calendars: (uid: string) => ['calendars', { uid }] as const,

  // User categories
  categories: (uid: string) => ['categories', { uid }] as const,

  // User work periods
  workPeriods: (uid: string) => ['workPeriods', { uid }] as const,

  // AI personas
  personas: (uid: string) => ['personas', { uid }] as const,

  // Events with optional range filtering
  events: (uid: string, range?: { from: number; to: number }) =>
    ['events', { uid, ...range }] as const,

  // Event details personal
  eventDetails: (uid: string) => ['eventDetails', { uid }] as const,

  // Event attendees
  eventAttendees: (eventId: string) => ['eventAttendees', { eventId }] as const,

  // Event user roles
  eventRoles: (uid: string) => ['eventRoles', { uid }] as const,
} as const;

// Type helpers for query key inference
export type QueryKeys = typeof keys;
export type ProfileKey = ReturnType<typeof keys.profile>;
export type CalendarsKey = ReturnType<typeof keys.calendars>;
export type CategoriesKey = ReturnType<typeof keys.categories>;
export type EventsKey = ReturnType<typeof keys.events>;