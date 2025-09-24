/**
 * Server Types - Raw types from Supabase codegen
 * These represent the exact format returned by PostgreSQL/Supabase
 */

import type { Database } from '@repo/supabase';

// Event-related server types
export type ServerEventRow = Database['public']['Tables']['events']['Row'];
export type ServerEventInsert = Database['public']['Tables']['events']['Insert'];
export type ServerEventUpdate = Database['public']['Tables']['events']['Update'];

// Event details and relationships
export type ServerEDPRow = Database['public']['Tables']['event_details_personal']['Row'];
export type ServerEventUserRoleRow = Database['public']['Tables']['event_user_roles']['Row'];

// User data types
export type ServerUserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
export type ServerUserCalendarRow = Database['public']['Tables']['user_calendars']['Row'];
export type ServerUserCategoryRow = Database['public']['Tables']['user_categories']['Row'];
export type ServerUserWorkPeriodRow = Database['public']['Tables']['user_work_periods']['Row'];

// AI types
export type ServerAIPersonaRow = Database['public']['Tables']['ai_personas']['Row'];