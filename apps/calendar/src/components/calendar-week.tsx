"use client";

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  CalendarWeekHandle, CalendarWeekProps, CalEvent, EventId,
  SelectedTimeRange, DragState, Rubber
} from "./types";
import {
  DAY_MS, getTZ, toZDT, parseWeekStart,
  layoutDay, formatHourLabel, createEventsFromRanges,
  deleteEventsByIds, PositionedEvent
} from "./utils";
import { DayColumn } from "./day-column";
import { ActionBar } from "./action-bar";
import { CommandPalette } from "./command-palette";
import { AgendaView } from "./agenda-view";
import { useTimeSuggestions } from "../hooks/useTimeSuggestions";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { useAppStore } from "../store/app";

const CalendarWeek = forwardRef<CalendarWeekHandle, CalendarWeekProps>(function CalendarWeek(
  {
    initialWeekStartISO,
    days: daysProp = 7,
    slotMinutes = 30,
    pxPerHour = 64,
    viewportHeight: _viewportHeight = 720,
    timeZone,
    events: controlledEvents,
    onEventsChange,
    onSelectChange,
    onCreateEvents,
    onDeleteEvents,
    onUpdateEvents,
    userCategories = [],
    aiHighlights = [],
    highlightedEventIds = [],
    weekStartsOn = 1,
    minDurationMinutes = 15,
    dragSnapMinutes = 5,
    selectedTimeRanges,
    onTimeSelectionChange,
    systemHighlightSlots,
    columnDates,
  }: CalendarWeekProps,
  ref
) {
  const tz = getTZ(timeZone);

  // Use app store for date state management
  const {
    viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay,
    displayMode,
    // Legacy fields during transition
    days, weekStartMs, selectedDate, isMultiSelectMode, setDays, setWeekStart
  } = useAppStore();

  // Track previous selectedDates to detect newly added days in non-consecutive mode
  const prevSelectedDatesRef = useRef<Date[]>([]);

  // Note: days prop sync removed since parent page manages day count through new state system

  // Sync calendar to selected date changes (for sidebar clicks and user navigation)
  // The key is ensuring data operations don't modify selectedDate
  useEffect(() => {
    const selectedWeekStart = parseWeekStart(selectedDate.toISOString(), tz, weekStartsOn);
    setWeekStart(selectedWeekStart);
  }, [selectedDate, tz, weekStartsOn, setWeekStart]);

  const weekStartMsInitial = useMemo(
    () => parseWeekStart(initialWeekStartISO, tz, weekStartsOn),
    [initialWeekStartISO, tz, weekStartsOn]
  );

  // Initialize week start if needed
  useEffect(() => {
    if (weekStartMs === 0 || !weekStartMs) {
      setWeekStart(weekStartMsInitial);
    }
  }, [weekStartMs, weekStartMsInitial, setWeekStart]);

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

  const [uncontrolledEvents, setUncontrolledEvents] = useState<CalEvent[]>(() => controlledEvents || []);
  useEffect(() => { if (controlledEvents) setUncontrolledEvents(controlledEvents); }, [controlledEvents]);
  const events = controlledEvents ?? uncontrolledEvents;

  const [uncontrolledRanges, setUncontrolledRanges] = useState<SelectedTimeRange[]>(() => []);
  useEffect(() => { if (selectedTimeRanges) setUncontrolledRanges(selectedTimeRanges); }, [selectedTimeRanges]);
  const timeRanges = selectedTimeRanges ?? uncontrolledRanges;
  const commitRanges = useCallback((next: SelectedTimeRange[]) => {
    onTimeSelectionChange?.(next);
    if (!selectedTimeRanges) setUncontrolledRanges(next);
  }, [onTimeSelectionChange, selectedTimeRanges]);

  const commitEvents = useCallback((next: CalEvent[]) => {
    onEventsChange?.(next);
    if (!controlledEvents) setUncontrolledEvents(next);
  }, [onEventsChange, controlledEvents]);

  const [selectedEventIds, setSelectedEventIds] = useState<Set<EventId>>(new Set());
  function updateSelection(next: Set<EventId>) {
    setSelectedEventIds(new Set(next));
    onSelectChange?.(Array.from(next));
  }

  // Clear selections when navigation occurs
  useEffect(() => {
    // Clear selected events
    if (selectedEventIds.size > 0) {
      setSelectedEventIds(new Set());
      onSelectChange?.([]);
    }
    // Clear time ranges
    if (timeRanges.length > 0) {
      commitRanges([]);
    }
  }, [weekStartMs, startDate, selectedDate]); // Clear when navigation occurs (any date change)

  const [rubber, setRubber] = useState<Rubber>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
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
    existingEvents: controlledEvents?.map(event => ({
      id: event.id,
      start: event.start,
      end: event.end
    })) || [],
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
      // Use legacy setter for now, will be removed after transition
      const iso = d.toISOString();
      setWeekStart(parseWeekStart(iso, tz, weekStartsOn));
    },
    nextWeek: () => {
      // Use legacy logic for now, will be replaced by app store navigation
      setWeekStart(weekStartMs + (colStarts.length * DAY_MS));
    },
    prevWeek: () => {
      // Use legacy logic for now, will be replaced by app store navigation
      setWeekStart(weekStartMs - (colStarts.length * DAY_MS));
    },
    setDays: () => { /* Legacy function, day management now handled by parent */ },
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
        onSelectChange?.([]);
      }
      // Clear time ranges
      if (timeRanges.length > 0) {
        commitRanges([]);
      }
    },
  }), [tz, weekStartsOn, colStarts, weekStartMs, timeRanges, setWeekStart, selectedEventIds, onSelectChange, commitRanges]);

  // ---- SCROLL SYNC: gutter <-> ScrollArea viewport ----
  const scrollRootRef = useRef<HTMLDivElement>(null);       // ref to <ScrollArea>
  const viewportRef = useRef<HTMLDivElement | null>(null);  // actual viewport element
  const gutterInnerRef = useRef<HTMLDivElement>(null);      // translates with scrollTop

  // Find viewport, set initial scroll to 08:00, and wire sync
  useEffect(() => {
    const vp = scrollRootRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    viewportRef.current = vp || null;

    const sync = () => {
      if (gutterInnerRef.current && viewportRef.current) {
        const t = -viewportRef.current.scrollTop;
        gutterInnerRef.current.style.transform = `translateY(${t}px)`;
      }
    };

    if (viewportRef.current) {
      viewportRef.current.scrollTop = 8 * pxPerHour; // initial position 08:00
      viewportRef.current.addEventListener("scroll", sync, { passive: true });
    }
    // do an initial sync tick
    sync();

    return () => {
      if (viewportRef.current) {
        viewportRef.current.removeEventListener("scroll", sync);
      }
    };
  }, [pxPerHour]);

  // Let wheel on gutter scroll the viewport too
  const onGutterWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop += e.deltaY;
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRubber(null); setDrag(null);
        if (selectedEventIds.size) { setSelectedEventIds(new Set()); onSelectChange?.([]); }
        if ((timeRanges?.length ?? 0) > 0) { commitRanges([]); }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEventIds.size > 0) {
        e.preventDefault();
        if (onDeleteEvents) {
          // Call the parent's delete handler with the selected event IDs
          onDeleteEvents(Array.from(selectedEventIds));
        } else {
          // Fallback to local deletion if no parent handler provided
          const remaining = deleteEventsByIds(events, selectedEventIds);
          commitEvents(remaining);
        }
        setSelectedEventIds(new Set());
        onSelectChange?.([]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEventIds.size, timeRanges?.length, onSelectChange, events, commitEvents, commitRanges, onDeleteEvents, selectedEventIds]);

  const hasRanges = timeRanges.length > 0;
  const hasSelectedEvents = selectedEventIds.size > 0;

  // Get current state of selected events for ActionBar checkbox states
  const selectedEvents = events.filter(event => selectedEventIds.has(event.id));
  const selectedIsOnlineMeeting = selectedEvents.length > 0 ? selectedEvents.every(e => e.online_event) : false;
  const selectedIsInPerson = selectedEvents.length > 0 ? selectedEvents.every(e => e.in_person) : false;

  const handleCreateEvents = () => {
    if (!hasRanges) return;

    if (onCreateEvents) {
      // Use parent component's create function if provided
      onCreateEvents(timeRanges);
    } else {
      // Fallback to local mock implementation
      const created = createEventsFromRanges(timeRanges, "New event");
      commitEvents([...events, ...created]);
    }

    // Clear the selection after creating events
    commitRanges([]);
  };
  const handleDeleteSelected = () => {
    if (!hasSelectedEvents) return;
    if (onDeleteEvents) {
      // Call the parent's delete handler with the selected event IDs
      onDeleteEvents(Array.from(selectedEventIds));
    } else {
      // Fallback to local deletion if no parent handler provided
      const remaining = deleteEventsByIds(events, selectedEventIds);
      commitEvents(remaining);
    }
    setSelectedEventIds(new Set());
    onSelectChange?.([]);
  };

  const handleUpdateShowTimeAs = (showTimeAs: import("./types").ShowTimeAs) => {
    if (!hasSelectedEvents) return;
    if (onUpdateEvents) {
      // Call the parent's update handler with the selected event IDs and updates
      onUpdateEvents(Array.from(selectedEventIds), { show_time_as: showTimeAs });
    } else {
      // Fallback to local updates if no parent handler provided
      const updated = events.map(event =>
        selectedEventIds.has(event.id)
          ? { ...event, show_time_as: showTimeAs }
          : event
      );
      commitEvents(updated);
    }
  };

  const handleUpdateCategory = (categoryId: string) => {
    if (!hasSelectedEvents) return;
    if (onUpdateEvents) {
      // Call the parent's update handler with the selected event IDs and updates
      onUpdateEvents(Array.from(selectedEventIds), { user_category_id: categoryId });
    } else {
      // Fallback to local updates if no parent handler provided
      const updated = events.map(event =>
        selectedEventIds.has(event.id)
          ? { ...event, user_category_id: categoryId }
          : event
      );
      commitEvents(updated);
    }
  };

  const handleUpdateIsOnlineMeeting = (isOnlineMeeting: boolean) => {
    if (!hasSelectedEvents) return;
    if (onUpdateEvents) {
      // Call the parent's update handler with the selected event IDs and updates
      onUpdateEvents(Array.from(selectedEventIds), { online_event: isOnlineMeeting });
    } else {
      // Fallback to local updates if no parent handler provided
      const updated = events.map(event =>
        selectedEventIds.has(event.id)
          ? { ...event, online_event: isOnlineMeeting }
          : event
      );
      commitEvents(updated);
    }
  };

  const handleUpdateIsInPerson = (isInPerson: boolean) => {
    if (!hasSelectedEvents) return;
    if (onUpdateEvents) {
      // Call the parent's update handler with the selected event IDs and updates
      onUpdateEvents(Array.from(selectedEventIds), { in_person: isInPerson });
    } else {
      // Fallback to local updates if no parent handler provided
      const updated = events.map(event =>
        selectedEventIds.has(event.id)
          ? { ...event, in_person: isInPerson }
          : event
      );
      commitEvents(updated);
    }
  };

  const handleClearAllSelections = () => {
    // Clear selected events
    if (selectedEventIds.size > 0) {
      setSelectedEventIds(new Set());
      onSelectChange?.([]);
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
                    {formatHourLabel(i % 24)}
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
                        rubber={rubber}
                        setRubber={setRubber}
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
        onUpdateCategory={handleUpdateCategory}
        onUpdateIsOnlineMeeting={handleUpdateIsOnlineMeeting}
        onUpdateIsInPerson={handleUpdateIsInPerson}
        selectedIsOnlineMeeting={selectedIsOnlineMeeting}
        selectedIsInPerson={selectedIsInPerson}
        userCategories={userCategories}
      />

      <CommandPalette />
    </div>
  );
});

export default CalendarWeek;