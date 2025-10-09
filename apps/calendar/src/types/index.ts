// Application-specific types that reference the generated database types
import type { Database } from '@repo/supabase';

// Utility types for easier access to database types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Database table types
export type DbEvent = Tables<'events'>;
export type DbEventInsert = TablesInsert<'events'>;
export type DbEventUpdate = TablesUpdate<'events'>;

export type DbEventUser = Tables<'event_users'>;
export type DbEventUserInsert = TablesInsert<'event_users'>;
export type DbEventUserUpdate = TablesUpdate<'event_users'>;

export type DbEventRsvp = Tables<'event_rsvps'>;
export type DbEventRsvpInsert = TablesInsert<'event_rsvps'>;
export type DbEventRsvpUpdate = TablesUpdate<'event_rsvps'>;

export type DbEventDetailsPersonal = Tables<'event_details_personal'>;
export type DbEventDetailsPersonalInsert = TablesInsert<'event_details_personal'>;
export type DbEventDetailsPersonalUpdate = TablesUpdate<'event_details_personal'>;

export type DbUserCategory = Tables<'user_categories'>;
export type DbUserCategoryInsert = TablesInsert<'user_categories'>;
export type DbUserCategoryUpdate = TablesUpdate<'user_categories'>;

export type DbUserCalendar = Tables<'user_calendars'>;
export type DbUserCalendarInsert = TablesInsert<'user_calendars'>;
export type DbUserCalendarUpdate = TablesUpdate<'user_calendars'>;

export type DbUserProfile = Tables<'user_profiles'>;
export type DbUserProfileInsert = TablesInsert<'user_profiles'>;
export type DbUserProfileUpdate = TablesUpdate<'user_profiles'>;

export type DbUserWorkPeriod = Tables<'user_work_periods'>;
export type DbUserWorkPeriodInsert = TablesInsert<'user_work_periods'>;
export type DbUserWorkPeriodUpdate = TablesUpdate<'user_work_periods'>;

export type DbAIPersona = Tables<'ai_personas'>;
export type DbAIPersonaInsert = TablesInsert<'ai_personas'>;
export type DbAIPersonaUpdate = TablesUpdate<'ai_personas'>;

export type DbUserAnnotation = Tables<'user_annotations'>;
export type DbUserAnnotationInsert = TablesInsert<'user_annotations'>;
export type DbUserAnnotationUpdate = TablesUpdate<'user_annotations'>;

// Enum types
export type EventCategory = Enums<'colors'>;
export type ShowTimeAs = Enums<'show_time_as'>;
export type TimeDefenseLevel = Enums<'time_defense_level'>;
export type EventDiscoveryType = Enums<'event_discovery_types'>;
export type EventJoinModelType = Enums<'event_join_model_types'>;
export type InviteType = Enums<'invite_type'>;
export type RsvpStatus = Enums<'rsvp_status'>;
export type AttendanceType = Enums<'attendance_type'>;
export type UserRole = Enums<'user_role'>;
export type CalendarType = Enums<'calendar_type'>;
export type AnnotationType = Enums<'annotation_type'>;
export type TimeFormat = Enums<'time_format'>;
export type Weekday = Enums<'weekday'>;

// Re-export database type for cases where it's needed
export type { Database } from '@repo/supabase';

// Work Schedule Helper Types
export interface WorkScheduleDay {
  weekday: number; // 0=Sunday, 1=Monday, etc.
  periods: Array<{
    start_time: string; // HH:mm format
    end_time: string; // HH:mm format
  }>;
}

export interface UserWorkSchedule {
  user_id: string;
  timezone: string;
  schedule: WorkScheduleDay[];
}

// Common work schedule presets
export const WORK_SCHEDULE_PRESETS = {
  STANDARD_BUSINESS: {
    name: 'Standard Business Hours',
    description: 'Monday-Friday, 9 AM - 5 PM',
    schedule: [
      { weekday: 1, periods: [{ start_time: '09:00', end_time: '17:00' }] },
      { weekday: 2, periods: [{ start_time: '09:00', end_time: '17:00' }] },
      { weekday: 3, periods: [{ start_time: '09:00', end_time: '17:00' }] },
      { weekday: 4, periods: [{ start_time: '09:00', end_time: '17:00' }] },
      { weekday: 5, periods: [{ start_time: '09:00', end_time: '17:00' }] },
    ],
  },
  WITH_LUNCH_BREAK: {
    name: 'With Lunch Break',
    description: 'Monday-Friday, 9 AM - 5 PM with 1 hour lunch break',
    schedule: [
      {
        weekday: 1,
        periods: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '17:00' },
        ],
      },
      {
        weekday: 2,
        periods: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '17:00' },
        ],
      },
      {
        weekday: 3,
        periods: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '17:00' },
        ],
      },
      {
        weekday: 4,
        periods: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '17:00' },
        ],
      },
      {
        weekday: 5,
        periods: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '17:00' },
        ],
      },
    ],
  },
} as const;

// ============================================================================
// FREE/BUSY LOOKUP TYPES (Privacy-preserving calendar availability)
// ============================================================================

/**
 * Free/busy block for a single event
 * Contains time info and availability status, but NO private event details
 */
export interface FreeBusyBlock {
  start_time: string; // ISO 8601 timestamp
  end_time: string; // ISO 8601 timestamp
  start_time_ms: number; // Milliseconds since epoch
  end_time_ms: number; // Milliseconds since epoch
  all_day: boolean;
  show_time_as: ShowTimeAs; // 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere'
  time_defense_level: TimeDefenseLevel; // 'flexible' | 'normal' | 'high' | 'hard_block'
}

/**
 * Free/busy data for a single user
 */
export interface UserFreeBusy {
  user_id: string;
  blocks: FreeBusyBlock[];
}

/**
 * Free/busy block from bulk query (includes user_id)
 */
export interface MultipleUserFreeBusyBlock extends FreeBusyBlock {
  user_id: string;
}

/**
 * Available time slot for scheduling meetings
 */
export interface AvailableTimeSlot {
  slot_start: string; // ISO 8601 timestamp
  slot_end: string; // ISO 8601 timestamp
  all_users_free: boolean;
}

/**
 * Query parameters for free/busy lookup
 */
export interface FreeBusyQueryParams {
  userIds: string | string[];
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * Query parameters for finding available time slots
 */
export interface AvailableTimeSlotsParams extends FreeBusyQueryParams {
  slotDurationMinutes?: number;
  slotIncrementMinutes?: number;
  requestingUserId?: string;
  userTimezone?: string;
}
