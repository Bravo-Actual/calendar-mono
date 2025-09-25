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

export type ServerEventInsert = Database['public']['Tables']['events']['Insert'];
export type ServerEventUpdate = Database['public']['Tables']['events']['Update'];
export type ServerEDPInsert   = Database['public']['Tables']['event_details_personal']['Insert'];
export type ServerEDPUpdate   = Database['public']['Tables']['event_details_personal']['Update'];

export type ServerAnnotationInsert = Database['public']['Tables']['user_annotations']['Insert'];
export type ServerAnnotationUpdate = Database['public']['Tables']['user_annotations']['Update'];