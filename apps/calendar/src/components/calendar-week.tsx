"use client";

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
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

  // Use app store for days and week start
  const { days, weekStartMs, selectedDate, selectedDates, isMultiSelectMode, setDays, setWeekStart } = useAppStore();

  // Sync with props when they change
  useEffect(() => {
    if (daysProp !== days) {
      setDays(daysProp);
    }
  }, [daysProp, days, setDays]);

  // Sync calendar to selected date changes
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

  // Column model - Replace days-based logic with explicit column dates
  const colStarts = useMemo(() => {
    const toStartOfDay = (v: Date | string | number) => {
      const d = typeof v === "number" ? new Date(v) : new Date(v);
      return toZDT(d.getTime(), tz)
        .with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        .epochMilliseconds;
    };

    if (Array.isArray(columnDates) && columnDates.length > 0) {
      return columnDates.map(toStartOfDay);
    }

    // For multi-select mode, use selected dates
    if (isMultiSelectMode && selectedDates.length > 0) {
      return selectedDates.map(date => {
        const dateObj = date instanceof Date ? date : new Date(date);
        return toZDT(dateObj.getTime(), tz)
          .with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
          .epochMilliseconds;
      });
    }

    // Default: consecutive days from weekStartMs
    return Array.from({ length: days }, (_, i) =>
      toZDT(weekStartMs + i * DAY_MS, tz)
        .with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
        .epochMilliseconds
    );
  }, [columnDates, weekStartMs, days, tz, isMultiSelectMode, selectedDates]);

  const getDayStartMs = (i: number) => colStarts[i];

  const [uncontrolledEvents, setUncontrolledEvents] = useState<CalEvent[]>(() => controlledEvents || []);
  useEffect(() => { if (controlledEvents) setUncontrolledEvents(controlledEvents); }, [controlledEvents]);
  const events = controlledEvents ?? uncontrolledEvents;

  const [uncontrolledRanges, setUncontrolledRanges] = useState<SelectedTimeRange[]>(() => []);
  useEffect(() => { if (selectedTimeRanges) setUncontrolledRanges(selectedTimeRanges); }, [selectedTimeRanges]);
  const timeRanges = selectedTimeRanges ?? uncontrolledRanges;
  const commitRanges = (next: SelectedTimeRange[]) => {
    onTimeSelectionChange?.(next);
    if (!selectedTimeRanges) setUncontrolledRanges(next);
  };
  const commitEvents = (next: CalEvent[]) => {
    onEventsChange?.(next);
    if (!controlledEvents) setUncontrolledEvents(next);
  };

  const [selectedEventIds, setSelectedEventIds] = useState<Set<EventId>>(new Set());
  function updateSelection(next: Set<EventId>) {
    setSelectedEventIds(new Set(next));
    onSelectChange?.(Array.from(next));
  }

  const [rubber, setRubber] = useState<Rubber>(null);
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

  const systemSlots = useTimeSuggestions(!!drag);

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
      setWeekStart(parseWeekStart(iso, tz, weekStartsOn));
    },
    nextWeek: () => setWeekStart(weekStartMs + days * DAY_MS),
    prevWeek: () => setWeekStart(weekStartMs - days * DAY_MS),
    setDays: (d) => setDays(d),
    getVisibleRange: () => ({ startMs: weekStartMs, endMs: weekStartMs + days * DAY_MS }),
    getSelectedTimeRanges: () => timeRanges,
    setSelectedTimeRanges: (ranges) => commitRanges(ranges),
    clearTimeSelection: () => commitRanges([]),
  }), [tz, weekStartsOn, days, weekStartMs, timeRanges, setWeekStart, setDays]);

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
        const remaining = deleteEventsByIds(events, selectedEventIds);
        commitEvents(remaining);
        setSelectedEventIds(new Set());
        onSelectChange?.([]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEventIds.size, timeRanges?.length, onSelectChange, events]);

  const hasRanges = timeRanges.length > 0;
  const hasSelectedEvents = selectedEventIds.size > 0;

  // Get current state of selected events for ActionBar checkbox states
  const selectedEvents = events.filter(event => selectedEventIds.has(event.id));
  const selectedIsOnlineMeeting = selectedEvents.length > 0 ? selectedEvents.every(e => e.isOnlineMeeting) : false;
  const selectedIsInPerson = selectedEvents.length > 0 ? selectedEvents.every(e => e.isInPerson) : false;

  const handleCreateEvents = () => {
    if (!hasRanges) return;
    const created = createEventsFromRanges(timeRanges, "New event");
    commitEvents([...events, ...created]);
    commitRanges([]);
  };
  const handleDeleteSelected = () => {
    if (!hasSelectedEvents) return;
    const remaining = deleteEventsByIds(events, selectedEventIds);
    commitEvents(remaining);
    setSelectedEventIds(new Set());
    onSelectChange?.([]);
  };

  const handleUpdateShowTimeAs = (showTimeAs: import("./types").ShowTimeAs) => {
    if (!hasSelectedEvents) return;
    const updated = events.map(event =>
      selectedEventIds.has(event.id)
        ? { ...event, showTimeAs }
        : event
    );
    commitEvents(updated);
  };

  const handleUpdateCategory = (category: import("./types").EventCategory) => {
    if (!hasSelectedEvents) return;
    const updated = events.map(event =>
      selectedEventIds.has(event.id)
        ? { ...event, category }
        : event
    );
    commitEvents(updated);
  };

  const handleUpdateIsOnlineMeeting = (isOnlineMeeting: boolean) => {
    if (!hasSelectedEvents) return;
    const updated = events.map(event =>
      selectedEventIds.has(event.id)
        ? { ...event, isOnlineMeeting }
        : event
    );
    commitEvents(updated);
  };

  const handleUpdateIsInPerson = (isInPerson: boolean) => {
    if (!hasSelectedEvents) return;
    const updated = events.map(event =>
      selectedEventIds.has(event.id)
        ? { ...event, isInPerson }
        : event
    );
    commitEvents(updated);
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


  const displayDays = colStarts.length;
  const displayDates = useMemo(() => {
    return colStarts.map(dayStartMs => new Date(dayStartMs));
  }, [colStarts]);

  return (
    <div
      id="calendar-week"
      className="relative w-full select-none text-sm flex flex-col h-full"
    >
      {/* Header */}
      <div id="calendar-header" className="grid pr-2.5" style={{ gridTemplateColumns: `72px repeat(${displayDays}, 1fr)` }}>
        <div />
        {displayDates.map((date, i) => {
          const dateObj = date instanceof Date ? date : new Date(date);
          const timeMs = dateObj.getTime();

          if (isNaN(timeMs)) {
            return <div key={i} className="px-3 py-2 font-medium">Invalid Date</div>;
          }

          const zdt = toZDT(Math.floor(timeMs), tz);
          const dayNumber = zdt.day;
          const weekday = zdt.toLocaleString(undefined, { weekday: "short" });

          return (
            <div key={i} className="px-3 py-2 text-left">
              <div className="text-lg font-semibold leading-tight">{dayNumber}</div>
              <div className="text-sm text-muted-foreground">{weekday}</div>
            </div>
          );
        })}
      </div>

      {/* Body: 2-column grid -> [gutter | scrollable days] */}
      <div
        id="calendar-body"
        className="grid border-t border-border flex-1 overflow-hidden"
        style={{ gridTemplateColumns: "72px 1fr" }}
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
          <div
            className="grid pr-2.5"
            style={{ gridTemplateColumns: `repeat(${displayDays}, 1fr)`, height: fullHeight }}
          >
            {colStarts.map((dayStartMs, dayIdx) => (
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
              />
            ))}
          </div>
          <ScrollBar orientation="vertical" className="z-30" />
        </ScrollArea>
      </div>

      <ActionBar
        timeRanges={timeRanges}
        onCreateEvents={handleCreateEvents}
        onClearSelection={() => commitRanges([])}
        selectedEventCount={selectedEventIds.size}
        onDeleteSelected={handleDeleteSelected}
        onUpdateShowTimeAs={handleUpdateShowTimeAs}
        onUpdateCategory={handleUpdateCategory}
        onUpdateIsOnlineMeeting={handleUpdateIsOnlineMeeting}
        onUpdateIsInPerson={handleUpdateIsInPerson}
        selectedIsOnlineMeeting={selectedIsOnlineMeeting}
        selectedIsInPerson={selectedIsInPerson}
      />
    </div>
  );
});

export default CalendarWeek;