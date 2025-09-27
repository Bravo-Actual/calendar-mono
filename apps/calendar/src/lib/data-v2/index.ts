// data-v2/index.ts - Clean offline-first data layer exports

// Core infrastructure
export { db } from './base/dexie';
export { supabase } from './base/client';
export type { ClientCategory, ClientCalendar, ClientUserProfile, ClientUserWorkPeriod, ClientPersona, ClientAnnotation, ClientEvent, ClientEDP, ClientEventUser, ClientEventRsvp, EventResolved } from '../data/base/client-types';
export { useSyncStatus } from './base/useSyncStatus';
export { startSync, stopSync, pushOutbox, pullTable } from './base/sync';

// Providers
export { DataProvider } from './providers/DataProvider';

// Categories domain
export {
  useUserCategories,
  useUserCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  pullCategories,
} from './domains/categories';

// Calendars domain
export {
  useUserCalendars,
  useUserCalendar,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  pullCalendars,
} from './domains/calendars';

// User profiles domain
export {
  useUserProfile,
  updateUserProfile,
  pullUserProfiles,
} from './domains/user-profiles';

// User work periods domain
export {
  useUserWorkPeriods,
  useUserWorkPeriod,
  createUserWorkPeriod,
  updateUserWorkPeriod,
  deleteUserWorkPeriod,
  pullUserWorkPeriods,
} from './domains/user-work-periods';

// AI personas domain
export {
  useAIPersonas,
  useAIPersona,
  createAIPersona,
  updateAIPersona,
  deleteAIPersona,
  pullAIPersonas,
} from './domains/ai-personas';

// User annotations domain
export {
  useUserAnnotations,
  useAnnotationsRange,
  useUserAnnotation,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  createEventHighlight,
  createTimeHighlight,
  toggleAnnotationVisibility,
  pullAnnotations,
} from './domains/user-annotations';

// Events domain (read hooks and sync only - use eventResolved for mutations)
export {
  useEvents,
  useEvent,
  pullEvents,
} from './domains/events';

// Event Details Personal domain (read hooks and sync only - use eventResolved for mutations)
export {
  useEventDetailsPersonal,
  useEventDetailPersonal,
  useEventDetailsPersonalByEvents,
  pullEventDetailsPersonal,
} from './domains/event-details-personal';

// Event Users domain (read hooks and sync only - use eventResolved for mutations)
export {
  useEventUsers,
  useEventUser,
  useEventUsersByEvent,
  pullEventUsers,
} from './domains/event-users';

// Event RSVPs domain (read hooks and sync only - use eventResolved for mutations)
export {
  useEventRsvps,
  useEventRsvp,
  useEventRsvpsByEvent,
  pullEventRsvps,
} from './domains/event-rsvps';

// Events Resolved domain (combined operations)
export {
  useEventsResolved,
  useEventResolved,
  useEventsResolvedRange,
  createEventResolved,
  updateEventResolved,
  deleteEventResolved,
} from './domains/events-resolved';

// Avatar uploads
export {
  uploadUserProfileAvatar,
  uploadAIPersonaAvatar,
  deleteUserProfileAvatar,
  deleteAIPersonaAvatar,
} from './domains/avatar-uploads';

// Validation (for extending to other domains)
export {
  CategorySchema,
  UserProfileSchema,
  PersonaSchema,
  CalendarSchema,
  EventSchema,
  EventPersonalSchema,
  EventUserSchema,
  EventRsvpSchema,
  AnnotationSchema,
  UserWorkPeriodSchema,
  validateBeforeEnqueue,
} from './base/validators';