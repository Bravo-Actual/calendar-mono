// data-v2/domains/user-annotations.ts - User Annotations offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientAnnotation } from '../base/client-types';
import { db } from '../base/dexie';
import { mapAnnotationFromServer, mapAnnotationToServer } from '../base/mapping';
import { addToOutboxWithMerging } from '../base/outbox-utils';
import { pullTable } from '../base/sync';
import { generateUUID, overlaps } from '../base/utils';
import { AnnotationSchema, validateBeforeEnqueue } from '../base/validators';

// Read hooks using useLiveQuery (instant, reactive)
export function useUserAnnotations(uid: string | undefined): ClientAnnotation[] {
  return useLiveQuery(
    async () => {
      if (!uid) return [];

      return await db.user_annotations
        .where('user_id')
        .equals(uid)
        .filter((annotation) => annotation.visible === true)
        .sortBy('start_time');
    },
    [uid],
    [] // Default value prevents undefined
  ) as ClientAnnotation[];
}

export function useAnnotationsRange(
  uid: string | undefined,
  range: { from: number; to: number }
): ClientAnnotation[] {
  return useLiveQuery(
    async () => {
      if (!uid) return [];

      return await db.user_annotations
        .where('user_id')
        .equals(uid)
        .filter(
          (annotation) =>
            annotation.type === 'ai_time_highlight' &&
            annotation.visible === true &&
            annotation.start_time_ms !== null &&
            annotation.end_time_ms !== null &&
            overlaps(range.from, range.to, annotation.start_time_ms, annotation.end_time_ms)
        )
        .sortBy('start_time');
    },
    [uid, range.from, range.to],
    [] // Default value prevents undefined
  ) as ClientAnnotation[];
}

export function useEventHighlightsMap(
  uid: string | undefined,
  range: { from: number; to: number }
): Map<string, { id: string; emoji_icon?: string | null; title?: string | null; message?: string | null }> {
  const highlights = useLiveQuery(
    async () => {
      if (!uid) return [];

      return await db.user_annotations
        .where('user_id')
        .equals(uid)
        .filter(
          (annotation) =>
            annotation.type === 'ai_event_highlight' &&
            annotation.visible === true &&
            annotation.event_id !== null &&
            annotation.start_time_ms !== null &&
            annotation.end_time_ms !== null &&
            overlaps(range.from, range.to, annotation.start_time_ms, annotation.end_time_ms)
        )
        .toArray();
    },
    [uid, range.from, range.to],
    []
  ) as ClientAnnotation[];

  // Build Map from event_id to highlight data
  const map = new Map<
    string,
    { id: string; emoji_icon?: string | null; title?: string | null; message?: string | null }
  >();
  for (const h of highlights) {
    if (h.event_id) {
      map.set(h.event_id, {
        id: h.id,
        emoji_icon: h.emoji_icon,
        title: h.title,
        message: h.message,
      });
    }
  }
  return map;
}

export function useUserAnnotation(uid: string | undefined, annotationId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientAnnotation | undefined> => {
    if (!uid || !annotationId) return undefined;

    const annotation = await db.user_annotations.get(annotationId);
    return annotation?.user_id === uid ? annotation : undefined;
  }, [uid, annotationId]);
}

