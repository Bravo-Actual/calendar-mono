/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Temporal } from '@js-temporal/polyfill';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type React from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useDragTimeSuggestions } from '@/hooks/use-drag-time-suggestions';
import { cn } from '@/lib/utils';
import { DayColumn } from './DayColumn';
import { ItemHost } from './ItemHost';
import { TimeGutter } from './TimeGutter';
import type {
  CalendarGridHandle,
  CalendarGridProps,
  CalendarSelection,
  DragState,
  TimeItem,
} from './types';
import {
  computePlacements,
  createGeometry,
  findDayIndexForDate,
  fmtDay,
  mergeMaps,
  mergeRanges,
  minutes,
  minuteToY,
  snap,
  snapTo,
  startOfDay,
  startOfDayInTimezone,
  toDate,
  yToMinute,
} from './utils';

// Get timezone abbreviation from timezone identifier
function getTimezoneAbbreviation(timeZone: string): string {
  try {
    // Use a date in the middle of the year to avoid DST issues
    const date = new Date('2024-07-01T12:00:00Z');
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find((part) => part.type === 'timeZoneName');

    if (timeZonePart?.value) {
      return timeZonePart.value;
    }

    // Fallback: extract from timezone identifier
    const parts2 = timeZone.split('/');
    const city = parts2[parts2.length - 1];
    return city.slice(0, 3).toUpperCase();
  } catch {
    // Final fallback
    return 'TZ';
  }
}

