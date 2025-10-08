// hooks/use-free-busy.ts - Privacy-preserving free/busy lookup hooks

import React from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useQuery } from '@tanstack/react-query';
import type {
  FreeBusyBlock,
  MultipleUserFreeBusyBlock,
  AvailableTimeSlot,
  FreeBusyQueryParams,
  AvailableTimeSlotsParams,
} from '@/types';

/**
 * Convert Date or string to ISO 8601 timestamp for Supabase
 */
function toISOString(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : date;
}

/**
 * Get free/busy blocks for a single user
 * Returns time blocks and availability status - NO private event details
 */
export function useUserFreeBusy(params: FreeBusyQueryParams) {
  const { userIds, startDate, endDate } = params;
  const userId = Array.isArray(userIds) ? userIds[0] : userIds;

  return useQuery({
    queryKey: ['user-free-busy', userId, startDate, endDate],
    queryFn: async () => {
      if (!userId) return [];

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase.rpc('get_user_free_busy', {
        target_user_id: userId,
        start_date: toISOString(startDate),
        end_date: toISOString(endDate),
      });

      if (error) {
        console.error('Error fetching user free/busy:', error);
        throw error;
      }

      return (data || []) as FreeBusyBlock[];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get free/busy blocks for multiple users (bulk query)
 * Useful for scheduling meetings with multiple attendees
 */
export function useMultipleUsersFreeBusy(params: FreeBusyQueryParams) {
  const { userIds, startDate, endDate } = params;
  const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];

  return useQuery({
    queryKey: ['multiple-users-free-busy', ...userIdsArray.sort(), startDate, endDate],
    queryFn: async () => {
      if (userIdsArray.length === 0) return [];

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase.rpc('get_multiple_users_free_busy', {
        target_user_ids: userIdsArray,
        start_date: toISOString(startDate),
        end_date: toISOString(endDate),
      });

      if (error) {
        console.error('Error fetching multiple users free/busy:', error);
        throw error;
      }

      return (data || []) as MultipleUserFreeBusyBlock[];
    },
    enabled: userIdsArray.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Find available time slots where all specified users are free
 * Useful for meeting scheduling UI
 */
export function useAvailableTimeSlots(params: AvailableTimeSlotsParams) {
  const {
    userIds,
    startDate,
    endDate,
    slotDurationMinutes = 30,
    slotIncrementMinutes = 15,
  } = params;
  const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];

  return useQuery({
    queryKey: [
      'available-time-slots',
      ...userIdsArray.sort(),
      startDate,
      endDate,
      slotDurationMinutes,
      slotIncrementMinutes,
    ],
    queryFn: async () => {
      if (userIdsArray.length === 0) return [];

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase.rpc('find_available_time_slots', {
        target_user_ids: userIdsArray,
        start_date: toISOString(startDate),
        end_date: toISOString(endDate),
        slot_duration_minutes: slotDurationMinutes,
        slot_increment_minutes: slotIncrementMinutes,
      });

      if (error) {
        console.error('Error fetching available time slots:', error);
        throw error;
      }

      return (data || []) as AvailableTimeSlot[];
    },
    enabled: userIdsArray.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get free/busy data organized by user
 * Transforms the bulk query result into a more convenient structure
 */
export function useMultipleUsersFreeBusyGrouped(params: FreeBusyQueryParams) {
  const query = useMultipleUsersFreeBusy(params);

  const groupedData = React.useMemo(() => {
    if (!query.data) return new Map<string, FreeBusyBlock[]>();

    const grouped = new Map<string, FreeBusyBlock[]>();

    query.data.forEach((block) => {
      const { user_id, ...blockData } = block;
      if (!grouped.has(user_id)) {
        grouped.set(user_id, []);
      }
      grouped.get(user_id)!.push(blockData);
    });

    return grouped;
  }, [query.data]);

  return {
    ...query,
    groupedData,
  };
}
