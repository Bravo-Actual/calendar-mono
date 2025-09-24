import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db, UserProfile, UserCalendar, UserCategory } from '../db/dexie';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { EventCategory } from '@/components/types';
import type { Tables } from '@repo/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

// Input types (matching existing patterns)
export interface CreateCalendarData {
  name: string;
  color: EventCategory;
  visible?: boolean;
}

export interface UpdateCalendarData {
  id: string;
  name?: string;
  color?: EventCategory;
  visible?: boolean;
}

export interface CreateCategoryData {
  name: string;
  color: EventCategory;
}

export interface UpdateCategoryData {
  id: string;
  name?: string;
  color?: EventCategory;
}

export interface UpdateProfileData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  slug?: string | null;
  timezone?: string | null;
  time_format?: '12_hour' | '24_hour' | null;
  week_start_day?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | null;
  title?: string | null;
  organization?: string | null;
}

// User Profile Update
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileData): Promise<UserProfile> => {
      // Optimistic update to Dexie
      const current = await db.user_profiles.get(data.id);
      if (current) {
        const optimisticUpdate = { ...current, ...data, updated_at: new Date().toISOString() };
        await db.user_profiles.put(optimisticUpdate);
      }

      // Server update
      const { data: result, error } = await supabase
        .from('user_profiles')
        .update(data)
        .eq('id', data.id)
        .select()
        .single();

      if (error) {
        // Rollback optimistic update on error
        if (current) {
          await db.user_profiles.put(current);
        }
        throw error;
      }

      // Store canonical server result
      await db.user_profiles.put(result);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', variables.id] });
    },
    onError: (error: Error) => {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    },
  });
}

// Calendar Create
export function useCreateUserCalendar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCalendarData): Promise<UserCalendar> => {
      if (!userId) throw new Error('User ID is required');

      const { data: result, error } = await supabase
        .from('user_calendars')
        .insert({
          user_id: userId,
          name: data.name,
          color: data.color,
          visible: data.visible !== undefined ? data.visible : true,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Store in Dexie
      await db.user_calendars.put(result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCalendars', userId] });
    },
    onError: (error: PostgrestError) => {
      console.error('Error creating calendar:', error);
      if (error.code === '23505') {
        toast.error('A calendar with this name already exists');
      } else {
        toast.error('Failed to create calendar');
      }
    },
  });
}

// Calendar Update
export function useUpdateUserCalendar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCalendarData): Promise<UserCalendar> => {
      // Optimistic update
      const current = await db.user_calendars.get(data.id);
      if (current) {
        const optimisticUpdate = { ...current, ...data, updated_at: new Date().toISOString() };
        await db.user_calendars.put(optimisticUpdate);
      }

      const updateData: { name?: string; color?: EventCategory; visible?: boolean } = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.visible !== undefined) updateData.visible = data.visible;

      const { data: result, error } = await supabase
        .from('user_calendars')
        .update(updateData)
        .eq('id', data.id)
        .eq('user_id', userId!)
        .select()
        .single();

      if (error) {
        // Rollback optimistic update
        if (current) {
          await db.user_calendars.put(current);
        }
        throw error;
      }

      // Store canonical result
      await db.user_calendars.put(result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCalendars', userId] });
    },
    onError: (error: PostgrestError) => {
      console.error('Error updating calendar:', error);
      if (error.code === '23505') {
        toast.error('A calendar with this name already exists');
      } else {
        toast.error('Failed to update calendar');
      }
    },
  });
}

// Calendar Delete
export function useDeleteUserCalendar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (calendarId: string): Promise<void> => {
      // First check if this is the default calendar
      const { data: calendar, error: fetchError } = await supabase
        .from('user_calendars')
        .select('type, name')
        .eq('id', calendarId)
        .eq('user_id', userId!)
        .single();

      if (fetchError) throw fetchError;

      if (calendar?.type !== 'user') {
        throw new Error('Cannot delete system calendars');
      }

      // Optimistic delete from Dexie
      const deletedCalendar = await db.user_calendars.get(calendarId);
      await db.user_calendars.delete(calendarId);

      try {
        // Server delete
        const { error } = await supabase
          .from('user_calendars')
          .delete()
          .eq('id', calendarId)
          .eq('user_id', userId!);

        if (error) throw error;
      } catch (error) {
        // Rollback optimistic delete
        if (deletedCalendar) {
          await db.user_calendars.put(deletedCalendar);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCalendars', userId] });
      // Also invalidate events queries since events may have been reassigned
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error: Error) => {
      console.error('Error deleting calendar:', error);
      if (error.message === 'Cannot delete the default calendar') {
        toast.error('Cannot delete the default calendar');
      } else {
        toast.error('Failed to delete calendar');
      }
    },
  });
}

