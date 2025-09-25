// domains/categories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapCategoryFromServer } from '../base/mapping';
import { generateUUID, nowISO } from '../base/utils';
import type { ClientCategory } from '../base/client-types';

export function useUserCategories(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.categories(uid) : ['categories:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientCategory[]> => {
      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', uid!)
        .order('name');
      if (error) throw error;

      const rows = (data ?? []).map(mapCategoryFromServer);
      await db.user_categories.bulkPut(rows);
      return rows;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateUserCategory(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      color?: 'neutral' | 'slate' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet' | 'fuchsia' | 'rose';
    }): Promise<ClientCategory> => {
      if (!uid) throw new Error('user required');

      const id = generateUUID();
      const now = nowISO();

      const optimistic: ClientCategory = {
        id,
        user_id: uid,
        name: input.name,
        color: input.color ?? 'neutral',
        is_default: false,
        created_at: now,
        updated_at: now,
      };

      await db.user_categories.put(optimistic);

      // optimistic cache update
      qc.setQueryData(keys.categories(uid), (old?: ClientCategory[]) =>
        [...(old ?? []), optimistic].sort((a, b) => a.name.localeCompare(b.name))
      );

      const { data: server, error } = await supabase
        .from('user_categories')
        .insert({
          id,
          user_id: uid,
          name: input.name,
          color: input.color ?? 'neutral',
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;

      const result = mapCategoryFromServer(server);
      await db.user_categories.put(result);
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.categories(uid!) }),
  });
}

export function useUpdateUserCategory(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: 'neutral' | 'slate' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet' | 'fuchsia' | 'rose';
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic update
      const existing = await db.user_categories.get(input.id);
      if (existing) {
        const updated = { ...existing, ...input, updated_at: nowISO() };
        await db.user_categories.put(updated);
      }

      const { error } = await supabase
        .from('user_categories')
        .update({
          name: input.name,
          color: input.color,
        })
        .eq('id', input.id)
        .eq('user_id', uid);
      if (error) throw error;

      return input.id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.categories(uid!) }),
  });
}

export function useDeleteUserCategory(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!uid) throw new Error('user required');

      const backup = await db.user_categories.get(categoryId);
      await db.user_categories.delete(categoryId);

      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', uid)
        .eq('is_default', false); // prevent deletion of default category

      if (error) {
        if (backup) await db.user_categories.put(backup);
        throw error;
      }
      return categoryId;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.categories(uid!) }),
  });
}