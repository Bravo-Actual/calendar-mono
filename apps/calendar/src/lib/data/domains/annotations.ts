/**
 * User Annotations Data Access Layer
 * Provides CRUD operations for AI highlights and time annotations
 * Follows offline-first architecture patterns
 */

import { createCRUDHooks } from '../base/factory';
import { keys } from '../base/keys';
import { db, type UserAnnotation } from '../base/dexie';
import type {
  ServerUserAnnotationInsert,
  ServerUserAnnotationUpdate
} from '../base/server-types';

/**
 * Complete CRUD operations for user annotations
 */
export const {
  useQuery: useAnnotations,
  useCreate: useCreateAnnotation,
  useUpdate: useUpdateAnnotation,
  useDelete: useDeleteAnnotation,
} = createCRUDHooks<UserAnnotation, ServerUserAnnotationInsert, ServerUserAnnotationUpdate>({
  tableName: 'user_annotations',
  dexieTable: db.user_annotations,
  getQueryKey: (params) => keys.annotations(params?.userId),
  userIdField: 'user_id',
  orderBy: [
    { column: 'start_time', ascending: true },
    { column: 'created_at', ascending: false }
  ],
  messages: {
    createSuccess: 'Annotation created',
    updateSuccess: 'Annotation updated',
    deleteSuccess: 'Annotation removed',
    createError: 'Failed to create annotation',
    updateError: 'Failed to update annotation',
    deleteError: 'Failed to remove annotation'
  }
});

/**
 * Convenience hooks for specific annotation types
 */

// Event highlights (persistent AI event highlights)
export function useEventHighlights(userId: string) {
  return useAnnotations({ userId }, {
    select: (data) => data.filter(annotation =>
      annotation.type === 'ai_event_highlight' && annotation.visible
    )
  });
}

// Time highlights (persistent AI time highlights)
export function useTimeHighlights(userId: string) {
  return useAnnotations({ userId }, {
    select: (data) => data.filter(annotation =>
      annotation.type === 'ai_time_highlight' && annotation.visible
    )
  });
}

// All visible highlights (both event and time)
export function useVisibleHighlights(userId: string) {
  return useAnnotations({ userId }, {
    select: (data) => data.filter(annotation => annotation.visible)
  });
}

/**
 * Helper functions for common operations
 */

// Clear all highlights for a user (when agent clears highlights)
export async function clearAllHighlights(userId: string) {
  await db.user_annotations
    .where('user_id')
    .equals(userId)
    .modify({ visible: false });
}

// Get highlights within time range (for calendar view)
export async function getHighlightsInRange(
  userId: string,
  startMs: number,
  endMs: number
): Promise<UserAnnotation[]> {
  return await db.user_annotations
    .where('user_id')
    .equals(userId)
    .and(annotation =>
      annotation.visible &&
      annotation.start_time_ms < endMs &&
      annotation.end_time_ms > startMs
    )
    .toArray();
}

// Get highlights for specific event
export async function getEventHighlights(
  userId: string,
  eventId: string
): Promise<UserAnnotation[]> {
  return await db.user_annotations
    .where(['user_id', 'event_id'])
    .equals([userId, eventId])
    .and(annotation => annotation.type === 'ai_event_highlight' && annotation.visible)
    .toArray();
}