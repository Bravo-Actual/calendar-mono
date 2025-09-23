"use client";

import { useEffect } from 'react';
import { useUserProfile } from '@/lib/data/queries';
import { useAppStore } from '@/store/app';

interface ProfileBridgeProps {
  userId: string | undefined;
}

/**
 * ProfileBridge component handles syncing user profile data to the app store.
 * This is a drop-in replacement for the manual sync logic in page.tsx.
 *
 * It monitors profile data from the new offline-first useUserProfile hook
 * and automatically updates the app store when profile settings change.
 */
export function ProfileBridge({ userId }: ProfileBridgeProps) {
  const { data: profile } = useUserProfile(userId);
  const { weekStartDay, timezone, timeFormat, setWeekStartDay, setTimezone, setTimeFormat } = useAppStore();

  // Sync profile settings to app store when profile loads or changes
  useEffect(() => {
    if (!profile) return;

    // Update week start day if it has changed
    if (profile.week_start_day) {
      const profileWeekStartDay = parseInt(profile.week_start_day) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      if (profileWeekStartDay !== weekStartDay) {
        setWeekStartDay(profileWeekStartDay);
      }
    }

    // Update timezone if it has changed
    if (profile.timezone && profile.timezone !== timezone) {
      setTimezone(profile.timezone);
    }

    // Update time format if it has changed
    if (profile.time_format && profile.time_format !== timeFormat) {
      setTimeFormat(profile.time_format);
    }
  }, [
    profile?.week_start_day,
    profile?.timezone,
    profile?.time_format,
    weekStartDay,
    timezone,
    timeFormat,
    setWeekStartDay,
    setTimezone,
    setTimeFormat
  ]);

  // This component doesn't render anything - it's purely for side effects
  return null;
}