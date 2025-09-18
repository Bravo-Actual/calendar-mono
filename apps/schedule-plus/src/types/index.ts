// Application-specific types that reference the generated database types
import type { Database } from '@/lib/supabase-types'

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

export type DbUserEventOption = Tables<'user_event_options'>
export type DbUserEventOptionInsert = TablesInsert<'user_event_options'>
export type DbUserEventOptionUpdate = TablesUpdate<'user_event_options'>

export type DbUserEventCategory = Tables<'user_event_categories'>
export type DbUserEventCategoryInsert = TablesInsert<'user_event_categories'>
export type DbUserEventCategoryUpdate = TablesUpdate<'user_event_categories'>

export type DbUserProfile = Tables<'user_profiles'>
export type DbUserProfileInsert = TablesInsert<'user_profiles'>
export type DbUserProfileUpdate = TablesUpdate<'user_profiles'>

// Enum types
export type EventColors = Enums<'event_colors'>
export type ShowTimeAs = Enums<'show_time_as_extended'>
export type TimeDefenseLevel = Enums<'time_defense_level'>
export type InviteType = Enums<'invite_type'>
export type RsvpStatus = Enums<'rsvp_status'>
export type AttendanceType = Enums<'attendance_type'>
export type UserRole = Enums<'user_role'>

// Re-export database type for cases where it's needed
export type { Database } from '@/lib/supabase-types'