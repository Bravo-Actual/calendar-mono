/**
 * AI Personas Unified Hooks
 * Replaces: use-ai-personas.ts
 *
 * Uses unified factory pattern for consistent CRUD operations
 * with optimistic updates and offline-first approach
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCRUDHooks } from '../base/factory';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { supabase } from '@/lib/supabase';
import type { AIPersona } from '../base/dexie';

// AI Personas hooks using the unified factory
export const aiPersonaHooks = (userId: string | undefined) =>
  createCRUDHooks<AIPersona>({
    tableName: 'ai_personas',
    dexieTable: db.ai_personas,
    getQueryKey: () => keys.personas(userId!),
    userId,
    userIdField: 'user_id',
    select: '*',
    orderBy: [
      { column: 'is_default', ascending: false }, // default persona first
      { column: 'name', ascending: true },
    ],
    messages: {
      createSuccess: 'AI persona created',
      updateSuccess: 'AI persona updated',
      deleteSuccess: 'AI persona deleted',
      createError: 'Failed to create AI persona',
      updateError: 'Failed to update AI persona',
      deleteError: 'Failed to delete AI persona',
    },
    beforeDelete: async (personaId: string) => {
      // Prevent deletion of default persona
      const persona = await db.ai_personas.get(personaId);
      if (persona?.is_default) {
        throw new Error('Cannot delete the default AI persona');
      }
    },
  });

// Export convenience functions for backwards compatibility
export const useAIPersonas = (userId: string | undefined) =>
  aiPersonaHooks(userId).useQuery();

export const useCreateAIPersona = (userId: string | undefined) =>
  aiPersonaHooks(userId).useCreate();

export const useUpdateAIPersona = (userId: string | undefined) =>
  aiPersonaHooks(userId).useUpdate();

export const useDeleteAIPersona = (userId: string | undefined) =>
  aiPersonaHooks(userId).useDelete();

// Utility hook to get the default persona
export function useDefaultAIPersona(userId: string | undefined) {
  const { data: personas } = useAIPersonas(userId);
  return personas?.find(persona => persona.is_default) || null;
}

// Utility hook to set a persona as default (ensures only one default)
export function useSetDefaultAIPersona(userId: string | undefined) {
  const updatePersona = useUpdateAIPersona(userId);

  return async (personaId: string) => {
    if (!userId) throw new Error('User ID required');

    // First, unset all other defaults
    const allPersonas = await db.ai_personas.where('user_id').equals(userId).toArray();
    const updatePromises = allPersonas
      .filter(p => p.is_default && p.id !== personaId)
      .map(p => updatePersona.mutateAsync({ id: p.id, is_default: false }));

    await Promise.all(updatePromises);

    // Then set the target persona as default
    await updatePersona.mutateAsync({ id: personaId, is_default: true });
  };
}

// AI Persona Avatar Upload Hook (simple offline-first)
export function useUploadAIPersonaAvatar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ personaId, avatarFile }: { personaId: string; avatarFile: File }): Promise<{ avatarUrl: string }> => {
      if (!userId) throw new Error('User ID required');

      // Get current persona
      const currentPersona = await db.ai_personas.get(personaId);
      if (!currentPersona) throw new Error('Persona not found');

      // Generate file name (matching original working version)
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to Supabase storage (matching original working options)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Avatar upload failed: ${uploadError.message}`);
      }

      // Update persona in Dexie with the relative path
      const updatedPersona = {
        ...currentPersona,
        avatar_url: filePath,
        updated_at: new Date().toISOString()
      };
      await db.ai_personas.put(updatedPersona);

      // Update cache
      queryClient.setQueryData(keys.personas(userId), (old: AIPersona[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === personaId ? updatedPersona : p);
      });

      return { avatarUrl: filePath };
    },
    onError: (error) => {
      console.error('Error uploading AI persona avatar:', error);
    },
  });
}