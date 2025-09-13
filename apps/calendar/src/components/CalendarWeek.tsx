"use client";

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { CalendarWeekHandle, CalendarWeekProps, CalEvent, EventId, SelectedTimeRange, DragState, SystemSlot, Rubber } from "./types";
import { DAY_MS, getTZ, toZDT, parseWeekStart, snapMs, clamp, layoutDay, formatHourLabel, createEventsFromRanges, deleteEventsByIds, recommendSlotsForDay } from "./utils";
import { DayColumn } from "./DayColumn";
import { ActionBar } from "./ActionBar";
import { useTimeSuggestions } from "../hooks/useTimeSuggestions";

const CalendarWeek = forwardRef<CalendarWeekHandle, CalendarWeekProps>(function CalendarWeek(
  {
    initialWeekStartISO,
    days: daysProp = 7,
    slotMinutes = 30,
    pxPerHour = 48,
    viewportHeight = 720,
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
  }: CalendarWeekProps,
  ref
) {
  const tz = getTZ(timeZone);
  const [days, setDays] = useState<5 | 7>(daysProp);
  useEffect(() => { setDays(daysProp); }, [daysProp]);

  const weekStartMsInitial = useMemo(
    () => parseWeekStart(initialWeekStartISO, tz, weekStartsOn),
    [initialWeekStartISO, tz, weekStartsOn]
  );
  const [weekStartMs, setWeekStartMs] = useState<number>(weekStartMsInitial);

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

  const [rubber, setRubber] = useState<Rubber>(null as any);
  const snapStep = slotMinutes * 60_000;
  const dragSnapMs = Math.max(1, dragSnapMinutes) * 60_000;

  const fullHeight = 24 * pxPerHour;
  const pxPerMs = pxPerHour / 3_600_000;

  const positioned = useMemo(() => {
    const arr: ReturnType<typeof layoutDay> = [] as any;
    for (let dayIdx = 0; dayIdx < days; dayIdx++) {
      const dayStart00 = toZDT(weekStartMs + dayIdx * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
      const dayEnd24 = dayStart00 + DAY_MS;
      const laid = layoutDay(events, dayStart00, dayEnd24, pxPerMs).map((p) => ({ ...p, dayIdx }));
      arr.push(...laid);
    }
    return arr as any;
  }, [events, days, weekStartMs, tz, pxPerMs]);

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
      setWeekStartMs(parseWeekStart(iso, tz, weekStartsOn));
    },
    nextWeek: () => setWeekStartMs((x) => x + days * DAY_MS),
    prevWeek: () => setWeekStartMs((x) => x - days * DAY_MS),
    setDays: (d) => setDays(d),
    getVisibleRange: () => ({ startMs: weekStartMs, endMs: weekStartMs + days * DAY_MS }),
    getSelectedTimeRanges: () => timeRanges,
    setSelectedTimeRanges: (ranges) => commitRanges(ranges),
    clearTimeSelection: () => commitRanges([]),
  }), [tz, weekStartsOn, days, weekStartMs, timeRanges]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 8 * pxPerHour; }, [pxPerHour]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRubber(null as any); setDrag(null);
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

  return (
    <div className="relative w-full select-none text-sm">
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)` }}>
        <div />
        {Array.from({ length: days }).map((_, i) => {
          const date = toZDT(weekStartMs + i * DAY_MS, tz);
          const label = `${date.toLocaleString(undefined, { weekday: "short" })} ${date.month}-${date.day}`;
          return (<div key={i} className="px-3 py-2 font-medium">{label}</div>);
        })}
      </div>

      <div ref={scrollRef} className="grid border-t border-gray-200 overflow-y-auto" style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)`, height: viewportHeight }}>
        <div className="relative border-r border-gray-200" style={{ height: 24 * pxPerHour }}>
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="absolute right-1 -translate-y-2 text-xs text-gray-500" style={{ top: i * pxPerHour }}>
              {formatHourLabel(i % 24)}
            </div>
          ))}
        </div>

        {Array.from({ length: days }).map((_, dayIdx) => (
          <DayColumn
            key={dayIdx}
            dayIdx={dayIdx}
            days={days}
            tz={tz}
            weekStartMs={weekStartMs}
            gridHeight={24 * pxPerHour}
            pxPerHour={pxPerHour}
            pxPerMs={pxPerMs}
            events={events}
            positioned={(positioned as any).filter((p: any) => p.dayIdx === dayIdx)}
            highlightedEventIds={new Set(highlightedEventIds)}
            selectedEventIds={selectedEventIds}
            setSelectedEventIds={updateSelection}
            drag={drag}
            setDrag={setDrag}
            onCommit={(updated) => commitEvents(updated)}
            rubber={rubber as any}
            setRubber={setRubber as any}
            yToLocalMs={yToLocalMs}
            localMsToY={localMsToY}
            snapStep={snapStep}
            dragSnapMs={dragSnapMs}
            minDurMs={Math.max(minDurationMinutes, slotMinutes) * 60_000}
            timeRanges={timeRanges}
            commitRanges={commitRanges}
            aiHighlights={aiHighlights}
            systemSlots={(systemHighlightSlots ?? []).filter(s=>s.dayIdx===dayIdx).concat((systemSlots as any).filter((s:any)=>s.dayIdx===dayIdx))}
          />
        ))}
      </div>

      <ActionBar
        timeRanges={timeRanges}
        onCreateEvents={handleCreateEvents}
        onClearSelection={() => commitRanges([])}
        selectedEventCount={selectedEventIds.size}
        onDeleteSelected={handleDeleteSelected}
      />
    </div>
  );
});

export default CalendarWeek;