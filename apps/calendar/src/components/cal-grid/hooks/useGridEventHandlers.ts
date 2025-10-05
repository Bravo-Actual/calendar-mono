import { useCallback } from 'react';
import type { CalendarGridHandle, CalendarSelection } from '../types';

interface GridSelections {
  items: CalendarSelection[];
  timeRanges: Array<{ type: 'timeRange'; start: Date; end: Date }>;
}

interface UseGridEventHandlersParams {
  userId: string | undefined;
  gridSelections: GridSelections;
  gridApi: React.RefObject<CalendarGridHandle>;
  setGridSelections: (selections: GridSelections) => void;
  clearAllSelections: () => void;
  setSelectedEventIds: (ids: string[]) => void;
  setSelectedTimeRanges: (ranges: Array<{ start: Date; end: Date }>) => void;
  onCreate: (userId: string, eventData: any) => Promise<any>;
  onDelete: (userId: string, itemId: string) => Promise<void>;
  onUpdate: (userId: string, itemId: string, updates: any) => Promise<void>;
}

/**
 * Hook for calendar grid event handlers (create, delete, selection)
 * Extracted from calendar page for reusability in packaged component
 */
export function useGridEventHandlers({
  userId,
  gridSelections,
  gridApi,
  setGridSelections,
  clearAllSelections,
  setSelectedEventIds,
  setSelectedTimeRanges,
  onCreate,
  onDelete,
  onUpdate,
}: UseGridEventHandlersParams) {
  const handleCreateEventsFromGrid = useCallback(async (categoryId: string, categoryName: string) => {
    try {
      const createdEvents = [];
      for (const range of gridSelections.timeRanges) {
        if (userId) {
          const eventData = {
            title: categoryName,
            start_time: range.start,
            end_time: range.end,
            all_day: false,
            private: false,
            category_id: categoryId,
          };
          const createdEvent = await onCreate(userId, eventData);
          createdEvents.push(createdEvent);
        }
      }

      // Use the new API to clear old selections and select new events
      if (gridApi.current) {
        // First clear all existing selections (including time ranges)
        gridApi.current.clearSelections();

        if (createdEvents.length > 0) {
          // Then select the newly created events
          gridApi.current.selectItems(createdEvents.map((e) => e.id));
        }
      }
    } catch (error) {
      console.error('Error in handleCreateEventsFromGrid:', error);
    }
  }, [gridSelections.timeRanges, userId, onCreate, gridApi]);

  const handleDeleteSelectedFromGrid = useCallback(async () => {
    const eventSelections = gridSelections.items.filter((item) => item.type === 'event' && item.id);
    for (const selection of eventSelections) {
      if (selection.id && userId) {
        await onDelete(userId, selection.id);
      }
    }
    // Clear grid selections (local and app store)
    setGridSelections({ items: [], timeRanges: [] });
    clearAllSelections();
  }, [gridSelections.items, userId, onDelete, setGridSelections, clearAllSelections]);

  const handleGridSelectionsChange = useCallback(
    (selections: CalendarSelection[]) => {
      // Update local state with grid selections (for ActionBar)
      const items = selections.filter((s) => s.type !== 'timeRange');
      const timeRanges = selections
        .filter((s) => s.type === 'timeRange')
        .map((s) => ({
          type: 'timeRange' as const,
          start: s.start_time!,
          end: s.end_time!,
        }));
      setGridSelections({ items, timeRanges });

      // Update app store with selections (for AI integration)
      const eventIds = items
        .filter((item) => item.type === 'event' && item.id)
        .map((item) => item.id!)
        .filter(Boolean);

      const timeRangesForStore = timeRanges.map((range) => ({
        start: range.start,
        end: range.end,
      }));

      setSelectedEventIds(eventIds);
      setSelectedTimeRanges(timeRangesForStore);
    },
    [setGridSelections, setSelectedEventIds, setSelectedTimeRanges]
  );

  const handleRenameEvents = useCallback(
    async (newTitle: string) => {
      const eventSelections = gridSelections.items.filter(
        (item) => item.type === 'event' && item.id
      );

      for (const selection of eventSelections) {
        if (selection.id && userId) {
          await onUpdate(userId, selection.id, { title: newTitle });
        }
      }
    },
    [gridSelections.items, userId, onUpdate]
  );

  const getSelectedEventState = useCallback(
    (field: string) => {
      const selectedEvents = gridSelections.items.filter(
        (item) => item.type === 'event' && item.data
      );
      if (selectedEvents.length === 0) return undefined;

      const values = selectedEvents.map((item) => {
        const itemData = item.data as { eventData?: any };
        const eventData = itemData?.eventData;
        if (field === 'online_event') return eventData?.online_event || false;
        if (field === 'in_person') return eventData?.in_person || false;
        if (field === 'private') return eventData?.private || false;
        if (field === 'show_time_as') return eventData?.personal_details?.show_time_as || 'busy';
        if (field === 'calendar_id') return eventData?.calendar?.id || null;
        if (field === 'category_id') return eventData?.category?.id || null;
        return undefined;
      });

      // Return the value if all are the same, undefined if mixed
      const uniqueValues = [...new Set(values)].filter(v => v !== null);
      return uniqueValues.length === 1 ? uniqueValues[0] : undefined;
    },
    [gridSelections.items]
  );

  return {
    handleCreateEventsFromGrid,
    handleDeleteSelectedFromGrid,
    handleGridSelectionsChange,
    handleRenameEvents,
    getSelectedEventState,
  };
}
