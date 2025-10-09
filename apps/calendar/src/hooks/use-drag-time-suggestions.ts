import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { SystemSlot } from '@/components/types';
import type { EventResolved } from '@/lib/data-v2';
import { db } from '@/lib/data-v2/base/dexie';
import { useAvailableTimeSlots } from './use-free-busy';

interface DragTimeSuggestionsOptions {
  isDragging: boolean;
  draggedEvent: EventResolved | null;
  currentUserId: string | undefined;
  dateRange: { startDate: Date; endDate: Date };
  slotDurationMinutes?: number;
}

/**
 * Hook to show time suggestions when dragging an event
 * Finds available times when all attendees (including current user) are free
 */
export function useDragTimeSuggestions(options: DragTimeSuggestionsOptions): SystemSlot[] {
  const { isDragging, draggedEvent, currentUserId, dateRange, slotDurationMinutes = 30 } = options;

  // Fetch event users for the dragged event
  const eventUsers = useLiveQuery(async () => {
    if (!isDragging || !draggedEvent) return [];
    return await db.event_users.where('event_id').equals(draggedEvent.id).toArray();
  }, [isDragging, draggedEvent?.id]);

  // Extract attendee user IDs from the event users
  const attendeeUserIds = useMemo(() => {
    if (!isDragging || !draggedEvent || !currentUserId) return [];

    const ids = new Set<string>();

    // Always include current user
    ids.add(currentUserId);

    // Add owner if different from current user
    if (draggedEvent.owner_id && draggedEvent.owner_id !== currentUserId) {
      ids.add(draggedEvent.owner_id);
    }

    // Add all event users
    if (eventUsers) {
      eventUsers.forEach((eventUser) => {
        if (eventUser.user_id) {
          ids.add(eventUser.user_id);
        }
      });
    }

    const result = Array.from(ids);
    console.log('[useDragTimeSuggestions] attendeeUserIds:', result, {
      isDragging,
      draggedEventId: draggedEvent?.id,
      eventUsersCount: eventUsers?.length,
    });
    return result;
  }, [isDragging, draggedEvent, currentUserId, eventUsers]);

  // Calculate start time as now (or dateRange start if later), rounded to next 15-min increment
  const searchStartDate = useMemo(() => {
    const now = new Date();
    const useDate = now > dateRange.startDate ? now : dateRange.startDate;

    // Round up to next 15-minute increment
    const ms = useDate.getTime();
    const roundedMs = Math.ceil(ms / (15 * 60 * 1000)) * (15 * 60 * 1000);
    return new Date(roundedMs);
  }, [dateRange.startDate]);

  // Fetch available time slots when all users are free
  const { data: availableSlots } = useAvailableTimeSlots({
    userIds: attendeeUserIds,
    startDate: searchStartDate,
    endDate: dateRange.endDate,
    slotDurationMinutes,
    slotIncrementMinutes: 15, // Check every 15 minutes
    requestingUserId: currentUserId,
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Convert AvailableTimeSlot[] to SystemSlot[] format and merge consecutive blocks
  const suggestions = useMemo(() => {
    console.log('[useDragTimeSuggestions] Computing suggestions:', {
      isDragging,
      availableSlotsCount: availableSlots?.length,
      attendeeUserIdsCount: attendeeUserIds.length,
    });

    // Only show suggestions if there are other attendees besides the current user
    if (!isDragging || !availableSlots || availableSlots.length === 0 || attendeeUserIds.length <= 1) return [];

    // Only show slots where all users are free
    const freeSlots = availableSlots
      .filter((slot) => slot.all_users_free)
      .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());

    console.log('[useDragTimeSuggestions] Free slots found:', freeSlots.length);

    // Merge consecutive/overlapping slots into solid blocks
    const mergedBlocks: Array<{ start: number; end: number }> = [];

    for (const slot of freeSlots) {
      const startMs = new Date(slot.slot_start).getTime();
      const endMs = new Date(slot.slot_end).getTime();

      if (mergedBlocks.length === 0) {
        // First block
        mergedBlocks.push({ start: startMs, end: endMs });
      } else {
        const lastBlock = mergedBlocks[mergedBlocks.length - 1];

        // If this slot overlaps or touches the last block, extend it
        if (startMs <= lastBlock.end) {
          lastBlock.end = Math.max(lastBlock.end, endMs);
        } else {
          // New separate block
          mergedBlocks.push({ start: startMs, end: endMs });
        }
      }
    }

    console.log('[useDragTimeSuggestions] Merged into blocks:', mergedBlocks.length);

    // Convert merged blocks to SystemSlot format, limit to top 15
    const result = mergedBlocks.slice(0, 15).map((block, index) => {
      const startDate = new Date(block.start);
      const endDate = new Date(block.end);

      console.log(`Block ${index}:`, {
        start: startDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }),
        end: endDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }),
        startHour: startDate.getHours(),
        endHour: endDate.getHours(),
      });

      return {
        id: `drag-suggestion-${index}-${block.start}`,
        startAbs: block.start,
        endAbs: block.end,
        reason: 'Available for all attendees',
      };
    });

    console.log('[useDragTimeSuggestions] Returning suggestions:', result.length);
    return result;
  }, [isDragging, availableSlots, attendeeUserIds.length]);

  return suggestions;
}
