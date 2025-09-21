import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { UserProfile } from "./use-user-profile";
import { toast } from "sonner";

interface UpdateProfileData {
  first_name: string;
  last_name: string;
  display_name?: string;
  title?: string;
  organization?: string;
  timezone?: string;
  time_format?: "12_hour" | "24_hour";
  week_start_day?: "0" | "1" | "2" | "3" | "4" | "5" | "6";
}

interface UpdateProfileWithAvatarData extends UpdateProfileData {
  avatarFile?: File;
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileWithAvatarData): Promise<UserProfile> => {
      const { avatarFile, ...profileData } = data;
      let avatar_url = undefined;

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${userId}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Avatar upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatar_url = publicUrl;
      }

      // Generate display name if not provided
      const finalDisplayName = profileData.display_name?.trim() ||
        `${profileData.first_name} ${profileData.last_name}`.trim();

      // Generate slug from display name
      const slug = finalDisplayName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Update profile
      const updateData: Partial<UserProfile> = {
        ...profileData,
        display_name: finalDisplayName,
        slug,
      };

      // Only include avatar_url if we uploaded one
      if (avatar_url) {
        updateData.avatar_url = avatar_url;
      }

      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select('id, email, first_name, last_name, display_name, avatar_url, slug, timezone, time_format, week_start_day, title, organization')
        .single();

      if (error) {
        throw error;
      }

      return updatedProfile;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['userProfile', userId] });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<UserProfile>(['userProfile', userId]);

      // Optimistically update the cache
      const optimisticProfile: UserProfile = {
        ...previousProfile!,
        first_name: newData.first_name,
        last_name: newData.last_name,
        display_name: newData.display_name?.trim() || `${newData.first_name} ${newData.last_name}`.trim(),
        title: newData.title || null,
        organization: newData.organization || null,
        timezone: newData.timezone || previousProfile?.timezone || null,
        time_format: newData.time_format || previousProfile?.time_format || null,
        week_start_day: newData.week_start_day || previousProfile?.week_start_day || null,
        slug: (newData.display_name?.trim() || `${newData.first_name} ${newData.last_name}`.trim())
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        // If avatar is being uploaded, keep current URL until upload completes
        avatar_url: previousProfile?.avatar_url || null,
      };

      queryClient.setQueryData(['userProfile', userId], optimisticProfile);

      // Return context with previous and optimistic values
      return { previousProfile, optimisticProfile };
    },
    onError: (error, newData, context) => {
      // Rollback to the previous value on error
      if (context?.previousProfile) {
        queryClient.setQueryData(['userProfile', userId], context.previousProfile);
      }

      // Show error toast
      toast.error("Failed to update profile", {
        description: error instanceof Error ? error.message : "Please try again later",
      });
    },
    onSuccess: (updatedProfile) => {
      // Update with server response (includes avatar URL if uploaded)
      queryClient.setQueryData(['userProfile', userId], updatedProfile);
    },
  });
}