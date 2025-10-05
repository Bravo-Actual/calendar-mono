import { useMemo } from 'react';
import type { CalendarOperations, TimeItem } from '../types';

interface UseCalendarOperationsParams<_T extends TimeItem> {
  userId: string | undefined;
  onDelete: (userId: string, itemId: string) => Promise<void>;
  onUpdate: (
    userId: string,
    itemId: string,
    updates: { start_time?: Date; end_time?: Date }
  ) => Promise<void>;
}

/**
 * Hook for calendar grid CRUD operations (move, resize, delete)
 * Extracted from calendar page for reusability in packaged component
 */
export function useCalendarOperations<T extends TimeItem>({
  userId,
  onDelete,
  onUpdate,
}: UseCalendarOperationsParams<T>): CalendarOperations<T> {
  const operations = useMemo(
    () => ({
      delete: async (item: T) => {
        if (!userId) return;
        try {
          await onDelete(userId, item.id);
        } catch (error) {
          console.error('Failed to delete event:', error);
        }
      },
      move: async (item: T, newTimes: { start: Date; end: Date }) => {
        if (!userId) return;
        try {
          await onUpdate(userId, item.id, {
            start_time: newTimes.start,
            end_time: newTimes.end,
          });
        } catch (error) {
          console.error('Failed to move event:', error);
        }
      },
      resize: async (item: T, newTimes: { start: Date; end: Date }) => {
        if (!userId) return;
        try {
          await onUpdate(userId, item.id, {
            start_time: newTimes.start,
            end_time: newTimes.end,
          });
        } catch (error) {
          console.error('Failed to resize event:', error);
        }
      },
    }),
    [userId, onDelete, onUpdate]
  );

  return operations;
}
