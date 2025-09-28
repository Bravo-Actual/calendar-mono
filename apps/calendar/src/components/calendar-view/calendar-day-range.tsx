"use client";

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, DragStartEvent, DragMoveEvent, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type {
  CalendarDayRangeHandle, CalendarDayRangeProps, EventId,
  SelectedTimeRange, DragState, Rubber
} from "./types";
import {
  DAY_MS, getTZ, toZDT, parseWeekStart,
  layoutDay, formatHourLabel, PositionedEvent
} from "../utils";
import { DayColumn } from "./day-column";
import { ActionBar } from "../action-bar";
import { AgendaView } from "./agenda-view";
import { RenameEventsDialog } from "./rename-events-dialog";
import { useTimeSuggestions } from "@/hooks/useTimeSuggestions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store/app";
import {
  createEventResolved,
  updateEventResolved,
  deleteEventResolved
} from '@/lib/data-v2';
import { useAuth } from '@/contexts/AuthContext';
import type { CalendarTimeRange } from "./types";
import type { EventResolved } from "@/lib/data-v2";
import {
  calculateDragProposal,
  calculatePointerDelta,
  type DragKind,
  type CalendarGeometry,
  type DragState as NewDragState
} from '@/lib/calendar-drag';
import { EventCardContent } from './event-card-content';

