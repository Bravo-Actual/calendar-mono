// Application-specific types that reference the generated database types
import type { Database } from '@repo/supabase'

// Utility types for easier access to database types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Database table types
export type DbEvent = Tables<'events'>
export type DbEventInsert = TablesInsert<'events'>
export type DbEventUpdate = TablesUpdate<'events'>

export type DbEventUserRole = Tables<'event_user_roles'>
export type DbEventUserRoleInsert = TablesInsert<'event_user_roles'>
export type DbEventUserRoleUpdate = TablesUpdate<'event_user_roles'>

export type DbEventDetailsPersonal = Tables<'event_details_personal'>
export type DbEventDetailsPersonalInsert = TablesInsert<'event_details_personal'>
export type DbEventDetailsPersonalUpdate = TablesUpdate<'event_details_personal'>

export type DbUserCategory = Tables<'user_categories'>
export type DbUserCategoryInsert = TablesInsert<'user_categories'>
export type DbUserCategoryUpdate = TablesUpdate<'user_categories'>

export type DbUserCalendar = Tables<'user_calendars'>
export type DbUserCalendarInsert = TablesInsert<'user_calendars'>
export type DbUserCalendarUpdate = TablesUpdate<'user_calendars'>

export type DbUserProfile = Tables<'user_profiles'>
export type DbUserProfileInsert = TablesInsert<'user_profiles'>
export type DbUserProfileUpdate = TablesUpdate<'user_profiles'>

// Enum types
export type EventCategory = Enums<'colors'>
export type ShowTimeAs = Enums<'show_time_as_extended'>
export type TimeDefenseLevel = Enums<'time_defense_level'>
export type InviteType = Enums<'invite_type'>
export type RsvpStatus = Enums<'rsvp_status'>
export type AttendanceType = Enums<'attendance_type'>
export type UserRole = Enums<'user_role'>

// Re-export database type for cases where it's needed
export type { Database } from '@repo/supabase'