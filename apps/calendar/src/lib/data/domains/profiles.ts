// domains/profiles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapUserProfileFromServer } from '../base/mapping';
import { nowISO } from '../base/utils';
import type { ClientUserProfile } from '../base/client-types';

export function useUserProfile(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.profile(uid) : ['profile:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientUserProfile> => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', uid!)
        .single();
      if (error) throw error;

      const profile = mapUserProfileFromServer(data);
      await db.user_profiles.put(profile);
      return profile;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateUserProfile(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      first_name?: string;
      last_name?: string;
      display_name?: string | null;
      title?: string | null;
      organization?: string | null;
      avatar_url?: string | null;
      timezone?: string | null;
      time_format?: '12_hour' | '24_hour' | null;
      week_start_day?: string | null;
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic update
      const existing = await db.user_profiles.get(input.id);
      if (existing) {
        const updated = { ...existing, ...input, updated_at: nowISO() };
        await db.user_profiles.put(updated as ClientUserProfile);
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: input.first_name,
          last_name: input.last_name,
          display_name: input.display_name,
          title: input.title,
          organization: input.organization,
          avatar_url: input.avatar_url,
          timezone: input.timezone,
          time_format: input.time_format,
          week_start_day: input.week_start_day as "0" | "1" | "2" | "3" | "4" | "5" | "6" | null,
        })
        .eq('id', input.id);
      if (error) throw error;

      return input.id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.profile(uid!) }),
  });
}