export const CalendarGrid = forwardRef(function CalendarGrid<
  T extends TimeItem,
  R extends TimeItem = TimeItem,
>(
  {
    items: initialItems,
    rangeItems,
    eventHighlights,
    viewMode,
    dateRangeType,
    startDate,
    customDayCount,
    weekStartDay = 0,
    selectedDates = [],
    pxPerHour = 96,
    snapMinutes = 15,
    gridMinutes = 30,
    gutterWidth = 80,
    operations,
    onSelectionChange,
    onSelectionsChange,
    onSelectedItemsChange,
    selections,
    renderItem,
    renderRange,
    onRangeClick,
    renderSelection,
    className = '',
    timeZones = [
      {
        label: 'Local',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hour12: true,
      },
    ],
    workSchedule,
    expandedDay = null,
    onExpandedDayChange,
    selectedIds, // Legacy prop
    timeSelectionMode = false,
    onTimeSelection,
    onTimeSelectionDismiss,
  }: CalendarGridProps<T, R>,
  ref: React.Ref<CalendarGridHandle>
) {
  // Generate days array from app store props
  const days = useMemo(() => {
    if (viewMode === 'dateArray' && selectedDates.length > 0) {
      // Date Array mode: return the selected dates sorted
      return [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    }

    // Date Range mode: generate array of dates from startDate and type
    if (!startDate || !dateRangeType) {
      return [];
    }

    let dayCount = 1;
    let calculatedStartDate = new Date(startDate);

    switch (dateRangeType) {
      case 'day':
        dayCount = 1;
        break;
      case 'week': {
        dayCount = 7;
        // Adjust to week start based on user preference
        const dayOfWeek = startDate.getDay();
        const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromWeekStart);
        break;
      }
      case 'workweek': {
        dayCount = 5;
        // Adjust to week start (Monday for work week)
        const currentDay = startDate.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromMonday);
        break;
      }
      case 'custom-days':
        dayCount = customDayCount || 1;
        break;
    }

    // Generate array of consecutive dates
    const generatedDays: Date[] = [];
    const current = new Date(calculatedStartDate);

    for (let i = 0; i < dayCount; i++) {
      generatedDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return generatedDays;
  }, [viewMode, selectedDates, startDate, dateRangeType, customDayCount, weekStartDay]);

  // Track day count changes to optimize navigation
  const dayCount = days.length;
  const [previousDayCount, setPreviousDayCount] = useState(dayCount);
  const [_gridKey, setGridKey] = useState(0);

  // Only remount grid when day count changes, not when dates change
  useEffect(() => {
    if (dayCount !== previousDayCount) {
      setGridKey((prev) => prev + 1);
      setPreviousDayCount(dayCount);
    }
  }, [dayCount, previousDayCount]);

  // Use stable keys for same day count navigation
  const _shouldUseStableKeys = dayCount === previousDayCount;

  // Custom collision detection for cross-container drags
  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerIntersections = pointerWithin(args);
    if (pointerIntersections.length > 0) {
      return pointerIntersections;
    }
    return rectIntersection(args);
  }, []);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Geometry configuration - stable reference
  const geometry = useMemo(
    () =>
      createGeometry({
        minuteHeight: pxPerHour / 60,
        snapMinutes,
        gridMinutes,
        topOffset: 8, // Ensure consistent geometry
      }),
    [pxPerHour, snapMinutes, gridMinutes]
  );

  // Scroll to 7:30 AM on initial load
  useEffect(() => {
    if (containerRef.current && !hasScrolledToMorning.current) {
      // Calculate Y position for 7:30 AM (7.5 hours * 60 minutes = 450 minutes)
      const morningMinutes = 7.5 * 60; // 7:30 AM
      const scrollY = minuteToY(morningMinutes, geometry);

      // Scroll to position
      containerRef.current.scrollTop = scrollY;
      hasScrolledToMorning.current = true;
    }
  }, [geometry]); // Re-run if geometry changes

  // Use items directly from props (data-bound)
  const items = initialItems;

  // Selection state management
  const [internalSelections, setInternalSelections] = useState<CalendarSelection[]>([]);

  // Use external selections if provided, otherwise use internal
  const currentSelections = selections || internalSelections;

  // Track drag state for time suggestions
  const { user } = useAuth();
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const draggedEvent = useMemo(() => {
    if (!draggedEventId) return null;
    return items.find((item) => item.id === draggedEventId) || null;
  }, [draggedEventId, items]);

  // TODO: For distribution, move this hook to parent component and pass suggestions as prop
  // This hook depends on app-specific data layer (Dexie, useAvailableTimeSlots)
  // Option: Add onDragStateChange callback prop, let parent call hook and pass results back
  // Get time suggestions based on attendee availability during drag
  const dragTimesuggestions = useDragTimeSuggestions({
    isDragging: !!draggedEventId,
    draggedEvent: draggedEvent as any, // EventResolved type
    currentUserId: user?.id,
    dateRange: {
      startDate: days[0] || new Date(),
      // Extend to end of last visible day plus 7 more days
      endDate: new Date((days[days.length - 1] || new Date()).getTime() + 8 * 24 * 60 * 60 * 1000),
    },
    slotDurationMinutes: draggedEvent
      ? Math.round(
          (new Date(draggedEvent.end_time).getTime() -
            new Date(draggedEvent.start_time).getTime()) /
            60000
        )
      : 30,
    userTimezone: timeZones[0]?.timeZone,
  });

  // Merge drag suggestions with existing rangeItems
  const mergedRangeItems = useMemo(() => {
    console.log('[CalendarGrid] Merging range items:', {
      rangeItemsCount: rangeItems?.length,
      dragTimesuggestionsCount: dragTimesuggestions.length,
      draggedEventId,
    });

    if (!rangeItems) return dragTimesuggestions;
    if (dragTimesuggestions.length === 0) return rangeItems;
    // During drag, show only drag suggestions
    return dragTimesuggestions;
  }, [rangeItems, dragTimesuggestions, draggedEventId]);

  // Imperative API
  useImperativeHandle(
    ref,
    () => ({
      // Clear operations
      clearSelections: () => {
        setInternalSelections([]);
        onSelectionsChange?.([]);
        // Also clear internal grid state
        setSelection(new Set());
        setHighlightsByDay({});
        setRubberPreviewByDay({});
        setPreview({});
        setLasso(null);
        setOverlayItem(null);
        dragRef.current = null;
      },
      clearItemSelections: (itemIds: string[]) => {
        const filtered = currentSelections.filter((s) => !itemIds.includes(s.id || ''));
        setInternalSelections(filtered);
        onSelectionsChange?.(filtered);
      },
      clearTimeRangeSelections: () => {
        const filtered = currentSelections.filter((s) => s.type !== 'timeRange');
        setInternalSelections(filtered);
        onSelectionsChange?.(filtered);
      },
      clearSelectionsByRange: (ranges) => {
        const filtered = currentSelections.filter((s) => {
          if (s.type !== 'timeRange') return true;
          return !ranges.some(
            (range) =>
              s.start_time?.getTime() === range.start.getTime() &&
              s.end_time?.getTime() === range.end.getTime()
          );
        });
        setInternalSelections(filtered);
        onSelectionsChange?.(filtered);
      },

      // Select operations
      selectItems: (itemIds: string[]) => {
        const newSelections = itemIds
          .map((id) => ({
            type: 'event' as const,
            id,
            data: items.find((item) => item.id === id),
          }))
          .filter((s) => s.data);
        setInternalSelections(newSelections);
        onSelectionsChange?.(newSelections);
        // Also update internal grid state
        setSelection(new Set(itemIds));
      },
      selectAllVisible: () => {
        const allSelections = items.map((item) => ({
          type: 'event' as const,
          id: item.id,
          data: item,
        }));
        setInternalSelections(allSelections);
        onSelectionsChange?.(allSelections);
      },
      selectByType: (type) => {
        const filtered = items
          .filter((item) => item.type === type || 'event')
          .map((item) => ({
            type: type,
            id: item.id,
            data: item,
          }));
        setInternalSelections(filtered);
        onSelectionsChange?.(filtered);
      },
      selectTimeRanges: (ranges) => {
        const timeRangeSelections: CalendarSelection[] = ranges.map((range) => ({
          type: 'timeRange' as const,
          start_time: range.start,
          end_time: range.end,
        }));
        setInternalSelections(timeRangeSelections);
        onSelectionsChange?.(timeRangeSelections);
      },

      // Query operations
      getSelections: () => currentSelections,
      getSelectedItemIds: () => currentSelections.filter((s) => s.id).map((s) => s.id!),
      getSelectedTimeRanges: () =>
        currentSelections
          .filter((s) => s.type === 'timeRange')
          .map((s) => ({ start: s.start_time!, end: s.end_time! })),
      getAllItems: () => items,
    }),
    [currentSelections, items, onSelectionsChange]
  );
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Record<string, { start: Date; end: Date }>>({});
  const [overlayItem, setOverlayItem] = useState<T | null>(null);
  const [resizingItems, setResizingItems] = useState<Set<string>>(new Set());

  // Lasso selection state from demo
  const [lasso, setLasso] = useState<null | {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    sx0: number;
    sx1: number;
    sy0: number;
    sy1: number;
    additive: boolean;
  }>(null);
  const [rubberPreviewByDay, setRubberPreviewByDay] = useState<
    Record<number, Array<{ start: Date; end: Date }>>
  >({});
  const [highlightsByDay, setHighlightsByDay] = useState<
    Record<number, Array<{ start: Date; end: Date }>>
  >({});

  // Sync with external selections when provided
  useEffect(() => {
    if (selections) {
      // Extract event selections and sync with internal selection state
      const eventIds = selections.filter((s) => s.type === 'event' && s.id).map((s) => s.id!);
      setSelection(new Set(eventIds));

      // Extract time range selections and sync with highlights
      const timeRanges = selections
        .filter((s) => s.type === 'timeRange' && s.start_time && s.end_time)
        .map((s) => ({ start: s.start_time!, end: s.end_time! }));

      // Group time ranges by day
      const rangesByDay: Record<number, Array<{ start: Date; end: Date }>> = {};
      timeRanges.forEach((range) => {
        const dayIndex = findDayIndexForDate(range.start, days);
        if (dayIndex >= 0) {
          (rangesByDay[dayIndex] ||= []).push(range);
        }
      });
      setHighlightsByDay(rangesByDay);
    }
  }, [selections, days]);

  // Legacy selectedIds support
  useEffect(() => {
    if (selectedIds && !selections) {
      setSelection(new Set(selectedIds));
    }
  }, [selectedIds, selections]);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);
  const hasScrolledToMorning = useRef<boolean>(false);

  // Callback ref to get viewport reference
  const containerCallbackRef = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    if (element) {
      // For ScrollArea, find the viewport element for scroll operations
      const viewport = element.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
      if (viewport) {
        containerRef.current = viewport;
      }
    }
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    const selectedIds = Array.from(selection);
    onSelectionChange?.(selectedIds);

    // Notify selected items change
    if (onSelectedItemsChange) {
      const selectedItems = items.filter((item) => selectedIds.includes(item.id));
      onSelectedItemsChange(selectedItems);
    }
  }, [selection, onSelectionChange, onSelectedItemsChange, items]);

  // Notify parent of full selections change for app store sync
  useEffect(() => {
    if (onSelectionsChange) {
      const allSelections: CalendarSelection[] = [];

      // Add event selections
      selection.forEach((id) => {
        const item = items.find((i) => i.id === id);
        if (item) {
          allSelections.push({
            type: 'event',
            id,
            data: item,
            start_time: new Date(item.start_time),
            end_time: new Date(item.end_time),
          });
        }
      });

      // Add time range selections
      Object.values(highlightsByDay)
        .flat()
        .forEach((range) => {
          allSelections.push({
            type: 'timeRange',
            start_time: range.start,
            end_time: range.end,
          });
        });

      onSelectionsChange(allSelections);
    }
  }, [selection, highlightsByDay, onSelectionsChange, items.find]);

  // Column widths for expanded day view
  const columnPercents = useMemo(() => {
    const n = days.length;
    if (n === 0) return [] as number[];
    const weights = Array.from({ length: n }, (_, i) =>
      expandedDay === null ? 1 : i === expandedDay ? 4 : 0.8
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / sum) * 100);
  }, [days, expandedDay]);

  // Filter items by day
  const itemsForDay = useCallback(
    (day: Date) => {
      const dayStart = startOfDay(day).getTime();
      return items.filter((it) => {
        const itemStart = startOfDay(toDate(it.start_time)).getTime();
        return itemStart === dayStart;
      });
    },
    [items]
  );

  // Filter range items by day (handles items that span multiple days)
  const rangeItemsForDay = useCallback(
    (day: Date) => {
      if (!mergedRangeItems) return [];
      const dayStartMs = startOfDay(day).getTime();
      const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
      const filtered = mergedRangeItems.filter((it) => {
        // Handle both SystemSlot format (startAbs/endAbs) and TimeItem format (start_time/end_time)
        const itemStart = 'startAbs' in it ? it.startAbs : toDate(it.start_time).getTime();
        const itemEnd = 'endAbs' in it ? it.endAbs : toDate(it.end_time).getTime();
        // Check if range overlaps with this day
        return itemStart < dayEndMs && itemEnd > dayStartMs;
      }) as R[];

      if (filtered.length > 0) {
        console.log('[CalendarGrid] rangeItemsForDay:', {
          day: day.toISOString(),
          dayStartMs,
          dayEndMs,
          totalItems: mergedRangeItems.length,
          filteredCount: filtered.length,
          firstItem: filtered[0],
        });
      }

      return filtered;
    },
    [mergedRangeItems]
  );

  // Build per-day ghost lists from preview
  const ghostsByDay = useMemo(() => {
    const map: Record<
      number,
      Array<{ id: string; title: string; start: Date; end: Date; selected?: boolean }>
    > = {};
    for (const [id, range] of Object.entries(preview)) {
      const it = items.find((x) => x.id === id);
      if (!it) continue;
      const idx = findDayIndexForDate(new Date(range.start), days);
      if (idx < 0) continue;
      const title =
        'title' in it ? (it.title as string) : 'label' in it ? (it.label as string) : '(untitled)';
      (map[idx] ||= []).push({
        id,
        title,
        start: new Date(range.start),
        end: new Date(range.end),
        selected: selection.has(id),
      });
    }
    return map;
  }, [preview, items, days, selection]);

  // Keyboard shortcuts
  const clearAllSelections = useCallback(() => {
    setSelection(new Set());
    setHighlightsByDay({});
    setRubberPreviewByDay({});
    setPreview({});
    setLasso(null);
    setOverlayItem(null);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const isTyping = !!(
        tgt &&
        (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)
      );
      if (isTyping) return;

      if (e.key === 'Escape') {
        clearAllSelections();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        // Select all items (cards) but clear time selections for clarity
        setHighlightsByDay({});
        setRubberPreviewByDay({});
        setLasso(null);
        setSelection(new Set(items.map((i) => i.id)));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only prevent default if not typing in an input
        // Check again here as a safety for edge cases in different browsers
        const target = e.target as HTMLElement;
        const isInputField = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox'
        );

        if (isInputField) return;

        e.preventDefault();
        // Delete selected items using current state
        setSelection((currentSelection) => {
          if (currentSelection.size > 0 && operations?.delete) {
            const selectedItems = items.filter((item) => currentSelection.has(item.id));
            selectedItems.forEach((item) => {
              operations.delete(item).catch(console.error);
            });
            // Return empty set to clear selection after deletion
            return new Set();
          }
          return currentSelection;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, clearAllSelections, operations]);

  // Selection handler with external sync support
  const onSelectMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    const multi = e.ctrlKey || e.metaKey;
    const isRightClick = e.button === 2;

    setSelection((prev) => {
      const next = new Set(prev);

      if (multi) {
        // Multi-select: toggle the clicked item
        next.has(id) ? next.delete(id) : next.add(id);
      } else if (isRightClick && prev.has(id) && prev.size > 1) {
        // Right-click on already selected item with multi-selection: preserve selection
        return prev;
      } else {
        // Single select: clear and add clicked item
        next.clear();
        next.add(id);

        // Also clear time range selections
        setHighlightsByDay({});
      }
      return next;
    });
  }, []);

  // Drag handlers
  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      // Disable drag operations in time selection mode
      if (timeSelectionMode) return;

      const id = String(e.active.id);
      if (id.startsWith('resize:')) {
        const [, edge, itemId] = id.split(':');
        const anchor = items.find((i) => i.id === itemId);
        const idx = anchor ? findDayIndexForDate(toDate(anchor.start_time), days) : 0;
        dragRef.current = {
          kind: 'resize',
          edge: edge as 'start' | 'end',
          id: itemId,
          anchorDayIdx: idx,
        };
        setResizingItems(new Set([itemId]));
        setDraggedEventId(itemId);
        // No overlay for resize operations
      } else if (id.startsWith('move:')) {
        const itemId = id.split(':')[1];
        const anchor = items.find((i) => i.id === itemId);
        const idx = anchor ? findDayIndexForDate(toDate(anchor.start_time), days) : 0;
        dragRef.current = { kind: 'move', id: itemId, anchorDayIdx: idx };
        setOverlayItem(anchor ?? null);
        setDraggedEventId(itemId);
      }
    },
    [items, days, timeSelectionMode]
  );

  // Helper to snap a time to the grid
  const snapTimeToGrid = useCallback((date: Date, snapMinutes: number): Date => {
    const totalMinutes = minutes(date);
    const snappedMinutes = snap(totalMinutes, snapMinutes);
    const result = startOfDay(date);
    result.setMinutes(snappedMinutes);
    return result;
  }, []);

  const onDragMove = useCallback(
    (e: DragMoveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      // Auto-scroll based on current mouse position
      if (containerRef.current && e.active.rect.current.translated) {
        const r = containerRef.current.getBoundingClientRect();
        const M = 32; // Smaller auto-scroll zone
        const speed = 10; // Slower scroll speed

        // Get current mouse position from the dragged element position
        const dragRect = e.active.rect.current.translated;
        const currentY = dragRect.top + dragRect.height / 2;

        if (currentY < r.top + M) {
          containerRef.current.scrollTop -= speed;
        } else if (currentY > r.bottom - M) {
          containerRef.current.scrollTop += speed;
        }
      }

      // Compute day offset via droppable id
      let _dayOffset = 0;
      let dayMinuteDelta = 0;
      const overId = e.over?.id ? String(e.over.id) : null;
      if (overId?.startsWith('day-')) {
        const overIdx = parseInt(overId.split('-')[1], 10);
        _dayOffset = overIdx - drag.anchorDayIdx;

        // Calculate actual time difference between source and target dates
        // This handles both consecutive days (dateRange) and non-consecutive days (dateArray)
        if (days[drag.anchorDayIdx] && days[overIdx]) {
          const sourceDayMs = startOfDay(days[drag.anchorDayIdx]).getTime();
          const targetDayMs = startOfDay(days[overIdx]).getTime();
          dayMinuteDelta = (targetDayMs - sourceDayMs) / 60000; // Convert ms to minutes
        }
      }

      // Pixel delta → minutes delta (don't snap yet)
      const deltaY = e.delta?.y ?? 0;
      const rawDeltaMinutes = Math.round(deltaY / geometry.minuteHeight);

      if (drag.kind === 'move') {
        const activeId = drag.id;
        const ids = selection.has(activeId) ? Array.from(selection) : [activeId];
        const p: Record<string, { start: Date; end: Date }> = {};
        ids.forEach((iid) => {
          const it = items.find((x) => x.id === iid);
          if (!it) return;
          // Calculate raw new times
          const rawStart = new Date(
            toDate(it.start_time).getTime() + (rawDeltaMinutes + dayMinuteDelta) * 60000
          );
          const rawEnd = new Date(
            toDate(it.end_time).getTime() + (rawDeltaMinutes + dayMinuteDelta) * 60000
          );
          // Snap both times to grid
          p[iid] = {
            start: snapTimeToGrid(rawStart, geometry.snapMinutes),
            end: snapTimeToGrid(rawEnd, geometry.snapMinutes),
          };
        });
        setPreview(p);
      } else {
        // Resize operation
        const it = items.find((x) => x.id === drag.id);
        if (!it) return;
        const s = toDate(it.start_time);
        const en = toDate(it.end_time);
        if (drag.edge === 'start') {
          const rawStart = new Date(s.getTime() + rawDeltaMinutes * 60000);
          const snappedStart = snapTimeToGrid(rawStart, geometry.snapMinutes);
          if (snappedStart < en) setPreview({ [it.id]: { start: snappedStart, end: en } });
        } else {
          const rawEnd = new Date(en.getTime() + rawDeltaMinutes * 60000);
          const snappedEnd = snapTimeToGrid(rawEnd, geometry.snapMinutes);
          if (snappedEnd > s) setPreview({ [it.id]: { start: s, end: snappedEnd } });
        }
      }
    },
    [items, selection, geometry, days, snapTimeToGrid]
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDraggedEventId(null);
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) {
        setPreview({});
        setOverlayItem(null);
        return;
      }

      // Compute final day offset
      let _dayOffset = 0;
      let dayMinuteDelta = 0;
      const overId = e.over?.id ? String(e.over.id) : null;
      if (overId?.startsWith('day-')) {
        const overIdx = parseInt(overId.split('-')[1], 10);
        _dayOffset = overIdx - drag.anchorDayIdx;

        // Calculate actual time difference between source and target dates
        // This handles both consecutive days (dateRange) and non-consecutive days (dateArray)
        if (days[drag.anchorDayIdx] && days[overIdx]) {
          const sourceDayMs = startOfDay(days[drag.anchorDayIdx]).getTime();
          const targetDayMs = startOfDay(days[overIdx]).getTime();
          dayMinuteDelta = (targetDayMs - sourceDayMs) / 60000; // Convert ms to minutes
        }
      }

      const deltaY = e.delta?.y ?? 0;
      const rawDeltaMinutes = Math.round(deltaY / geometry.minuteHeight);

      if (drag.kind === 'move') {
        const activeId = drag.id;
        const ids = selection.has(activeId) ? Array.from(selection) : [activeId];

        // Optimistic update - update preview state for immediate visual feedback
        const p: Record<string, { start: Date; end: Date }> = {};
        ids.forEach((id) => {
          const item = items.find((it) => it.id === id);
          if (item) {
            const rawStart = new Date(
              toDate(item.start_time).getTime() + (rawDeltaMinutes + dayMinuteDelta) * 60000
            );
            const rawEnd = new Date(
              toDate(item.end_time).getTime() + (rawDeltaMinutes + dayMinuteDelta) * 60000
            );
            p[id] = {
              start: snapTimeToGrid(rawStart, geometry.snapMinutes),
              end: snapTimeToGrid(rawEnd, geometry.snapMinutes),
            };
          }
        });
        setPreview(p);
      } else {
        // Resize operation - optimistic preview
        const item = items.find((it) => it.id === drag.id);
        if (item) {
          const s = toDate(item.start_time);
          const en = toDate(item.end_time);
          if (drag.edge === 'start') {
            const rawStart = new Date(s.getTime() + rawDeltaMinutes * 60000);
            const snappedStart = snapTimeToGrid(rawStart, geometry.snapMinutes);
            if (snappedStart < en) {
              setPreview({ [drag.id]: { start: snappedStart, end: en } });
            }
          } else {
            const rawEnd = new Date(en.getTime() + rawDeltaMinutes * 60000);
            const snappedEnd = snapTimeToGrid(rawEnd, geometry.snapMinutes);
            if (snappedEnd > s) {
              setPreview({ [drag.id]: { start: s, end: snappedEnd } });
            }
          }
        }
      }

      // Commit changes to data store via operations
      if (operations) {
        if (drag.kind === 'move') {
          const activeId = drag.id;
          const ids = selection.has(activeId) ? Array.from(selection) : [activeId];
          const movePromises = ids.map((id) => {
            const item = items.find((it) => it.id === id);
            if (item) {
              const rawStart = new Date(
                toDate(item.start_time).getTime() + (rawDeltaMinutes + dayMinuteDelta) * 60000
              );
              const rawEnd = new Date(
                toDate(item.end_time).getTime() + (rawDeltaMinutes + dayMinuteDelta) * 60000
              );
              const newStart = snapTimeToGrid(rawStart, geometry.snapMinutes);
              const newEnd = snapTimeToGrid(rawEnd, geometry.snapMinutes);
              return operations.move(item, { start: newStart, end: newEnd });
            }
            return Promise.resolve();
          });
          Promise.all(movePromises).catch(console.error);
        } else if (drag.kind === 'resize') {
          const item = items.find((it) => it.id === drag.id);
          if (item) {
            const s = toDate(item.start_time);
            const en = toDate(item.end_time);
            if (drag.edge === 'start') {
              const rawStart = new Date(s.getTime() + rawDeltaMinutes * 60000);
              const snappedStart = snapTimeToGrid(rawStart, geometry.snapMinutes);
              if (snappedStart < en) {
                operations.resize(item, { start: snappedStart, end: en }).catch(console.error);
              }
            } else {
              const rawEnd = new Date(en.getTime() + rawDeltaMinutes * 60000);
              const snappedEnd = snapTimeToGrid(rawEnd, geometry.snapMinutes);
              if (snappedEnd > s) {
                operations.resize(item, { start: s, end: snappedEnd }).catch(console.error);
              }
            }
          }
        }
      }

      setPreview({});
      setOverlayItem(null);
      setResizingItems(new Set());
    },
    [items, selection, geometry, operations, days, snapTimeToGrid]
  );

  // Lasso constants from demo
  const RUBBER_SNAP_MIN = 15; // lasso/time selection snaps to match main grid

  // Lasso functions from demo
  function beginLasso(e: React.MouseEvent) {
    // Only handle left mouse button (button 0) for lasso selection
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.calendar-item')) return; // don't start on cards

    // In time selection mode, disable additive behavior
    const additive = timeSelectionMode ? false : e.ctrlKey || e.metaKey;
    // Clear any selected event cards when starting a canvas drag without Ctrl/Cmd
    if (!additive) setSelection(new Set());
    const gr = gridRef.current?.getBoundingClientRect();
    if (!gr) return;
    const rx = e.clientX - gr.left;
    const ry = e.clientY - gr.top;
    // snap horizontal edges to the column we start in & compute vertical snap baseline
    let sx0 = rx,
      sx1 = rx,
      firstTop = 0;
    for (let idx = 0; idx < days.length; idx++) {
      const col = columnRefs.current[idx];
      if (!col) continue;
      const cr = col.getBoundingClientRect();
      const left = cr.left - gr.left;
      const right = cr.right - gr.left;
      if (rx >= left && rx <= right) {
        sx0 = left;
        sx1 = right;
        firstTop = cr.top - gr.top;
        break;
      }
    }
    // snap vertical start to 5-minute grid relative to first column's top
    const m0 = snapTo(yToMinute(ry - firstTop, geometry), RUBBER_SNAP_MIN);
    const sy = firstTop + minuteToY(m0, geometry);
    setLasso({ x0: rx, y0: ry, x1: rx, y1: ry, sx0, sx1, sy0: sy, sy1: sy, additive });
    setRubberPreviewByDay({});
  }

  function moveLasso(e: React.MouseEvent) {
    if (!lasso) return;
    const gr = gridRef.current?.getBoundingClientRect();
    if (!gr) return;
    const x1 = e.clientX - gr.left;
    const y1 = e.clientY - gr.top;
    // compute box extents
    const xlo = Math.min(lasso.x0, x1),
      xhi = Math.max(lasso.x0, x1);
    const ylo = Math.min(lasso.y0, y1),
      yhi = Math.max(lasso.y0, y1);

    // determine snapped left/right to column edges spanned by the box and the first-top for vertical snapping
    let snappedLeft = lasso.sx0,
      snappedRight = lasso.sx1;
    let any = false;
    let firstTop = 0;
    const raw: Record<number, Array<{ start: Date; end: Date }>> = {};
    days.forEach((day, idx) => {
      const col = columnRefs.current[idx];
      if (!col) return;
      const cr = col.getBoundingClientRect();
      const left = cr.left - gr.left,
        right = cr.right - gr.left;
      const top = cr.top - gr.top,
        bottom = cr.bottom - gr.top;
      const intersectX = !(xhi < left || xlo > right);
      const intersectY = !(yhi < top || ylo > bottom);
      if (!intersectX || !intersectY) return;
      if (!any) {
        snappedLeft = left;
        snappedRight = right;
        firstTop = top;
        any = true;
      } else {
        snappedLeft = Math.min(snappedLeft, left);
        snappedRight = Math.max(snappedRight, right);
      }
      // vertical snap for this column's preview band (5-minute increments)
      const y0 = Math.max(ylo, top),
        y1c = Math.min(yhi, bottom);
      const m0 = snapTo(yToMinute(y0 - top, geometry), RUBBER_SNAP_MIN);
      const m1 = snapTo(yToMinute(y1c - top, geometry), RUBBER_SNAP_MIN);

      // Create timezone-aware dates for the selection
      const timeZone = timeZones[0]?.timeZone;
      let s: Date, e2: Date;
      if (timeZone) {
        const dayStart = startOfDayInTimezone(day, timeZone);
        const instant = Temporal.Instant.fromEpochMilliseconds(dayStart.getTime());
        const zonedDateTime = instant.toZonedDateTimeISO(timeZone);

        const startZoned = zonedDateTime.add({ minutes: m0 });
        const endZoned = zonedDateTime.add({ minutes: Math.max(m1, m0 + RUBBER_SNAP_MIN) });

        s = new Date(startZoned.epochMilliseconds);
        e2 = new Date(endZoned.epochMilliseconds);
      } else {
        s = new Date(startOfDay(day));
        s.setMinutes(m0);
        e2 = new Date(startOfDay(day));
        e2.setMinutes(Math.max(m1, m0 + RUBBER_SNAP_MIN));
      }

      (raw[idx] ||= []).push({ start: s, end: e2 });
    });
    // During drag preview, only merge overlaps within the current selection
    // Don't merge with existing highlights yet - that happens on mouse up
    const rubberPreview = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [Number(k), mergeRanges(v, RUBBER_SNAP_MIN)])
    );

    // compute snapped rectangle verticals using first intersected column's top; fallback to previous
    let sy0 = lasso.sy0;
    let sy1 = lasso.sy1;
    if (any) {
      const mTop = snapTo(yToMinute(Math.min(ylo, yhi) - firstTop, geometry), RUBBER_SNAP_MIN);
      const mBot = snapTo(yToMinute(Math.max(ylo, yhi) - firstTop, geometry), RUBBER_SNAP_MIN);
      sy0 = firstTop + minuteToY(mTop, geometry);
      sy1 = firstTop + minuteToY(mBot, geometry);
    }

    setLasso((ls) => (ls ? { ...ls, x1, y1, sx0: snappedLeft, sx1: snappedRight, sy0, sy1 } : ls));
    setRubberPreviewByDay(rubberPreview);
  }

  function endLasso() {
    if (!lasso) return;

    // If in time selection mode, use the first selected range for callback
    if (timeSelectionMode && onTimeSelection) {
      const ranges = Object.values(rubberPreviewByDay).flat();
      if (ranges.length > 0) {
        const firstRange = ranges[0];
        onTimeSelection(firstRange.start, firstRange.end);
      }
      setRubberPreviewByDay({});
      setLasso(null);
      return;
    }

    // Normal behavior: commit merged preview (already merged live)
    const merged = lasso.additive
      ? mergeMaps(highlightsByDay, rubberPreviewByDay, RUBBER_SNAP_MIN)
      : Object.fromEntries(
          Object.entries(rubberPreviewByDay).map(([k, v]) => [
            Number(k),
            mergeRanges(v, RUBBER_SNAP_MIN),
          ])
        );

    setHighlightsByDay(merged);
    setRubberPreviewByDay({});
    setLasso(null);
  }

  // Per-day band toggle (Ctrl/Cmd-click to remove a single day)
  const eqRange = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
    a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

  const onHighlightMouseDown = (
    dayIndex: number,
    r: { start: Date; end: Date },
    e: React.MouseEvent
  ) => {
    if (!(e.ctrlKey || e.metaKey)) return; // only toggle on Ctrl/Cmd
    e.stopPropagation();
    setHighlightsByDay((prev) => {
      const cur = prev[dayIndex] || [];
      const next = cur.filter((x) => !eqRange(x, r));
      return { ...prev, [dayIndex]: next };
    });
  };

  // Range item click handler
  const handleRangeMouseDown = useCallback(
    (_e: React.MouseEvent, id: string) => {
      if (!rangeItems || !onRangeClick) return;
      const item = rangeItems.find((it) => it.id === id);
      if (item) {
        onRangeClick(item);
      }
    },
    [rangeItems, onRangeClick]
  );

  // Time slot hover handlers
  const _handleTimeSlotHover = useCallback(
    (_dayIndex: number, _timeRange: { start: Date; end: Date } | null) => {
      // Can be extended for visual feedback if needed
    },
    []
  );

  const handleTimeSlotDoubleClick = useCallback(
    async (_dayIndex: number, timeRange: { start: Date; end: Date }, _e: React.MouseEvent) => {
      // Use operations.create if available to create a new event/item
      if (operations?.create) {
        try {
          const newItems = await operations.create([timeRange]);
          // Select the newly created items if available
          if (newItems && newItems.length > 0) {
            const newIds = newItems.map((item) => item.id);
            setSelection(new Set(newIds));

            // Sync with external selection if callback exists
            onSelectionChange?.(newIds);
            onSelectedItemsChange?.(newItems);
          }
        } catch (error) {
          console.error('Failed to create item from double-click:', error);
        }
      }
    },
    [operations, onSelectionChange, onSelectedItemsChange]
  );

  const guttersWidth = timeZones.length * gutterWidth;

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Day headers */}
      <div className="flex border-b border-border bg-muted/30 relative">
        {/* Time Selection Mode Floating Indicator */}
        <AnimatePresence>
          {timeSelectionMode && (
            <motion.div
              className="pointer-events-none absolute bottom-0 translate-y-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
            >
              <div className="pointer-events-auto bg-background/90 backdrop-blur rounded-xl shadow-lg border flex items-center gap-3 px-4 py-2">
                <span className="text-sm font-medium">Select a time range for the event</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    // Clear any pending selection
                    setSelection(new Set());
                    // Call dismiss callback to exit time selection mode
                    onTimeSelectionDismiss?.();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Time gutter headers */}
        <div className="flex border-r border-border bg-muted/30" style={{ width: guttersWidth }}>
          {timeZones.map((tz) => (
            <div
              key={`header-${tz.timeZone}-${tz.label}`}
              className="flex items-center justify-center text-xs font-medium text-muted-foreground h-12"
              style={{ width: gutterWidth, overflow: 'hidden' }}
            >
              {getTimezoneAbbreviation(tz.timeZone)}
            </div>
          ))}
        </div>

        {/* Day header buttons */}
        <div className="flex-1 flex">
          <AnimatePresence>
            {days.map((d, i) => (
              <motion.div
                key={
                  viewMode === 'dateArray' || dateRangeType === 'custom-days'
                    ? d.toISOString()
                    : `col-${d.getDay()}`
                }
                className="relative overflow-hidden flex"
                initial={{ flex: 0 }}
                animate={{
                  opacity: 1,
                  flex: columnPercents[i] ?? 100 / days.length,
                }}
                exit={{ opacity: 0, flex: 0 }}
                transition={{
                  flex: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.3, ease: 'easeOut' },
                }}
              >
                <Button
                  variant="ghost"
                  className={cn(
                    'flex-1 h-12 rounded-none border-r border-border last:border-r-0 font-medium text-sm text-left justify-start',
                    expandedDay === i && 'border-b-2 border-b-primary'
                  )}
                  onClick={() => onExpandedDayChange?.(expandedDay === i ? null : i)}
                >
                  {fmtDay(d)}
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Calendar body */}
      <ScrollArea className="flex-1 h-0" ref={containerCallbackRef}>
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          collisionDetection={collisionDetectionStrategy}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          <div
            className="flex"
            ref={gridRef}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('.calendar-item')) return;
              // In time selection mode, always clear selection
              if (timeSelectionMode || !(e.ctrlKey || e.metaKey)) setSelection(new Set());
              e.preventDefault();
              beginLasso(e);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseMove={moveLasso}
            onMouseUp={endLasso}
            style={{
              userSelect: lasso ? 'none' : undefined,
              cursor: timeSelectionMode ? 'crosshair' : undefined,
            }}
          >
            {/* Time gutters */}
            <div className="flex" style={{ width: guttersWidth }}>
              {timeZones.map((tz, _i) => (
                <div
                  key={`${tz.timeZone}-${tz.label}`}
                  style={{ width: gutterWidth, overflow: 'hidden' }}
                >
                  <TimeGutter
                    config={tz}
                    geometry={geometry}
                    width={gutterWidth}
                    className="border-r border-border bg-background"
                  />
                </div>
              ))}
            </div>

            {/* Day columns container */}
            <div className="flex-1 flex relative">
              <AnimatePresence>
                {days.map((day, i) => (
                  <motion.div
                    key={
                      viewMode === 'dateArray' || dateRangeType === 'custom-days'
                        ? day.toISOString()
                        : `col-${day.getDay()}`
                    }
                    className="relative border-r border-border/30 last:border-r-0"
                    initial={{ flex: 0 }}
                    animate={{
                      flex: columnPercents[i] ?? 100 / days.length,
                    }}
                    exit={{ flex: 0 }}
                    transition={{
                      flex: { type: 'spring', stiffness: 300, damping: 30 },
                    }}
                  >
                    <DayColumn
                      id={`day-${i}`}
                      dayStart={day}
                      dayIndex={i}
                      items={itemsForDay(day)}
                      rangeItems={rangeItemsForDay(day)}
                      eventHighlights={eventHighlights}
                      selection={selection}
                      onSelectMouseDown={onSelectMouseDown}
                      setColumnRef={(el) => (columnRefs.current[i] = el)}
                      ghosts={ghostsByDay[i]}
                      highlights={lasso && !lasso.additive ? [] : highlightsByDay[i]}
                      rubber={rubberPreviewByDay[i]}
                      onHighlightMouseDown={onHighlightMouseDown}
                      renderItem={renderItem}
                      renderRange={renderRange}
                      onRangeMouseDown={handleRangeMouseDown}
                      geometry={geometry}
                      resizingItems={resizingItems}
                      className=""
                      renderSelection={renderSelection}
                      onTimeSlotHover={undefined}
                      onTimeSlotDoubleClick={handleTimeSlotDoubleClick}
                      isDragging={!!lasso || !!dragRef.current}
                      workPeriods={workSchedule?.filter((p) => p.weekday === day.getDay())}
                      timeZone={timeZones[0]?.timeZone}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Lasso rectangle */}
              {lasso && (
                <div
                  className="absolute bg-primary/10 border border-primary pointer-events-none z-0"
                  style={{
                    left: Math.min(lasso.sx0, lasso.sx1) - guttersWidth,
                    top: Math.min(lasso.sy0, lasso.sy1),
                    width: Math.abs(lasso.sx1 - lasso.sx0),
                    height: Math.abs(lasso.sy1 - lasso.sy0),
                  }}
                />
              )}
            </div>
          </div>

          {/* Global drag overlay */}
          <DragOverlay dropAnimation={null}>
            {overlayItem
              ? (() => {
                  const s = toDate(overlayItem.start_time);
                  const e = toDate(overlayItem.end_time);
                  const height = Math.max(
                    24,
                    minuteToY(minutes(e), geometry) - minuteToY(minutes(s), geometry)
                  );

                  // Get the day index and calculate placements to match original width
                  const drag = dragRef.current;
                  const dayIdx = drag?.anchorDayIdx ?? 0;
                  const dayItems = itemsForDay(days[dayIdx]);
                  const placements = computePlacements(dayItems);
                  const plc = placements[overlayItem.id] || { lane: 0, lanes: 1 };

                  // Get actual column width
                  const columnRef = columnRefs.current[dayIdx];
                  const columnWidth = columnRef?.offsetWidth ?? 300;
                  const actualWidth = columnWidth * (1 / plc.lanes) - 8;

                  const layout = {
                    top: 0,
                    height,
                    leftPct: 0,
                    widthPct: 100,
                  };

                  return (
                    <div style={{ width: `${actualWidth}px`, opacity: 0.8 }}>
                      <ItemHost
                        item={overlayItem}
                        layout={layout}
                        selected={true}
                        onMouseDownSelect={() => {}}
                        renderItem={renderItem}
                      />
                    </div>
                  );
                })()
              : null}
          </DragOverlay>
        </DndContext>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}) as <T extends TimeItem, R extends TimeItem = TimeItem>(
  props: CalendarGridProps<T, R> & { ref?: React.Ref<CalendarGridHandle> }
) => React.ReactElement;