const CalendarDayRange = forwardRef<CalendarDayRangeHandle, CalendarDayRangeProps>(function CalendarDayRange(
  {
    initialRangeStartISO,
    days: _daysProp = 7,
    slotMinutes = 30,
    pxPerHour = 64,
    viewportHeight: _viewportHeight = 720,
    timeZone,
    timeFormat = '12_hour',
    events: controlledEvents,
    userCategories = [],
    userCalendars = [],
    aiHighlights = [],
    highlightedEventIds = [],
    weekStartsOn = 1,
    minDurationMinutes = 15,
    dragSnapMinutes = 5,
    selectedTimeRanges,
    systemHighlightSlots,
    columnDates,
    onEventDoubleClick,
  }: CalendarDayRangeProps,
  ref
) {
  const tz = getTZ(timeZone);

  // Data hooks
  const { user } = useAuth();

  // Use app store for date state management
  const {
    viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay,
    displayMode,
    // Calendar state management
    rangeStartMs, selectedDate, setDays, setRangeStart,
    // Calendar context functions
    updateCalendarContext
  } = useAppStore();

  // Track previous selectedDates to detect newly added days in non-consecutive mode
  const prevSelectedDatesRef = useRef<Date[]>([]);

  // Note: days prop sync removed since parent page manages day count through new state system

  // Sync calendar to selected date changes (for sidebar clicks and user navigation)
  // The key is ensuring data operations don't modify selectedDate
  useEffect(() => {
    const selectedRangeStart = parseWeekStart(selectedDate.toISOString(), tz, weekStartsOn);
    setRangeStart(selectedRangeStart);
  }, [selectedDate, tz, weekStartsOn, setRangeStart]);

  const rangeStartMsInitial = useMemo(
    () => parseWeekStart(initialRangeStartISO, tz, weekStartsOn),
    [initialRangeStartISO, tz, weekStartsOn]
  );

  // Initialize range start if needed
  useEffect(() => {
    if (rangeStartMs === 0 || !rangeStartMs) {
      setRangeStart(rangeStartMsInitial);
    }
  }, [rangeStartMs, rangeStartMsInitial, setRangeStart]);

  // Column model - Use new state management system
  const colStarts = useMemo(() => {
    const toStartOfDay = (v: Date | string | number) => {
      const d = typeof v === "number" ? new Date(v) : new Date(v);
      return toZDT(d.getTime(), tz)
        .with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        .epochMilliseconds;
    };

    // Allow override from props for external control
    if (Array.isArray(columnDates) && columnDates.length > 0) {
      return columnDates.map(toStartOfDay);
    }

    if (viewMode === 'non-consecutive' && selectedDates.length > 0) {
      // Non-consecutive mode: show only selected dates
      return selectedDates.map(date => {
        const dateObj = date instanceof Date ? date : new Date(date);
        return toStartOfDay(dateObj);
      });
    }

    // Consecutive mode: calculate dates based on type
    let dayCount = 1;
    let calculatedStartDate = startDate;

    switch (consecutiveType) {
      case 'day':
        dayCount = 1;
        break;
      case 'week':
        dayCount = 7;
        // Adjust to week start based on user preference
        const dayOfWeek = startDate.getDay();
        const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromWeekStart);
        break;
      case 'workweek':
        dayCount = 5;
        // Adjust to week start (Monday for work week)
        const currentDay = startDate.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday is 6 days from Monday
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromMonday);
        break;
      case 'custom-days':
        dayCount = customDayCount;
        break;
    }

    return Array.from({ length: dayCount }, (_, i) => {
      const dateMs = calculatedStartDate.getTime() + i * DAY_MS;
      return toStartOfDay(dateMs);
    });
  }, [columnDates, viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay, tz]);

  // Calculate which days are new by comparing current vs previous selectedDates
  const newlyAddedDays = useMemo(() => {
    if (viewMode !== 'non-consecutive') return new Set<number>();

    const prevDayKeys = new Set(prevSelectedDatesRef.current.map(date => Math.floor(date.getTime() / DAY_MS)));
    const currentDayKeys = new Set(selectedDates.map(date => Math.floor(date.getTime() / DAY_MS)));

    // Find days that are in current but NOT in previous (truly new days)
    const newDays = new Set<number>();
    currentDayKeys.forEach(dayKey => {
      if (!prevDayKeys.has(dayKey)) {
        newDays.add(dayKey);
      }
    });

    return newDays;
  }, [viewMode, selectedDates]);

  // Update ref after render
  useEffect(() => {
    prevSelectedDatesRef.current = [...selectedDates];
  }, [selectedDates]);


  const getDayStartMs = (i: number) => colStarts[i];

  // State declarations must come before usage
  const [optimisticEvents, setOptimisticEvents] = useState<EventResolved[] | null>(null);
  const [uncontrolledEvents, setUncontrolledEvents] = useState<EventResolved[]>(() => controlledEvents || []);
  useEffect(() => { if (controlledEvents) setUncontrolledEvents(controlledEvents); }, [controlledEvents]);
  const events = optimisticEvents ?? controlledEvents ?? uncontrolledEvents;

  const [uncontrolledRanges, setUncontrolledRanges] = useState<SelectedTimeRange[]>(() => []);
  useEffect(() => { if (selectedTimeRanges) setUncontrolledRanges(selectedTimeRanges); }, [selectedTimeRanges]);
  const timeRanges = selectedTimeRanges ?? uncontrolledRanges;

  const commitEvents = useCallback(async (next: EventResolved[]) => {
    if (!controlledEvents) setUncontrolledEvents(next);

    // Find events that have changed and update them in the database
    if (user?.id) {
      const currentEventsMap = new Map(events.map(e => [e.id, e]));

      for (const updatedEvent of next) {
        const currentEvent = currentEventsMap.get(updatedEvent.id);
        if (!currentEvent) continue;

        // Check if the event's time has changed
        const hasTimeChanged =
          updatedEvent.start_time_ms !== currentEvent.start_time_ms ||
          updatedEvent.end_time_ms !== currentEvent.end_time_ms;

        if (hasTimeChanged) {
          try {
            console.log('📅 [DEBUG] Calendar orchestrating event update via commitEvents:', {
              eventId: updatedEvent.id,
              startTime: new Date(updatedEvent.start_time_ms),
              endTime: new Date(updatedEvent.end_time_ms)
            });

            await updateEventResolved(user.id, updatedEvent.id, {
              start_time: new Date(updatedEvent.start_time_ms),
              end_time: new Date(updatedEvent.end_time_ms)
            });
          } catch (error) {
            console.error('Failed to update event after drag:', error);
          }
        }
      }
    }
  }, [controlledEvents, events, user?.id]);

  // NEW: dnd-kit state for clean drag handling (must be declared before callbacks)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 } // Must move 8px before drag starts
    })
  );
  const [dndDragState, setDndDragState] = useState<NewDragState | null>(null);
  const [previewTimes, setPreviewTimes] = useState<Record<string, { start: Date; end: Date }>>({});
  const [showDragGhost, setShowDragGhost] = useState(false);

  // NEW: dnd-kit drag handlers - SINGLE CALLBACK PATTERN
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { eventId: string; kind: DragKind } | undefined;
    if (!data) return;

    const originalEvent = events.find(e => e.id === data.eventId);
    if (!originalEvent) return;

    console.log('🎯 [dnd-kit] Drag started:', data.eventId, data.kind);

    setDndDragState({
      eventId: data.eventId,
      kind: data.kind,
      originalStartMs: originalEvent.start_time_ms,
      originalEndMs: originalEvent.end_time_ms,
      originalDuration: originalEvent.end_time_ms - originalEvent.start_time_ms
    });

    // Don't show ghost immediately - wait for movement
    setShowDragGhost(false);
  }, [events]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!dndDragState || !event.over) return;

    // Show ghost after movement starts (dnd-kit has already validated activation constraints)
    if (!showDragGhost) {
      setShowDragGhost(true);
    }

    const overData = event.over.data.current as { dayIdx: number; dayStartMs: number; geometry: CalendarGeometry } | undefined;
    if (!overData) return;

    try {
      // Get the day column element to calculate pointer position
      const dayColumnElement = document.querySelector(`[data-day-idx="${overData.dayIdx}"]`) as HTMLElement;
      if (!dayColumnElement) return;

      const rect = dayColumnElement.getBoundingClientRect();
      const pointerDelta = calculatePointerDelta(event, rect);

      const originalEvent = events.find(e => e.id === dndDragState.eventId);
      if (!originalEvent) return;

      const proposal = calculateDragProposal(
        originalEvent,
        dndDragState.kind,
        pointerDelta,
        overData.geometry
      );

      // Update preview times for visual feedback
      setPreviewTimes({
        [dndDragState.eventId]: {
          start: proposal.newStartTime,
          end: proposal.newEndTime
        }
      });

    } catch (error) {
      console.warn('Drag move calculation failed:', error);
    }
  }, [dndDragState, events]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (!dndDragState || !event.over) {
      console.log('🚫 [dnd-kit] Drag ended without valid drop zone');
      setDndDragState(null);
      setPreviewTimes({});
      setShowDragGhost(false);
      return;
    }

    const overData = event.over.data.current as { dayIdx: number; dayStartMs: number; geometry: CalendarGeometry } | undefined;
    if (!overData || !user?.id) {
      setDndDragState(null);
      setPreviewTimes({});
      setShowDragGhost(false);
      return;
    }

    try {
      // SINGLE DATABASE UPDATE - This solves the duplicate outbox issue!
      console.log('🎯 [dnd-kit] Drag ended - calculating final position');

      const dayColumnElement = document.querySelector(`[data-day-idx="${overData.dayIdx}"]`) as HTMLElement;
      if (!dayColumnElement) throw new Error('Day column element not found');

      const rect = dayColumnElement.getBoundingClientRect();
      const pointerDelta = calculatePointerDelta(event, rect);

      const originalEvent = events.find(e => e.id === dndDragState.eventId);
      if (!originalEvent) throw new Error('Original event not found');

      const proposal = calculateDragProposal(
        originalEvent,
        dndDragState.kind,
        pointerDelta,
        overData.geometry
      );

      console.log('🔄 [dnd-kit] Single drag end update:', {
        eventId: proposal.eventId,
        from: { start: originalEvent.start_time_ms, end: originalEvent.end_time_ms },
        to: { start: proposal.newStartTime.getTime(), end: proposal.newEndTime.getTime() }
      });

      // Optimistic update: immediately update the UI
      const currentEvents = controlledEvents ?? uncontrolledEvents;
      const optimisticEventsList = currentEvents.map(event =>
        event.id === proposal.eventId
          ? {
              ...event,
              start_time_ms: proposal.newStartTime.getTime(),
              end_time_ms: proposal.newEndTime.getTime()
            }
          : event
      );
      setOptimisticEvents(optimisticEventsList);

      // SINGLE call to updateEventResolved - no duplicates!
      await updateEventResolved(user.id, proposal.eventId, {
        start_time: proposal.newStartTime,
        end_time: proposal.newEndTime
      });

      // Clear optimistic state after successful update
      setOptimisticEvents(null);

    } catch (error) {
      console.error('❌ [dnd-kit] Drag update failed:', error);
      // Revert optimistic update on error
      setOptimisticEvents(null);
    } finally {
      setDndDragState(null);
      setPreviewTimes({});
      setShowDragGhost(false);
    }
  }, [dndDragState, events, user?.id]);

  // Helper functions for calendar context updates
  const updateViewContext = useCallback(() => {
    if (colStarts.length === 0) return;

    const startMs = Math.min(...colStarts);
    const endMs = Math.max(...colStarts) + DAY_MS - 1; // End of last day

    const viewDates = colStarts.map(ms => new Date(ms).toISOString().split('T')[0]);

    let currentView: 'week' | 'day' | 'month' = 'week';
    if (colStarts.length === 1) currentView = 'day';
    else if (colStarts.length <= 7) currentView = 'week';
    else currentView = 'month';

    const now = new Date();
    const nowZdt = toZDT(now.getTime(), tz);

    updateCalendarContext({
      viewRange: {
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        description: "This is the date range currently visible on the calendar"
      },
      viewDates: {
        dates: viewDates,
        description: "These are all the individual dates currently visible on the calendar"
      },
      currentView,
      currentDate: new Date(colStarts[0]).toISOString().split('T')[0],
      timezone: tz,
      currentDateTime: {
        utc: now.toISOString(),
        local: nowZdt.toString(),
        timestamp: now.getTime(),
        description: `Current time: ${nowZdt.toLocaleString()} (${tz})`
      }
    });
  }, [colStarts, updateCalendarContext, tz]);

  const updateSelectedEventsContext = useCallback((eventIds: EventId[]) => {
    if (!events || events.length === 0) return;
    const selectedEvents = events.filter(event => eventIds.includes(event.id));
    updateCalendarContext({
      selectedEvents: {
        events: selectedEvents,
        summary: `${selectedEvents.length} selected events`,
        description: "These are events on the calendar that the user has selected"
      }
    });
  }, [events, updateCalendarContext]);

  const updateSelectedTimeRangesContext = useCallback((ranges: SelectedTimeRange[]) => {
    const calendarTimeRanges: CalendarTimeRange[] = ranges.map((range, index) => ({
      start: new Date(range.startAbs).toISOString(),
      end: new Date(range.endAbs).toISOString(),
      description: `This is user selected time range ${index + 1}`
    }));

    updateCalendarContext({
      selectedTimeRanges: {
        ranges: calendarTimeRanges,
        summary: `${calendarTimeRanges.length} selected time ranges`,
        description: "These are time slots that the user has manually selected on the calendar"
      }
    });
  }, [updateCalendarContext]);

  // Update calendar context when view changes
  useEffect(() => {
    updateViewContext();
  }, [updateViewContext]);

  const commitRanges = useCallback((next: SelectedTimeRange[]) => {
    if (!selectedTimeRanges) setUncontrolledRanges(next);
    updateSelectedTimeRangesContext(next);
  }, [selectedTimeRanges, updateSelectedTimeRangesContext]);

  const [selectedEventIds, setSelectedEventIds] = useState<Set<EventId>>(new Set());
  function updateSelection(next: Set<EventId>) {
    setSelectedEventIds(new Set(next));
    updateSelectedEventsContext(Array.from(next));
  }

  // Clear selections when navigation occurs
  useEffect(() => {
    // Clear selected events
    if (selectedEventIds.size > 0) {
      setSelectedEventIds(new Set());
    }
    // Clear time ranges
    if (timeRanges.length > 0) {
      commitRanges([]);
    }
  }, [rangeStartMs, startDate, selectedDate]); // Clear when navigation occurs (any date change)

  const [rubber, setRubber] = useState<Rubber>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const snapStep = slotMinutes * 60_000;
  const dragSnapMs = Math.max(1, dragSnapMinutes) * 60_000;

  const fullHeight = 24 * pxPerHour;
  const pxPerMs = pxPerHour / 3_600_000;

  const positioned = useMemo(() => {
    const arr: PositionedEvent[] = [];

    for (let dayIdx = 0; dayIdx < colStarts.length; dayIdx++) {
      const dayStart00 = colStarts[dayIdx];
      const dayEnd24 = dayStart00 + DAY_MS;
      const laid = layoutDay(events, dayStart00, dayEnd24, pxPerMs, 0.5)
        .map(p => ({ ...p, dayIdx })); // dayIdx only for UI positioning
      arr.push(...laid);
    }

    return arr;
  }, [events, colStarts, pxPerMs]);

  const [drag, setDrag] = useState<DragState | null>(null);

  // Calculate the duration of the event being dragged for time suggestions
  const dragEventDurationMinutes = drag ? Math.round((drag.origEnd - drag.origStart) / (1000 * 60)) : 60;

  const systemSlots = useTimeSuggestions(!!drag, {
    dates: viewMode === 'non-consecutive'
      ? colStarts.map(ms => new Date(ms))  // Array of specific dates
      : { startDate: new Date(colStarts[0]), endDate: new Date(colStarts[colStarts.length - 1]) }, // Date range
    timeZone,
    durationMinutes: dragEventDurationMinutes, // Use event's actual duration for suggestions
    existingEvents: controlledEvents || [],
    currentDragEventId: drag?.id,
    currentDragEventOriginalTime: drag ? { start: drag.origStart, end: drag.origEnd } : undefined
  });

  function yToLocalMs(y: number, step = snapStep) {
    const clamped = Math.max(0, Math.min(fullHeight, y));
    const dayMs = clamped / pxPerMs;
    return Math.round(dayMs / step) * step;
  }
  function localMsToY(msInDay: number) {
    return Math.max(0, Math.min(fullHeight, msInDay * pxPerMs));
  }

  useImperativeHandle(ref, () => ({
    goTo: (date) => {
      const d = typeof date === "number" ? new Date(date) : new Date(date);
      const iso = d.toISOString();
      setRangeStart(parseWeekStart(iso, tz, weekStartsOn));
    },
    nextRange: () => {
      setRangeStart(rangeStartMs + (colStarts.length * DAY_MS));
    },
    prevRange: () => {
      setRangeStart(rangeStartMs - (colStarts.length * DAY_MS));
    },
    setDays: (d: number) => setDays(d as 5 | 7),
    getVisibleRange: () => {
      const firstDay = colStarts[0] || 0;
      const lastDay = colStarts[colStarts.length - 1] || 0;
      return { startMs: firstDay, endMs: lastDay + DAY_MS };
    },
    getSelectedTimeRanges: () => timeRanges,
    setSelectedTimeRanges: (ranges) => commitRanges(ranges),
    clearTimeSelection: () => commitRanges([]),
    clearAllSelections: () => {
      // Clear selected events
      if (selectedEventIds.size > 0) {
        setSelectedEventIds(new Set());
        // onSelectChange?.([]);
      }
      // Clear time ranges
      if (timeRanges.length > 0) {
        commitRanges([]);
      }
    },
    selectEvents: (eventIds: EventId[]) => {
      const newSelection = new Set(eventIds);
      setSelectedEventIds(newSelection);
      // onSelectChange?.(eventIds);
    },
  }), [tz, weekStartsOn, colStarts, rangeStartMs, timeRanges, setRangeStart, selectedEventIds, commitRanges, setDays]);

  // ---- SCROLL SYNC: gutter <-> ScrollArea viewport ----
  const viewportRef = useRef<HTMLDivElement | null>(null);  // actual viewport element
  const gutterInnerRef = useRef<HTMLDivElement>(null);      // translates with scrollTop
  const currentSyncFunctionRef = useRef<((e: Event) => void) | null>(null);

  // Store previous scroll position
  const savedScrollTopRef = useRef<number>(8 * pxPerHour);

  // Callback ref for ScrollArea - called when element is mounted/unmounted
  const scrollRootRef = useCallback((scrollAreaElement: HTMLDivElement | null) => {
    // Clean up previous sync if exists
    if (currentSyncFunctionRef.current && viewportRef.current) {
      // Save current scroll position before cleanup
      savedScrollTopRef.current = viewportRef.current.scrollTop;
      viewportRef.current.removeEventListener("scroll", currentSyncFunctionRef.current);
      currentSyncFunctionRef.current = null;
    }
    viewportRef.current = null;

    // Only initialize if we're in grid mode and have an element
    if (!scrollAreaElement || displayMode !== 'grid') {
      return;
    }


    const findViewport = () => {
      // Try multiple selectors to find the viewport
      const selectors = [
        '[data-radix-scroll-area-viewport]',
        '.radix-scroll-area-viewport',
        '[data-scroll-area-viewport]'
      ];

      for (const selector of selectors) {
        const vp = scrollAreaElement.querySelector(selector) as HTMLDivElement | null;
        if (vp) {
          return vp;
        }
      }

      // Fallback: look for a scrollable div within the scroll area
      const scrollableDiv = scrollAreaElement.querySelector('div[style*="overflow"]') as HTMLDivElement | null;
      if (scrollableDiv) {
        return scrollableDiv;
      }

      return null;
    };

    const initializeScrollSync = () => {
      const vp = findViewport();
      if (!vp) {
          return false;
      }

      viewportRef.current = vp;

      const sync = () => {
        if (gutterInnerRef.current && viewportRef.current) {
          const scrollTop = viewportRef.current.scrollTop;
          gutterInnerRef.current.style.transform = `translateY(-${scrollTop}px)`;
        }
      };

      currentSyncFunctionRef.current = sync;

      // Restore previous scroll position or use 08:00 default
      vp.scrollTop = savedScrollTopRef.current;

      // Add scroll listener
      vp.addEventListener("scroll", sync, { passive: true });

      // Initial sync
      requestAnimationFrame(sync);

      return true;
    };

    // Try immediate initialization
    if (!initializeScrollSync()) {
      // If immediate fails, try with short delay
      setTimeout(() => {
        if (!initializeScrollSync()) {
          // Try one more time with longer delay
          setTimeout(() => {
            initializeScrollSync();
          }, 100);
        }
      }, 50);
    }
  }, [displayMode, pxPerHour]);

  // Let wheel on gutter scroll the viewport too
  const onGutterWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!viewportRef.current || displayMode !== 'grid') return;
    viewportRef.current.scrollTop += e.deltaY;
  };

  useEffect(() => {
    const isInputElementFocused = () => {
      const activeElement = document.activeElement;
      if (!activeElement) return false;

      const tagName = activeElement.tagName.toLowerCase();
      const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';
      const isInputField = ['input', 'textarea', 'select'].includes(tagName);

      return isInputField || isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't execute global commands when input fields are focused
      if (isInputElementFocused()) {
        return;
      }

      if (e.key === "Escape") {
        setRubber(null); setDrag(null);
        if (selectedEventIds.size) { setSelectedEventIds(new Set()); }
        if ((timeRanges?.length ?? 0) > 0) { commitRanges([]); }
      }
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Select all events in the current view
        const allEventIds = new Set(events.map(event => event.id));
        setSelectedEventIds(allEventIds);
        // onSelectChange?.(Array.from(allEventIds));
      }
      // Only Delete key should delete events, not Backspace
      if (e.key === "Delete" && selectedEventIds.size > 0) {
        e.preventDefault();
        // Delete events using V2 data layer - each event is deleted individually
        selectedEventIds.forEach(async eventId => {
          if (user?.id) {
            try {
              await deleteEventResolved(user.id, eventId);
            } catch (error) {
              console.error('Failed to delete event:', error);
            }
          }
        });
        setSelectedEventIds(new Set());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEventIds, timeRanges, events, commitEvents, commitRanges]);

  const hasRanges = timeRanges.length > 0;
  const hasSelectedEvents = selectedEventIds.size > 0;

  // Get current state of selected events for ActionBar checkbox states
  const selectedEvents = events.filter(event => selectedEventIds.has(event.id));
  const selectedIsOnlineMeeting = selectedEvents.length > 0 ? selectedEvents.every(e => e.online_event) : false;
  const selectedIsInPerson = selectedEvents.length > 0 ? selectedEvents.every(e => e.in_person) : false;

  const handleCreateEvents = async () => {
    if (!hasRanges || !user?.id) return;

    console.log(`🎯 [DEBUG] handleCreateEvents triggered with ${timeRanges.length} ranges`);

    try {
      // Create events using V2 data layer - one for each time range
      for (const range of timeRanges) {
        await createEventResolved(user.id, {
          title: "New Event",
          start_time: new Date(range.startAbs),
          end_time: new Date(range.endAbs),
          all_day: false,
        });
      }

      // Clear the selection after creating events
      commitRanges([]);
    } catch (error) {
      console.error(`❌ [ERROR] Failed to create events:`, error);
    }
  };

  const handleRenameSelected = () => {
    if (!hasSelectedEvents) return;
    setShowRenameDialog(true);
  };

  const handleRename = (newTitle: string) => {
    if (!hasSelectedEvents) return;
    // Use V2 data layer to update each selected event
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await updateEventResolved(user.id, eventId, {
            title: newTitle
          });
        } catch (error) {
          console.error('Failed to update event title:', error);
        }
      }
    });
  };

  const handleDeleteSelected = () => {
    if (!hasSelectedEvents) return;
    // Use V2 data layer to delete each selected event
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await deleteEventResolved(user.id, eventId);
        } catch (error) {
          console.error('Failed to delete event:', error);
        }
      }
    });
    setSelectedEventIds(new Set());
  };

  const handleUpdateShowTimeAs = (showTimeAs: import("./types").ShowTimeAs) => {
    if (!hasSelectedEvents) return;
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await updateEventResolved(user.id, eventId, {
            show_time_as: showTimeAs
          });
        } catch (error) {
          console.error('Failed to update show time as:', error);
        }
      }
    });
  };

  const handleUpdateCategory = (categoryId: string) => {
    if (!hasSelectedEvents) return;
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await updateEventResolved(user.id, eventId, {
            category_id: categoryId
          });
        } catch (error) {
          console.error('Failed to update category:', error);
        }
      }
    });
  };

  const handleUpdateCalendar = (calendarId: string) => {
    if (!hasSelectedEvents) return;
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await updateEventResolved(user.id, eventId, {
            calendar_id: calendarId
          });
        } catch (error) {
          console.error('Failed to update calendar:', error);
        }
      }
    });
  };

  const handleUpdateIsOnlineMeeting = (isOnlineMeeting: boolean) => {
    if (!hasSelectedEvents) return;
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await updateEventResolved(user.id, eventId, {
            online_event: isOnlineMeeting
          });
        } catch (error) {
          console.error('Failed to update online meeting setting:', error);
        }
      }
    });
  };

  const handleUpdateIsInPerson = (isInPerson: boolean) => {
    if (!hasSelectedEvents) return;
    selectedEventIds.forEach(async eventId => {
      if (user?.id) {
        try {
          await updateEventResolved(user.id, eventId, {
            in_person: isInPerson
          });
        } catch (error) {
          console.error('Failed to update in-person setting:', error);
        }
      }
    });
  };

  const handleClearAllSelections = () => {
    // Clear selected events
    if (selectedEventIds.size > 0) {
      setSelectedEventIds(new Set());
    }
    // Clear time ranges
    if (timeRanges.length > 0) {
      commitRanges([]);
    }
  };

  const handleDayHeaderClick = (dayIndex: number) => {
    if (expandedDay === dayIndex) {
      // Clicking the already expanded day collapses it
      setExpandedDay(null);
    } else {
      // Clicking a different day expands it
      setExpandedDay(dayIndex);
    }
  };


  const displayDays = colStarts.length;
  const displayDates = useMemo(() => {
    return colStarts.map(dayStartMs => new Date(dayStartMs));
  }, [colStarts]);

  // Dynamic grid template based on display mode and expanded state
  const headerGridTemplate = displayMode === 'agenda'
    ? `repeat(${displayDays}, 1fr)` // No gutter in agenda mode
    : expandedDay !== null
      ? `72px repeat(${displayDays}, 1fr)` // Keep all headers visible for navigation
      : `72px repeat(${displayDays}, 1fr)`; // Normal view

  const bodyGridTemplate = expandedDay !== null
    ? `72px 1fr` // Show only time gutter + expanded day content
    : `72px 1fr`; // Normal view (scrollable area)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        id="calendar-week"
        className="relative w-full select-none text-sm flex flex-col h-full"
      >
      {/* Header */}
      <div id="calendar-header" className="grid pr-2.5 py-1" style={{ gridTemplateColumns: headerGridTemplate }}>
        {displayMode === 'grid' && <div />}
        {displayDates.map((date, i) => {
          const dateObj = date instanceof Date ? date : new Date(date);
          const timeMs = dateObj.getTime();

          if (isNaN(timeMs)) {
            return <div key={i} className="px-3 py-2 font-medium">Invalid Date</div>;
          }

          const zdt = toZDT(Math.floor(timeMs), tz);
          const dayNumber = zdt.day;
          const weekday = zdt.toLocaleString(undefined, { weekday: "short" });
          const isExpanded = expandedDay === i;

          return (
            <motion.div
              key={i}
              className={`px-3 py-2 text-left cursor-pointer transition-colors rounded-md ${
                isExpanded
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              onClick={() => handleDayHeaderClick(i)}
              layout
            >
              <div className="text-lg font-semibold leading-tight">{dayNumber}</div>
              <div className={`text-sm ${isExpanded ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {weekday}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Body: Dynamic content based on display mode */}
      <AnimatePresence mode="wait">
        {displayMode === 'grid' ? (
          <motion.div
            key="grid-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            id="calendar-body"
            className="grid border-t border-border flex-1 overflow-hidden"
            style={{ gridTemplateColumns: bodyGridTemplate }}
          >
            {/* Gutter (visually scrolls, no scrollbar) */}
            <div id="time-gutter" className="relative overflow-hidden border-r border-border" onWheel={onGutterWheel}>
              <div
                ref={gutterInnerRef}
                className="relative"
                style={{ height: fullHeight, willChange: "transform" }}
              >
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute right-2 text-xs text-muted-foreground translate-y-1"
                    style={{ top: i * pxPerHour }}
                  >
                    {formatHourLabel(i % 24, timeFormat)}
                  </div>
                ))}
              </div>
            </div>

            {/* Scrollable days viewport (owns the scrollbar) */}
            <ScrollArea id="calendar-scroll-area" ref={scrollRootRef} className="relative flex-1 min-h-0">
              <div className="flex pr-2.5" style={{ height: fullHeight }}>
                {colStarts.map((dayStartMs, dayIdx) => {
                  // Calculate if this day should animate entry
                  const dayKey = Math.floor(dayStartMs / DAY_MS);
                  const shouldAnimateEntry = viewMode === 'consecutive' || newlyAddedDays.has(dayKey);

                  return (
                    <motion.div
                      key={dayKey}
                      className="relative border-r border-border last:border-r-0 overflow-hidden"
                      initial={false}
                      animate={{
                        flex: expandedDay === null
                          ? 1
                          : expandedDay === dayIdx
                            ? displayDays
                            : 0
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                        mass: 0.8
                      }}
                    >
                      <div className="w-full h-full">
                        <DayColumn
                        key={dayIdx}
                        dayIdx={dayIdx}
                        days={colStarts.length}
                        tz={tz}
                        timeFormat={timeFormat}
                        dayStartMs={dayStartMs}
                        getDayStartMs={getDayStartMs}
                        gridHeight={fullHeight}
                        pxPerHour={pxPerHour}
                        pxPerMs={pxPerMs}
                        events={events}
                        positioned={positioned.filter(p => p.dayIdx === dayIdx)}
                        highlightedEventIds={new Set(highlightedEventIds)}
                        selectedEventIds={selectedEventIds}
                        setSelectedEventIds={updateSelection}
                        drag={drag}
                        setDrag={setDrag}
                        onCommit={(updated) => commitEvents(updated)}
                        rubber={dndDragState ? null : rubber}
                        setRubber={dndDragState ? () => {} : setRubber}
                        yToLocalMs={yToLocalMs}
                        localMsToY={localMsToY}
                        snapStep={snapStep}
                        dragSnapMs={dragSnapMs}
                        minDurMs={Math.max(minDurationMinutes, slotMinutes) * 60_000}
                        timeRanges={timeRanges}
                        commitRanges={commitRanges}
                        aiHighlights={aiHighlights}
                        systemSlots={
                          (systemHighlightSlots ?? [])
                            .filter(s => s.endAbs > dayStartMs && s.startAbs < dayStartMs + DAY_MS)
                            .concat(systemSlots.filter(s => s.endAbs > dayStartMs && s.startAbs < dayStartMs + DAY_MS))
                        }
                        onClearAllSelections={handleClearAllSelections}
                        shouldAnimateEntry={shouldAnimateEntry}
                        onEventDoubleClick={onEventDoubleClick}
                        // Context menu props
                        selectedIsOnlineMeeting={selectedIsOnlineMeeting}
                        selectedIsInPerson={selectedIsInPerson}
                        userCategories={userCategories}
                        onUpdateShowTimeAs={handleUpdateShowTimeAs}
                        onUpdateCategory={handleUpdateCategory}
                        onUpdateIsOnlineMeeting={handleUpdateIsOnlineMeeting}
                        onUpdateIsInPerson={handleUpdateIsInPerson}
                        onDeleteSelected={handleDeleteSelected}
                        onRenameSelected={handleRenameSelected}
                        onCreateEvents={handleCreateEvents}
                        previewTimes={previewTimes}
                        dndDragState={dndDragState}
                      />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <ScrollBar orientation="vertical" className="z-30" />
            </ScrollArea>
          </motion.div>
        ) : (
          <motion.div
            key="agenda-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="border-t border-border flex-1 overflow-hidden h-full"
          >
            <AgendaView
              events={events}
              tz={tz}
              colStarts={colStarts}
              onEventSelect={(id, multi) => {
                const next = new Set(selectedEventIds);
                if (multi) {
                  next.has(id) ? next.delete(id) : next.add(id);
                } else {
                  next.clear();
                  next.add(id);
                }
                updateSelection(next);
              }}
              selectedEventIds={selectedEventIds}
              expandedDay={expandedDay}
              displayDays={displayDays}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ActionBar
        timeRanges={timeRanges}
        onCreateEvents={handleCreateEvents}
        onClearSelection={handleClearAllSelections}
        selectedEventCount={selectedEventIds.size}
        onDeleteSelected={handleDeleteSelected}
        onUpdateShowTimeAs={handleUpdateShowTimeAs}
        onUpdateCalendar={handleUpdateCalendar}
        onUpdateCategory={handleUpdateCategory}
        onUpdateIsOnlineMeeting={handleUpdateIsOnlineMeeting}
        onUpdateIsInPerson={handleUpdateIsInPerson}
        selectedIsOnlineMeeting={selectedIsOnlineMeeting}
        selectedIsInPerson={selectedIsInPerson}
        userCalendars={userCalendars}
        userCategories={userCategories}
      />

      <RenameEventsDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        selectedCount={selectedEventIds.size}
        currentTitle={(() => {
          // Get the title of the first selected event as default
          const firstSelectedId = Array.from(selectedEventIds)[0];
          return firstSelectedId ? events.find(e => e.id === firstSelectedId)?.title || "" : "";
        })()}
        onRename={handleRename}
      />

      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {dndDragState && showDragGhost && (() => {
          const draggedEvent = events.find(e => e.id === dndDragState.eventId);
          if (!draggedEvent) return null;

          // Get the actual size from the original event element
          const originalElement = document.querySelector(`[data-event-id="${dndDragState.eventId}"]`);
          const rect = originalElement?.getBoundingClientRect();

          return (
            <div
              className="opacity-100 pointer-events-none shadow-lg"
              style={{
                width: rect?.width ? `${rect.width}px` : '200px',
                height: rect?.height ? `${rect.height}px` : '60px',
              }}
            >
              <EventCardContent
                event={draggedEvent}
                selected={false}
                highlighted={false}
                isDragging={false}
                tz={tz}
                timeFormat={timeFormat}
                onSelect={() => {}}
                selectedEventCount={0}
                onUpdateShowTimeAs={() => {}}
                onUpdateCategory={() => {}}
                onUpdateIsOnlineMeeting={() => {}}
                onUpdateIsInPerson={() => {}}
                onDeleteSelected={() => {}}
                onRenameSelected={() => {}}
                previewTimes={previewTimes[dndDragState.eventId]}
              />
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
});

export default CalendarDayRange;