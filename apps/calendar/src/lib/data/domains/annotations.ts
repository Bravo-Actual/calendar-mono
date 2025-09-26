// domains/annotations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { mapAnnotationFromServer } from '../base/mapping';
import { generateUUID, nowISO, overlaps } from '../base/utils';
import type { ClientAnnotation } from '../base/client-types';

export function useUserAnnotations(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.annotations(uid) : ['annotations:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientAnnotation[]> => {
      const { data, error } = await supabase
        .from('user_annotations')
        .select('*')
        .eq('user_id', uid!)
        .eq('visible', true)
        .order('start_time');
      if (error) throw error;

      const rows = (data ?? []).map(mapAnnotationFromServer);
      await db.user_annotations.bulkPut(rows);
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnnotationsRange(uid: string | undefined, range: { from: number; to: number }) {
  return useQuery({
    queryKey: uid ? keys.annotationsRange(uid, range.from, range.to) : ['annotations:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientAnnotation[]> => {
      const { data, error } = await supabase
        .from('user_annotations')
        .select('*')
        .eq('user_id', uid!)
        .eq('visible', true)
        .gte('end_time_ms', range.from)
        .lte('start_time_ms', range.to)
        .order('start_time');
      if (error) throw error;

      const rows = (data ?? []).map(mapAnnotationFromServer);
      await db.user_annotations.bulkPut(rows);
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAnnotation(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: 'ai_event_highlight' | 'ai_time_highlight';
      event_id?: string | null; // required for ai_event_highlight
      start_time: string; // ISO UTC
      end_time: string;   // ISO UTC
      emoji_icon?: string | null;
      title?: string | null;
      message?: string | null;
      visible?: boolean;
    }): Promise<ClientAnnotation> => {
      if (!uid) throw new Error('user required');

      const id = generateUUID();
      const startMs = Date.parse(input.start_time);
      const endMs = Date.parse(input.end_time);
      const now = nowISO();

      const optimistic: ClientAnnotation = {
        id,
        user_id: uid,
        type: input.type,
        event_id: input.event_id ?? null,
        start_time: input.start_time,
        end_time: input.end_time,
        start_time_ms: startMs,
        end_time_ms: endMs,
        emoji_icon: input.emoji_icon ?? null,
        title: input.title ?? null,
        message: input.message ?? null,
        visible: input.visible ?? true,
        created_at: now,
        updated_at: now,
      };

      await db.user_annotations.put(optimistic);

      // Update cache for both range and non-range annotation queries
      qc.setQueriesData({ queryKey: ['annotations'], predicate: q => {
        const [, vars] = q.queryKey as [string, { uid?: string, from?: number, to?: number }];
        if (vars?.uid !== uid) return false;

        // Update non-range queries (useUserAnnotations)
        if (vars?.from === undefined && vars?.to === undefined) return true;

        // Update range queries (useAnnotationsRange) only if they overlap
        if (vars?.from !== undefined && vars?.to !== undefined) {
          return overlaps(vars.from, vars.to, startMs, endMs);
        }

        return false;
      }}, (old?: ClientAnnotation[]) => {
        console.log('✅ Optimistic annotation cache update:', {
          oldCount: old?.length || 0,
          newAnnotationId: optimistic.id,
          newAnnotationType: optimistic.type
        });
        if (!old) return [optimistic];
        return [...old, optimistic].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      });

      const { data: server, error } = await supabase
        .from('user_annotations')
        .insert({
          id,
          user_id: uid,
          type: input.type,
          event_id: input.event_id,
          start_time: input.start_time,
          end_time: input.end_time,
          emoji_icon: input.emoji_icon,
          title: input.title,
          message: input.message,
          visible: input.visible ?? true,
        })
        .select()
        .single();
      if (error) throw error;

      const result = mapAnnotationFromServer(server);
      await db.user_annotations.put(result);
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['annotations'] }),
  });
}

export function useUpdateAnnotation(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      start_time?: string;
      end_time?: string;
      emoji_icon?: string | null;
      title?: string | null;
      message?: string | null;
      visible?: boolean;
    }) => {
      if (!uid) throw new Error('user required');

      // optimistic update
      const existing = await db.user_annotations.get(input.id);
      if (existing) {
        const updated = {
          ...existing,
          ...input,
          start_time_ms: input.start_time ? Date.parse(input.start_time) : existing.start_time_ms,
          end_time_ms: input.end_time ? Date.parse(input.end_time) : existing.end_time_ms,
          updated_at: nowISO()
        };
        await db.user_annotations.put(updated);
      }

      const { error } = await supabase
        .from('user_annotations')
        .update({
          start_time: input.start_time,
          end_time: input.end_time,
          emoji_icon: input.emoji_icon,
          title: input.title,
          message: input.message,
          visible: input.visible,
        })
        .eq('id', input.id)
        .eq('user_id', uid);
      if (error) throw error;

      return input.id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['annotations'] }),
  });
}

