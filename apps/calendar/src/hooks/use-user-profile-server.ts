// hooks/use-user-profile-server.ts - Server-side user profile fetching with TanStack Query

import { createBrowserClient } from '@supabase/ssr';
import { useQuery } from '@tanstack/react-query';

export interface UserProfile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  title: string | null;
  organization: string | null;
  avatar_url: string | null;
  timezone: string | null;
  time_format: '12_hour' | '24_hour' | null;
  week_start_day: '0' | '1' | '2' | '3' | '4' | '5' | '6' | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch a user profile from the server using TanStack Query
 * Use this for profiles of other users (not in Dexie)
 */
export function useUserProfileServer(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Fetch multiple user profiles from the server
 * Returns a Map of userId -> { display_name, avatar_url }
 */
export function useUserProfilesServer(userIds: string[]) {
  return useQuery({
    queryKey: ['user-profiles-batch', ...userIds.sort()],
    queryFn: async () => {
      if (userIds.length === 0) return new Map<string, { display_name: string | null; avatar_url: string | null }>();

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (error) {
        console.error('Error fetching user profiles:', error);
        return new Map<string, { display_name: string | null; avatar_url: string | null }>();
      }

      const map = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      data?.forEach((profile) => {
        map.set(profile.user_id, { display_name: profile.display_name, avatar_url: profile.avatar_url });
      });

      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
