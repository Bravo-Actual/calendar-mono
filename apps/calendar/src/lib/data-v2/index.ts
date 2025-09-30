// data-v2/index.ts - Clean offline-first data layer exports

// Supabase client (for direct operations when needed)
export { supabase } from '../supabase';
export type {
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
  EventResolved,
} from './base/client-types';
// Core infrastructure
export { db } from './base/dexie';
export { pullTable, pushOutbox, startSync, stopSync } from './base/sync';
export { useSyncStatus } from './base/useSyncStatus';
// Validation (for extending to other domains)
export {
  AnnotationSchema,
  CalendarSchema,
  CategorySchema,
  EventPersonalSchema,
  EventRsvpSchema,
  EventSchema,
  EventUserSchema,
  PersonaSchema,
  UserProfileSchema,
  UserWorkPeriodSchema,
  validateBeforeEnqueue,
} from './base/validators';
// AI personas domain
export {
  createAIPersona,
  deleteAIPersona,
  pullAIPersonas,
  updateAIPersona,
  useAIPersona,
  useAIPersonas,
} from './domains/ai-personas';
// Avatar uploads
export {
  deleteAIPersonaAvatar,
  deleteUserProfileAvatar,
  uploadAIPersonaAvatar,
  uploadUserProfileAvatar,
} from './domains/avatar-uploads';
// Calendars domain
export {
  createCalendar,
  deleteCalendar,
  pullCalendars,
  updateCalendar,
  useUserCalendar,
  useUserCalendars,
} from './domains/calendars';
// Categories domain
export {
  createCategory,
  deleteCategory,
  pullCategories,
  updateCategory,
  useUserCategories,
  useUserCategory,
} from './domains/categories';
// Event Details Personal domain (read hooks and sync only - use eventResolved for mutations)
export {
  pullEventDetailsPersonal,
  useEventDetailPersonal,
  useEventDetailsPersonal,
  useEventDetailsPersonalByEvents,
} from './domains/event-details-personal';
// Event RSVPs domain (read hooks and sync only - use eventResolved for mutations)
export {
  pullEventRsvps,
  useEventRsvp,
  useEventRsvps,
  useEventRsvpsByEvent,
} from './domains/event-rsvps';
// Event Users domain (read hooks and sync only - use eventResolved for mutations)
export {
  pullEventUsers,
  useEventUser,
  useEventUsers,
  useEventUsersByEvent,
} from './domains/event-users';
// Events domain (read hooks and sync only - use eventResolved for mutations)
export {
  pullEvents,
  useEvent,
  useEvents,
} from './domains/events';
// Events Resolved domain (combined operations)
export {
  createEventResolved,
  deleteEventResolved,
  updateEventResolved,
  useEventResolved,
  useEventsResolved,
  useEventsResolvedRange,
} from './domains/events-resolved';
// User annotations domain
export {
  createAnnotation,
  createEventHighlight,
  createTimeHighlight,
  deleteAnnotation,
  pullAnnotations,
  toggleAnnotationVisibility,
  updateAnnotation,
  useAnnotationsRange,
  useEventHighlightsMap,
  useUserAnnotation,
  useUserAnnotations,
} from './domains/user-annotations';
// User profiles domain
export {
  pullUserProfiles,
  updateUserProfile,
  useUserProfile,
} from './domains/user-profiles';
// User work periods domain
export {
  createUserWorkPeriod,
  deleteUserWorkPeriod,
  pullUserWorkPeriods,
  updateUserWorkPeriod,
  useUserWorkPeriod,
  useUserWorkPeriods,
} from './domains/user-work-periods';
// Providers
export { DataProvider } from './providers/DataProvider';
// Realtime subscriptions
export { clearAllData, clearUserData } from './realtime/subscriptions';
