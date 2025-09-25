// domains/work-periods.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { keys } from '../base/keys';
import type { ClientUserWorkPeriod } from '../base/client-types';

export function useUserWorkPeriods(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.userWorkPeriods(uid) : ['work-periods:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientUserWorkPeriod[]> => {
      const { data, error } = await supabase
        .from('user_work_periods')
        .select('*')
        .eq('user_id', uid!);
      if (error) throw error;

      // Convert server timestamps to client format
      return (data ?? []).map(period => ({
        ...period,
        created_at: period.created_at || new Date().toISOString(),
        updated_at: period.updated_at || new Date().toISOString(),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveUserWorkPeriods(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workPeriods: Omit<ClientUserWorkPeriod, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]) => {
      if (!uid) throw new Error('user required');

      // Delete existing work periods for user
      const { error: deleteError } = await supabase
        .from('user_work_periods')
        .delete()
        .eq('user_id', uid);
      if (deleteError) throw deleteError;

      // Insert new work periods
      if (workPeriods.length > 0) {
        const { data, error } = await supabase
          .from('user_work_periods')
          .insert(workPeriods.map(period => ({ ...period, user_id: uid })))
          .select();
        if (error) throw error;
        return data;
      }
      return [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-periods'] });
    },
  });
}