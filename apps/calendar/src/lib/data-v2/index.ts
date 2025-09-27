// data-v2/index.ts - Clean offline-first data layer exports

// Core infrastructure
export { db } from './base/dexie';
export { supabase } from './base/client';
export type { ClientCategory, ClientCalendar, ClientUserProfile } from '../data/base/client-types';
export { useSyncStatus } from './base/useSyncStatus';
export { startSync, stopSync, pushOutbox, pullTable, setupRealtimeSubscription } from './base/sync';

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
  subscribeToCategoriesRealtime,
} from './domains/categories';

// Calendars domain
export {
  useUserCalendars,
  useUserCalendar,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  pullCalendars,
  subscribeToCalendarsRealtime,
} from './domains/calendars';

// User profiles domain
export {
  useUserProfile,
  updateUserProfile,
  pullUserProfiles,
  subscribeToUserProfilesRealtime,
} from './domains/user-profiles';

// Validation (for extending to other domains)
export {
  CategorySchema,
  UserProfileSchema,
  PersonaSchema,
  CalendarSchema,
  EventSchema,
  EventPersonalSchema,
  EventUserRoleSchema,
  AnnotationSchema,
  UserWorkPeriodSchema,
  validateBeforeEnqueue,
} from './base/validators';