// Dexie-first mutations with outbox pattern
export async function createAnnotation(
  uid: string,
  input: {
    type: 'ai_event_highlight' | 'ai_time_highlight';
    event_id?: string | null;
    start_time: string; // ISO UTC string (from AI tools)
    end_time: string; // ISO UTC string (from AI tools)
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
    visible?: boolean;
    expires_at?: string | null; // ISO UTC string, defaults to 7 days from now if not provided
  }
): Promise<ClientAnnotation> {
  const id = generateUUID();
  const now = new Date();
  const startDate = new Date(input.start_time);
  const endDate = new Date(input.end_time);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Default expires_at to 7 days from now if not explicitly provided
  const expiresAt = input.expires_at
    ? new Date(input.expires_at)
    : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const annotation: ClientAnnotation = {
    id,
    user_id: uid,
    type: input.type,
    event_id: input.event_id ?? null,
    start_time: startDate,
    end_time: endDate,
    start_time_ms: startMs, // Will be recalculated by DB but we provide for client-side UX
    end_time_ms: endMs, // Will be recalculated by DB but we provide for client-side UX
    emoji_icon: input.emoji_icon ?? null,
    title: input.title ?? null,
    message: input.message ?? null,
    visible: input.visible ?? true,
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate Date objects before enqueue (catches bad dates early)
  const validatedAnnotation = validateBeforeEnqueue(AnnotationSchema, annotation);

  // 2. Write to Dexie first (instant optimistic update)
  await db.user_annotations.put(validatedAnnotation);

  // 3. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapAnnotationToServer(validatedAnnotation);
  await addToOutboxWithMerging(uid, 'user_annotations', 'insert', serverPayload, id);

  return annotation;
}

export async function updateAnnotation(
  uid: string,
  annotationId: string,
  input: {
    start_time?: string;
    end_time?: string;
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
    visible?: boolean;
    expires_at?: string | null;
  }
): Promise<void> {
  // 1. Get existing annotation from Dexie
  const existing = await db.user_annotations.get(annotationId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Annotation not found or access denied');
  }

  const now = new Date();
  const updated: ClientAnnotation = {
    ...existing,
    ...input,
    start_time: input.start_time ? new Date(input.start_time) : existing.start_time,
    end_time: input.end_time ? new Date(input.end_time) : existing.end_time,
    start_time_ms: input.start_time ? Date.parse(input.start_time) : existing.start_time_ms,
    end_time_ms: input.end_time ? Date.parse(input.end_time) : existing.end_time_ms,
    expires_at:
      input.expires_at !== undefined
        ? input.expires_at
          ? new Date(input.expires_at)
          : null
        : existing.expires_at,
    updated_at: now,
  };

  // 2. Validate Date objects before enqueue (catches bad dates early)
  const validatedAnnotation = validateBeforeEnqueue(AnnotationSchema, updated);

  // 3. Update in Dexie first (instant optimistic update)
  await db.user_annotations.put(validatedAnnotation);

  // 4. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapAnnotationToServer(validatedAnnotation);
  await addToOutboxWithMerging(uid, 'user_annotations', 'update', serverPayload, annotationId);
}

export async function deleteAnnotation(uid: string, annotationId: string): Promise<void> {
  // 1. Get existing annotation from Dexie
  const existing = await db.user_annotations.get(annotationId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Annotation not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.user_annotations.delete(annotationId);

  // 3. Enqueue in outbox for eventual server sync
  await addToOutboxWithMerging(
    uid,
    'user_annotations',
    'delete',
    { id: annotationId },
    annotationId
  );
}

export async function deleteAnnotationsByType(
  uid: string,
  type: 'ai_event_highlight' | 'ai_time_highlight'
): Promise<void> {
  // 1. Get all annotations of this type for the user
  const annotations = await db.user_annotations
    .where('user_id')
    .equals(uid)
    .filter((annotation) => annotation.type === type)
    .toArray();

  // 2. Delete all from Dexie first (instant optimistic update)
  await db.user_annotations.bulkDelete(annotations.map((a) => a.id));

  // 3. Enqueue each deletion in outbox for eventual server sync
  for (const annotation of annotations) {
    await addToOutboxWithMerging(
      uid,
      'user_annotations',
      'delete',
      { id: annotation.id },
      annotation.id
    );
  }
}

// Convenience functions for specific annotation types
export async function createEventHighlight(
  uid: string,
  input: {
    event_id: string;
    start_time: string;
    end_time: string;
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
    expires_at?: string | null;
  }
): Promise<ClientAnnotation> {
  return createAnnotation(uid, { ...input, type: 'ai_event_highlight' });
}

export async function createTimeHighlight(
  uid: string,
  input: {
    start_time: string;
    end_time: string;
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
    expires_at?: string | null;
  }
): Promise<ClientAnnotation> {
  return createAnnotation(uid, { ...input, type: 'ai_time_highlight', event_id: null });
}

export async function toggleAnnotationVisibility(
  uid: string,
  annotationId: string,
  visible: boolean
): Promise<void> {
  return updateAnnotation(uid, annotationId, { visible });
}

// Sync functions using the centralized infrastructure
export async function pullAnnotations(userId: string): Promise<void> {
  return pullTable('user_annotations', userId, mapAnnotationFromServer);
}
