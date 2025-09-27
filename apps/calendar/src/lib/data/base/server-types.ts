// base/server-types.ts
import type { Database } from '@/../../packages/supabase/database.types';

export type ServerUserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type ServerCalendar    = Database['public']['Tables']['user_calendars']['Row'];
export type ServerCategory    = Database['public']['Tables']['user_categories']['Row'];
export type ServerPersona     = Database['public']['Tables']['ai_personas']['Row'];
export type ServerAnnotation  = Database['public']['Tables']['user_annotations']['Row'];
export type ServerUserWorkPeriod = Database['public']['Tables']['user_work_periods']['Row'];

export type ServerEvent       = Database['public']['Tables']['events']['Row'];
export type ServerEDP         = Database['public']['Tables']['event_details_personal']['Row'];
export type ServerEventUserRole = Database['public']['Tables']['event_user_roles']['Row'];

export type ServerEventInsert = Database['public']['Tables']['events']['Insert'];
export type ServerEventUpdate = Database['public']['Tables']['events']['Update'];
export type ServerEDPInsert   = Database['public']['Tables']['event_details_personal']['Insert'];
export type ServerEDPUpdate   = Database['public']['Tables']['event_details_personal']['Update'];

export type ServerUserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type ServerUserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];
export type ServerCalendarInsert = Database['public']['Tables']['user_calendars']['Insert'];
export type ServerCalendarUpdate = Database['public']['Tables']['user_calendars']['Update'];
export type ServerCategoryInsert = Database['public']['Tables']['user_categories']['Insert'];
export type ServerCategoryUpdate = Database['public']['Tables']['user_categories']['Update'];
export type ServerPersonaInsert = Database['public']['Tables']['ai_personas']['Insert'];
export type ServerPersonaUpdate = Database['public']['Tables']['ai_personas']['Update'];
export type ServerAnnotationInsert = Database['public']['Tables']['user_annotations']['Insert'];
export type ServerAnnotationUpdate = Database['public']['Tables']['user_annotations']['Update'];
export type ServerUserWorkPeriodInsert = Database['public']['Tables']['user_work_periods']['Insert'];
export type ServerUserWorkPeriodUpdate = Database['public']['Tables']['user_work_periods']['Update'];
export type ServerEventUserRoleInsert = Database['public']['Tables']['event_user_roles']['Insert'];
export type ServerEventUserRoleUpdate = Database['public']['Tables']['event_user_roles']['Update'];