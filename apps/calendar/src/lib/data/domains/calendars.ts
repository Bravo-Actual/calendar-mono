// domains/calendars.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapCalendarFromServer } from '../base/mapping';
import { generateUUID, nowISO } from '../base/utils';
import type { ClientCalendar } from '../base/client-types';

export function useUserCalendars(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.calendars(uid) : ['calendars:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientCalendar[]> => {
      const { data, error } = await supabase
        .from('user_calendars')
        .select('*')
        .eq('user_id', uid!)
        .order('name');
      if (error) throw error;

      const rows = (data ?? []).map(mapCalendarFromServer);
      await db.user_calendars.bulkPut(rows);
      return rows;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateUserCalendar(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      color?: 'neutral' | 'slate' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet' | 'fuchsia' | 'rose';
      visible?: boolean;
    }): Promise<ClientCalendar> => {
      if (!uid) throw new Error('user required');

      const id = generateUUID();
      const now = nowISO();

      const optimistic: ClientCalendar = {
        id,
        user_id: uid,
        name: input.name,
        color: input.color ?? 'neutral',
        type: 'user',
        visible: input.visible ?? true,
        created_at: now,
        updated_at: now,
      };

      await db.user_calendars.put(optimistic);

      // optimistic cache update
      qc.setQueryData(keys.calendars(uid), (old?: ClientCalendar[]) =>
        [...(old ?? []), optimistic].sort((a, b) => a.name.localeCompare(b.name))
      );

      const { data: server, error } = await supabase
        .from('user_calendars')
        .insert({
          id,
          user_id: uid,
          name: input.name,
          color: input.color ?? 'neutral',
          type: 'user',
          visible: input.visible ?? true,
        })
        .select()
        .single();
      if (error) throw error;

      const result = mapCalendarFromServer(server);
      await db.user_calendars.put(result);
      return result;
    },
    onSettled: (_, __, variables) => qc.invalidateQueries({ queryKey: keys.calendars(uid!) }),
  });
}

export function useUpdateUserCalendar(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: 'neutral' | 'slate' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet' | 'fuchsia' | 'rose';
      visible?: boolean;
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic update
      const existing = await db.user_calendars.get(input.id);
      if (existing) {
        const updated = { ...existing, ...input, updated_at: nowISO() };
        await db.user_calendars.put(updated);
      }

      const { error } = await supabase
        .from('user_calendars')
        .update({
          name: input.name,
          color: input.color,
          visible: input.visible,
        })
        .eq('id', input.id)
        .eq('user_id', uid);
      if (error) throw error;

      return input.id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.calendars(uid!) }),
  });
}

export function useDeleteUserCalendar(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      if (!uid) throw new Error('user required');

      const backup = await db.user_calendars.get(calendarId);
      await db.user_calendars.delete(calendarId);

      const { error } = await supabase
        .from('user_calendars')
        .delete()
        .eq('id', calendarId)
        .eq('user_id', uid)
        .neq('type', 'default') // prevent deletion of default calendar
        .neq('type', 'archive'); // prevent deletion of archive calendar

      if (error) {
        if (backup) await db.user_calendars.put(backup);
        throw error;
      }
      return calendarId;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.calendars(uid!) }),
  });
}