import { useQuery } from '@tanstack/react-query';
import { db, UserProfile, UserCalendar, UserCategory } from '../db/dexie';
import { supabase } from '@/lib/supabase';
import type { EventCategory } from '@/components/types';

// Transformed types for backwards compatibility with existing components
export interface UserEventCalendar {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory;
  is_default: boolean;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserEventCategory {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// Helper to clean and validate data from Supabase before storing in Dexie
const cleanUserProfile = (data: any): UserProfile => {
  return {
    ...data,
    timezone: data.timezone || 'UTC',
    time_format: data.time_format || '12_hour',
    week_start_day: data.week_start_day || '0',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
};

const cleanUserCalendar = (data: any): UserCalendar => {
  return {
    ...data,
    color: data.color || 'neutral',
    is_default: data.is_default || false,
    visible: data.visible !== false, // Default to true if not explicitly false
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
};

const cleanUserCategory = (data: any): UserCategory => {
  return {
    ...data,
    color: data.color || 'neutral',
    is_default: data.is_default || false,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
};

// User Profile Hook (same API as existing useUserProfile)
export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, display_name, avatar_url, slug, timezone, time_format, week_start_day, title, organization, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Clean and validate data before storing
      const cleanedProfile = cleanUserProfile(data);

      // Store in Dexie for offline access
      await db.user_profiles.put(cleanedProfile);

      return cleanedProfile;
    },
    // Offline-first: show cached data immediately (no initialData due to async nature)
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// User Calendars Hook (same API as existing useUserCalendars)
export function useUserCalendars(userId: string | undefined) {
  return useQuery({
    queryKey: ['userCalendars', userId],
    queryFn: async (): Promise<UserEventCalendar[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false }) // Default calendar first
        .order('name');

      if (error) throw error;

      // Clean and validate data
      const cleanedCalendars = (data || []).map(cleanUserCalendar);

      // Store in Dexie for offline access
      if (cleanedCalendars.length > 0) {
        await db.user_calendars.bulkPut(cleanedCalendars);
      }

      // Transform to expected component type (like old hook)
      return cleanedCalendars.map(calendar => ({
        ...calendar,
        color: calendar.color || 'neutral' as EventCategory,
        is_default: calendar.is_default || false,
        visible: calendar.visible !== false,
        created_at: calendar.created_at || '',
        updated_at: calendar.updated_at || ''
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// User Categories Hook (same API as existing useEventCategories)
export function useUserCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ['userCategories', userId],
    queryFn: async (): Promise<UserEventCategory[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;

      // Clean and validate data
      const cleanedCategories = (data || []).map(cleanUserCategory);

      // Store in Dexie for offline access
      if (cleanedCategories.length > 0) {
        await db.user_categories.bulkPut(cleanedCategories);
      }

      // Return as is for categories (they already match expected type)
      return cleanedCategories;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// For backwards compatibility, also export with the existing name pattern
export const useEventCategories = useUserCategories;