// Category Create
export function useCreateUserCategory(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCategoryData): Promise<UserCategory> => {
      if (!userId) throw new Error('User ID is required');

      const { data: result, error } = await supabase
        .from('user_categories')
        .insert({
          user_id: userId,
          name: data.name,
          color: data.color,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Store in Dexie
      await db.user_categories.put(result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCategories', userId] });
    },
    onError: (error: PostgrestError) => {
      console.error('Error creating category:', error);
      if (error.code === '23505') {
        toast.error('A category with this name already exists');
      } else {
        toast.error('Failed to create category');
      }
    },
  });
}

// Category Update
export function useUpdateUserCategory(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCategoryData): Promise<UserCategory> => {
      // Optimistic update
      const current = await db.user_categories.get(data.id);
      if (current) {
        const optimisticUpdate = { ...current, ...data, updated_at: new Date().toISOString() };
        await db.user_categories.put(optimisticUpdate);
      }

      const updateData: { name?: string; color?: EventCategory } = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.color !== undefined) updateData.color = data.color;

      const { data: result, error } = await supabase
        .from('user_categories')
        .update(updateData)
        .eq('id', data.id)
        .eq('user_id', userId!)
        .select()
        .single();

      if (error) {
        // Rollback optimistic update
        if (current) {
          await db.user_categories.put(current);
        }
        throw error;
      }

      // Store canonical result
      await db.user_categories.put(result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCategories', userId] });
    },
    onError: (error: PostgrestError) => {
      console.error('Error updating category:', error);
      if (error.code === '23505') {
        toast.error('A category with this name already exists');
      } else {
        toast.error('Failed to update category');
      }
    },
  });
}

// Category Delete
export function useDeleteUserCategory(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string): Promise<void> => {
      // Check if default category
      const { data: category, error: fetchError } = await supabase
        .from('user_categories')
        .select('is_default, name')
        .eq('id', categoryId)
        .eq('user_id', userId!)
        .single();

      if (fetchError) throw fetchError;

      if (category?.is_default) {
        throw new Error('Cannot delete the default category');
      }

      // Optimistic delete
      const deletedCategory = await db.user_categories.get(categoryId);
      await db.user_categories.delete(categoryId);

      try {
        // Server delete
        const { error } = await supabase
          .from('user_categories')
          .delete()
          .eq('id', categoryId)
          .eq('user_id', userId!);

        if (error) throw error;
      } catch (error) {
        // Rollback optimistic delete
        if (deletedCategory) {
          await db.user_categories.put(deletedCategory);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCategories', userId] });
    },
    onError: (error: Error) => {
      console.error('Error deleting category:', error);
      if (error.message === 'Cannot delete the default category') {
        toast.error('Cannot delete the default category');
      } else {
        toast.error('Failed to delete category');
      }
    },
  });
}

// User Profile Update with Avatar Support
interface UpdateProfileWithAvatarData {
  id: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  title?: string;
  organization?: string;
  timezone?: string;
  time_format?: '12_hour' | '24_hour';
  week_start_day?: '0' | '1' | '2' | '3' | '4' | '5' | '6';
  avatarFile?: File;
}

export function useUpdateUserProfileWithAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileWithAvatarData): Promise<UserProfile> => {
      const { avatarFile, id, ...profileData } = data;
      let avatar_url = undefined;

      // Get current profile for optimistic update
      const current = await db.user_profiles.get(id);
      if (current) {
        const optimisticUpdate = {
          ...current,
          ...profileData,
          updated_at: new Date().toISOString(),
          // Generate display name if not provided
          display_name: profileData.display_name?.trim() ||
            `${profileData.first_name || current.first_name} ${profileData.last_name || current.last_name}`.trim()
        };
        await db.user_profiles.put(optimisticUpdate);
      }

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${id}.${fileExt}`;
        const filePath = `${id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Avatar upload failed: ${uploadError.message}`);
        }

        avatar_url = filePath;
      }

      // Generate display name if not provided
      const finalDisplayName = profileData.display_name?.trim() ||
        `${profileData.first_name || current?.first_name || ''} ${profileData.last_name || current?.last_name || ''}`.trim();

      // Generate slug from display name
      const slug = finalDisplayName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Prepare update data
      const updateData: Tables['user_profiles']['Update'] = {
        ...profileData,
        display_name: finalDisplayName,
        slug,
      };

      // Only include avatar_url if we uploaded one
      if (avatar_url) {
        updateData.avatar_url = avatar_url;
      }

      // Server update
      const { data: result, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        // Rollback optimistic update on error
        if (current) {
          await db.user_profiles.put(current);
        }
        throw error;
      }

      // Store canonical server result in Dexie
      await db.user_profiles.put(result);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', variables.id] });
    },
    onError: (error: Error) => {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    },
  });
}

// For backwards compatibility
export const useCreateEventCategory = useCreateUserCategory;
export const useUpdateEventCategory = useUpdateUserCategory;
export const useDeleteEventCategory = useDeleteUserCategory;