/**
 * Unified User Data Hooks
 * Replaces: use-user-calendars.ts, use-event-categories.ts, use-user-profile.ts
 *
 * Implements GPT plan ideas:
 * - Optimistic updates with Dexie-first writes
 * - Surgical cache updates with setQueriesData
 * - Archive pattern using calendar_id switching
 * - Bulk operations for initial loads
 */

import { createCRUDHooks } from '../base/factory';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserCalendar, UserCategory, UserWorkPeriod } from '../base/dexie';

// User Profiles
export const userProfileHooks = (userId: string | undefined) =>
  createCRUDHooks<UserProfile>({
    tableName: 'user_profiles',
    dexieTable: db.user_profiles,
    getQueryKey: () => keys.profile(userId!),
    userId,
    userIdField: 'id', // user_profiles.id = user_id
    select: '*',
    orderBy: [{ column: 'updated_at', ascending: false }],
    messages: {
      updateSuccess: 'Profile updated',
      updateError: 'Failed to update profile',
    },
  });

// User Calendars (with archive support from GPT plan)
export const userCalendarHooks = (userId: string | undefined) =>
  createCRUDHooks<UserCalendar>({
    tableName: 'user_calendars',
    dexieTable: db.user_calendars,
    getQueryKey: () => keys.calendars(userId!),
    userId,
    userIdField: 'user_id',
    select: '*',
    orderBy: [
      { column: 'type', ascending: true }, // default < archive < user
      { column: 'name', ascending: true },
    ],
    messages: {
      createSuccess: 'Calendar created',
      updateSuccess: 'Calendar updated',
      deleteSuccess: 'Calendar deleted',
      createError: 'Failed to create calendar',
      updateError: 'Failed to update calendar',
      deleteError: 'Failed to delete calendar',
    },
    invalidateQueries: {
      onCreate: () => [keys.calendars(userId!), keys.events(userId!)],
      onUpdate: () => [keys.calendars(userId!), keys.events(userId!)],
      onDelete: () => [keys.calendars(userId!), keys.events(userId!)],
    },
    beforeDelete: async (calendarId: string) => {
      // Check if this is a system calendar (following our schema)
      const calendar = await db.user_calendars.get(calendarId);
      if (calendar?.type !== 'user') {
        throw new Error('Cannot delete system calendars');
      }

      // Get default calendar for event reassignment
      const defaultCalendar = await db.user_calendars
        .where('user_id').equals(userId!)
        .and(cal => cal.type === 'default')
        .first();

      if (!defaultCalendar) {
        throw new Error('Default calendar not found');
      }

      // Bulk reassign all events to default calendar (GPT plan pattern)
      await supabase
        .from('event_details_personal')
        .update({ calendar_id: defaultCalendar.id })
        .eq('calendar_id', calendarId)
        .eq('user_id', userId!);
    },
  });

// User Categories (consistent naming from GPT plan)
export const userCategoryHooks = (userId: string | undefined) =>
  createCRUDHooks<UserCategory>({
    tableName: 'user_categories',
    dexieTable: db.user_categories,
    getQueryKey: () => keys.categories(userId!),
    userId,
    userIdField: 'user_id',
    select: '*',
    orderBy: [
      { column: 'is_default', ascending: false }, // default first
      { column: 'name', ascending: true },
    ],
    messages: {
      createSuccess: 'Category created',
      updateSuccess: 'Category updated',
      deleteSuccess: 'Category deleted',
      createError: 'Failed to create category',
      updateError: 'Failed to update category',
      deleteError: 'Failed to delete category',
    },
    invalidateQueries: {
      onCreate: () => [keys.categories(userId!), keys.events(userId!)],
      onUpdate: () => [keys.categories(userId!), keys.events(userId!)],
      onDelete: () => [keys.categories(userId!), keys.events(userId!)],
    },
    beforeDelete: async (categoryId: string) => {
      // Prevent deletion of default category
      const category = await db.user_categories.get(categoryId);
      if (category?.is_default) {
        throw new Error('Cannot delete the default category');
      }

      // Get default category for event reassignment
      const defaultCategory = await db.user_categories
        .where('user_id').equals(userId!)
        .and(cat => cat.is_default)
        .first();

      if (!defaultCategory) {
        throw new Error('Default category not found');
      }

      // Bulk reassign events to default category
      await supabase
        .from('event_details_personal')
        .update({ category_id: defaultCategory.id })
        .eq('category_id', categoryId)
        .eq('user_id', userId!);
    },
  });