export function useDeleteAnnotation(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (annotationId: string) => {
      if (!uid) throw new Error('user required');

      const backup = await db.user_annotations.get(annotationId);
      await db.user_annotations.delete(annotationId);

      const { error } = await supabase
        .from('user_annotations')
        .delete()
        .eq('id', annotationId)
        .eq('user_id', uid);

      if (error) {
        if (backup) await db.user_annotations.put(backup);
        throw error;
      }
      return annotationId;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['annotations'] }),
  });
}

// Convenience hooks for specific annotation types
export function useCreateEventHighlight(uid?: string) {
  const create = useCreateAnnotation(uid);
  return useMutation({
    mutationFn: (input: {
      event_id: string;
      start_time: string;
      end_time: string;
      emoji_icon?: string | null;
      title?: string | null;
      message?: string | null;
    }) => create.mutateAsync({ ...input, type: 'ai_event_highlight' })
  });
}

export function useCreateTimeHighlight(uid?: string) {
  const create = useCreateAnnotation(uid);
  return useMutation({
    mutationFn: (input: {
      start_time: string;
      end_time: string;
      emoji_icon?: string | null;
      title?: string | null;
      message?: string | null;
    }) => create.mutateAsync({ ...input, type: 'ai_time_highlight', event_id: null })
  });
}

export function useToggleAnnotationVisibility(uid?: string) {
  const update = useUpdateAnnotation(uid);
  return useMutation({
    mutationFn: ({ annotationId, visible }: { annotationId: string; visible: boolean }) =>
      update.mutateAsync({ id: annotationId, visible })
  });
}

// Direct Dexie-only functions for AI tools (fast local operations)
export async function createAnnotationLocal(userId: string, data: {
  type: 'ai_event_highlight' | 'ai_time_highlight';
  event_id?: string | null;
  start_time: string;
  end_time: string;
  emoji_icon?: string | null;
  title?: string | null;
  message?: string | null;
  visible?: boolean;
}): Promise<ClientAnnotation> {
  if (!userId) throw new Error('user required');

  const id = generateUUID();
  const now = nowISO();
  const startMs = Date.parse(data.start_time);
  const endMs = Date.parse(data.end_time);

  const annotation: ClientAnnotation = {
    id,
    user_id: userId,
    type: data.type,
    event_id: data.event_id || null,
    start_time: data.start_time,
    end_time: data.end_time,
    start_time_ms: startMs,
    end_time_ms: endMs,
    emoji_icon: data.emoji_icon || null,
    title: data.title || null,
    message: data.message || null,
    visible: data.visible ?? true,
    created_at: now,
    updated_at: now,
  };

  // Insert into local Dexie cache only
  await db.user_annotations.put(annotation);
  return annotation;
}

export async function updateAnnotationLocal(userId: string, id: string, updates: Partial<ClientAnnotation>): Promise<void> {
  if (!userId) throw new Error('user required');

  // Update in local Dexie cache only
  await db.user_annotations.update(id, {
    ...updates,
    updated_at: nowISO()
  });
}

export async function deleteAnnotationLocal(userId: string, id: string): Promise<void> {
  if (!userId) throw new Error('user required');

  // Delete from local Dexie cache only
  await db.user_annotations.delete(id);
}

export async function getUserAnnotationsLocal(userId: string): Promise<ClientAnnotation[]> {
  if (!userId) throw new Error('user required');

  // Query from local Dexie cache only
  return await db.user_annotations.where('user_id').equals(userId).toArray();
}

export async function clearAllHighlightsLocal(userId: string): Promise<void> {
  if (!userId) throw new Error('user required');

  // Clear from local Dexie cache only
  await db.user_annotations.where('user_id').equals(userId).delete();
}

// Legacy function for backward compatibility (now Dexie-only)
export async function clearAllHighlights(userId: string) {
  return clearAllHighlightsLocal(userId);
}

export async function clearHighlightsByType(userId: string, type: 'ai_event_highlight' | 'ai_time_highlight') {
  if (!userId) throw new Error('user required');

  // Delete specific type of annotations from database
  const { error } = await supabase
    .from('user_annotations')
    .delete()
    .eq('user_id', userId)
    .eq('type', type);

  if (error) throw error;

  // Clear from local cache
  await db.user_annotations.where({ user_id: userId, type }).delete();
}

export async function bulkUpdateHighlights(userId: string, highlightIds: string[], updates: Partial<ClientAnnotation>) {
  if (!userId) throw new Error('user required');
  if (!highlightIds.length) return [];

  const results = [];
  for (const id of highlightIds) {
    try {
      // Update in database
      const { data, error } = await supabase
        .from('user_annotations')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Update in local cache
      await db.user_annotations.update(id, { ...updates, updated_at: nowISO() });
      results.push({ id, success: true });
    } catch (error) {
      results.push({ id, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}

export async function bulkDeleteHighlights(userId: string, highlightIds: string[]) {
  if (!userId) throw new Error('user required');
  if (!highlightIds.length) return [];

  const results = [];
  for (const id of highlightIds) {
    try {
      // Delete from database
      const { error } = await supabase
        .from('user_annotations')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      // Delete from local cache
      await db.user_annotations.delete(id);
      results.push({ id, success: true });
    } catch (error) {
      results.push({ id, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}