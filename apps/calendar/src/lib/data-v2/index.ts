// data-v2/index.ts - Clean offline-first data layer exports

// Core infrastructure
export { db } from './base/dexie';
export { supabase } from './base/client';
export type { ClientCategory, ClientCalendar, ClientUserProfile, ClientUserWorkPeriod, ClientPersona } from '../data/base/client-types';
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
  EventUserRoleSchema,
  AnnotationSchema,
  UserWorkPeriodSchema,
  validateBeforeEnqueue,
} from './base/validators';