// User Work Periods
export const userWorkPeriodHooks = (userId: string | undefined) =>
  createCRUDHooks<UserWorkPeriod>({
    tableName: 'user_work_periods',
    dexieTable: db.user_work_periods,
    getQueryKey: () => keys.workPeriods(userId!),
    userId,
    userIdField: 'user_id',
    select: '*',
    orderBy: [
      { column: 'weekday', ascending: true },
      { column: 'start_time_ms', ascending: true },
    ],
    messages: {
      createSuccess: 'Work period added',
      updateSuccess: 'Work period updated',
      deleteSuccess: 'Work period deleted',
      createError: 'Failed to add work period',
      updateError: 'Failed to update work period',
      deleteError: 'Failed to delete work period',
    },
  });

// Archive/Unarchive functions (GPT plan pattern)
export function useArchiveEvent(userId: string | undefined) {
  const { useUpdate } = userCalendarHooks(userId);
  const updatePersonalDetails = useUpdate();

  return {
    archive: async (eventId: string) => {
      // Get user's archive calendar
      const archiveCalendar = await db.user_calendars
        .where('user_id').equals(userId!)
        .and(cal => cal.type === 'archive')
        .first();

      if (!archiveCalendar) {
        throw new Error('Archive calendar not found');
      }

      // Move event to archive calendar via event_details_personal
      await supabase
        .from('event_details_personal')
        .upsert({
          event_id: eventId,
          user_id: userId!,
          calendar_id: archiveCalendar.id
        });
    },

    unarchive: async (eventId: string) => {
      // Get user's default calendar
      const defaultCalendar = await db.user_calendars
        .where('user_id').equals(userId!)
        .and(cal => cal.type === 'default')
        .first();

      if (!defaultCalendar) {
        throw new Error('Default calendar not found');
      }

      // Move event back to default calendar
      await supabase
        .from('event_details_personal')
        .upsert({
          event_id: eventId,
          user_id: userId!,
          calendar_id: defaultCalendar.id
        });
    }
  };
}

// Export convenience functions for backwards compatibility (single import path from GPT plan)
export const useUserProfile = (userId: string | undefined) =>
  userProfileHooks(userId).useQuery();

export const useUpdateUserProfile = (userId: string | undefined) =>
  userProfileHooks(userId).useUpdate();

export const useUserCalendars = (userId: string | undefined) =>
  userCalendarHooks(userId).useQuery();

export const useCreateUserCalendar = (userId: string | undefined) =>
  userCalendarHooks(userId).useCreate();

export const useUpdateUserCalendar = (userId: string | undefined) =>
  userCalendarHooks(userId).useUpdate();

export const useDeleteUserCalendar = (userId: string | undefined) =>
  userCalendarHooks(userId).useDelete();

export const useUserCategories = (userId: string | undefined) =>
  userCategoryHooks(userId).useQuery();

export const useCreateUserCategory = (userId: string | undefined) =>
  userCategoryHooks(userId).useCreate();

export const useUpdateUserCategory = (userId: string | undefined) =>
  userCategoryHooks(userId).useUpdate();

export const useDeleteUserCategory = (userId: string | undefined) =>
  userCategoryHooks(userId).useDelete();

export const useUserWorkPeriods = (userId: string | undefined) =>
  userWorkPeriodHooks(userId).useQuery();

export const useSaveUserWorkPeriods = (userId: string | undefined) =>
  userWorkPeriodHooks(userId).useCreate();