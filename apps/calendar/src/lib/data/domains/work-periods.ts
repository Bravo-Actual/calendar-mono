// domains/work-periods.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { keys } from '../base/keys';

export function useUserWorkPeriods(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.userWorkPeriods(uid) : ['work-periods:none'],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_work_periods')
        .select('*')
        .eq('user_id', uid!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveUserWorkPeriods(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workPeriods: any[]) => {
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