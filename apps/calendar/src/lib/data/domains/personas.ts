// domains/personas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapPersonaFromServer } from '../base/mapping';
import { generateUUID, nowISO } from '../base/utils';
import type { ClientPersona } from '../base/client-types';

export function useAIPersonas(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.personas(uid) : ['personas:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientPersona[]> => {
      const { data, error } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('user_id', uid!)
        .order('name');
      if (error) throw error;

      const rows = (data ?? []).map(mapPersonaFromServer);
      await db.ai_personas.bulkPut(rows);
      return rows;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateAIPersona(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      avatar_url?: string | null;
      traits?: string | null;
      instructions?: string | null;
      greeting?: string | null;
      agent_id?: string | null;
      model_id?: string | null;
      temperature?: number | null;
      top_p?: number | null;
      properties_ext?: Record<string, any> | null;
    }): Promise<ClientPersona> => {
      if (!uid) throw new Error('user required');

      const id = generateUUID();
      const now = nowISO();

      const optimistic: ClientPersona = {
        id,
        user_id: uid,
        name: input.name,
        avatar_url: input.avatar_url ?? null,
        traits: input.traits ?? null,
        instructions: input.instructions ?? null,
        greeting: input.greeting ?? null,
        agent_id: input.agent_id ?? 'dynamicPersonaAgent',
        model_id: input.model_id ?? null,
        temperature: input.temperature ?? null,
        top_p: input.top_p ?? null,
        is_default: false,
        properties_ext: input.properties_ext ?? null,
        created_at: now,
        updated_at: now,
      };

      await db.ai_personas.put(optimistic);

      // optimistic cache update
      qc.setQueryData(keys.personas(uid), (old?: ClientPersona[]) =>
        [...(old ?? []), optimistic].sort((a, b) => a.name.localeCompare(b.name))
      );

      const { data: server, error } = await supabase
        .from('ai_personas')
        .insert({
          id,
          user_id: uid,
          name: input.name,
          avatar_url: input.avatar_url,
          traits: input.traits,
          instructions: input.instructions,
          greeting: input.greeting,
          agent_id: input.agent_id ?? 'dynamicPersonaAgent',
          model_id: input.model_id,
          temperature: input.temperature,
          top_p: input.top_p,
          is_default: false,
          properties_ext: input.properties_ext,
        })
        .select()
        .single();
      if (error) throw error;

      const result = mapPersonaFromServer(server);
      await db.ai_personas.put(result);
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.personas(uid!) }),
  });
}

export function useUpdateAIPersona(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      avatar_url?: string | null;
      traits?: string | null;
      instructions?: string | null;
      greeting?: string | null;
      agent_id?: string | null;
      model_id?: string | null;
      temperature?: number | null;
      top_p?: number | null;
      properties_ext?: Record<string, any> | null;
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic update
      const existing = await db.ai_personas.get(input.id);
      if (existing) {
        const updated = { ...existing, ...input, updated_at: nowISO() };
        await db.ai_personas.put(updated);
      }

      const { error } = await supabase
        .from('ai_personas')
        .update({
          name: input.name,
          avatar_url: input.avatar_url,
          traits: input.traits,
          instructions: input.instructions,
          greeting: input.greeting,
          agent_id: input.agent_id,
          model_id: input.model_id,
          temperature: input.temperature,
          top_p: input.top_p,
          properties_ext: input.properties_ext,
        })
        .eq('id', input.id)
        .eq('user_id', uid);
      if (error) throw error;

      return input.id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.personas(uid!) }),
  });
}

export function useDeleteAIPersona(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (personaId: string) => {
      if (!uid) throw new Error('user required');

      const backup = await db.ai_personas.get(personaId);
      await db.ai_personas.delete(personaId);

      const { error } = await supabase
        .from('ai_personas')
        .delete()
        .eq('id', personaId)
        .eq('user_id', uid)
        .eq('is_default', false); // prevent deletion of default persona

      if (error) {
        if (backup) await db.ai_personas.put(backup);
        throw error;
      }
      return personaId;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.personas(uid!) }),
  });
}

export function useSetDefaultAIPersona(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (personaId: string) => {
      if (!uid) throw new Error('user required');

      // First, unset all other defaults optimistically
      const personas = await db.ai_personas.where({ user_id: uid }).toArray();
      await db.ai_personas.bulkPut(personas.map(p => ({ ...p, is_default: p.id === personaId, updated_at: nowISO() })));

      // Update server: unset all defaults first, then set the new one
      const { error: unsetError } = await supabase
        .from('ai_personas')
        .update({ is_default: false })
        .eq('user_id', uid);
      if (unsetError) throw unsetError;

      const { error: setError } = await supabase
        .from('ai_personas')
        .update({ is_default: true })
        .eq('id', personaId)
        .eq('user_id', uid);
      if (setError) throw setError;

      return personaId;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.personas(uid!) }),
  });
}

export function useUploadAIPersonaAvatar(uid?: string) {
  return useMutation({
    mutationFn: async (input: {
      personaId: string;
      file: File;
    }): Promise<string> => {
      if (!uid) throw new Error('user required');

      // Generate unique filename
      const fileExt = input.file.name.split('.').pop();
      const fileName = `${uid}/${input.personaId}-${Date.now()}.${fileExt}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, input.file, { upsert: true });

      if (uploadError) throw uploadError;

      return fileName;
    },
  });
}