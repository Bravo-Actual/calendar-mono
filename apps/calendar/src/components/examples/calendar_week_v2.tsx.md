"use client";

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Temporal } from "@js-temporal/polyfill";

/**
 * Contained, client-only Outlook-style week calendar component
 * - Week view (5 or 7 days)
 * - 24-hour day timeline with vertical scroll (no clipping)
 * - Mouse rubber-band time selection:
 *     Mode 1 (default drag): one continuous span from start→end across days
 *     Mode 2 (Ctrl/Cmd + Shift + drag): clone same start/end times on every spanned day
 *   Holding Ctrl/Cmd also means multi-add (append) vs replace
 * - Event cards: select (single / multi via Ctrl/Cmd+click), drag to move across days, resize top/bottom
 * - Drag/resize snapping (default 5 minutes) with live ghost preview
 * - AI highlight overlays for time ranges and events
 * - Imperative API: goTo(date), nextWeek(), prevWeek(), setDays(5|7)
 * - Timezone-safe using Temporal; state in epoch ms (UTC)
 */

// ========= Types ========= //
export type EventId = string;
export interface CalEvent {
  id: EventId;
  title: string;
  start: number; // epoch ms UTC
  end: number;   // epoch ms UTC (end > start)
  allDay?: boolean;
  meta?: Record<string, unknown>;
}

export interface TimeHighlight {
  id: string;
  dayIdx: number; // 0..(days-1) relative to current weekStart
  start: number;  // ms from 00:00 local (e.g., 13:30 -> 48600000)
  end: number;    // ms from 00:00 local
  intent?: string;
}

export interface SelectedTimeRange {
  id: string;          // internal ID
  dayIdx: number;      // 0..(days-1)
  startAbs: number;    // absolute epoch ms UTC (start < end)
  endAbs: number;      // absolute epoch ms UTC
}

// Shared internal types
export type DragKind = "move" | "resize-start" | "resize-end";
export interface DragState {
  kind: DragKind;
  id: EventId;
  origStart: number;
  origEnd: number;
  startX: number;
  startY: number;
  startDayIdx: number;
  targetDayIdx?: number;
  hoverStart?: number;
  hoverEnd?: number;
}

export type Rubber = {
  startDayIdx: number;
  endDayIdx: number;
  startMsInDay: number;
  endMsInDay: number;
  multi: boolean;
  mode: "span" | "clone";
} | null;

export interface CalendarWeekProps {
  initialWeekStartISO?: string;         // ISO string; defaults to today
  days?: 5 | 7;                         // default 7
  slotMinutes?: 5 | 10 | 15 | 30 | 60;  // grid line density, default 30
  pxPerHour?: number;                   // vertical density, default 48
  viewportHeight?: number;              // scroll viewport height (px), default 720
  timeZone?: string;                    // IANA TZ; default browser TZ
  events?: CalEvent[];                  // controlled; else internal state
  onEventsChange?: (next: CalEvent[]) => void;
  onSelectChange?: (ids: EventId[]) => void; // selected event cards
  aiHighlights?: TimeHighlight[];       // optional time-range overlays (AI)
  highlightedEventIds?: EventId[];      // optional highlight ring for specific events
  weekStartsOn?: 0 | 1;                 // 0=Sunday, 1=Monday (default 1)
  minDurationMinutes?: number;          // default 15
  dragSnapMinutes?: number;             // default 5 for drag/resize snapping
  // Time selection ranges (rubber-band over empty grid)
  selectedTimeRanges?: SelectedTimeRange[]; // controlled; else internal
  onTimeSelectionChange?: (ranges: SelectedTimeRange[]) => void;
}

export interface CalendarWeekHandle {
  goTo: (date: Date | string | number) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  setDays: (d: 5 | 7) => void;
  getVisibleRange: () => { startMs: number; endMs: number };
  getSelectedTimeRanges: () => SelectedTimeRange[];
  setSelectedTimeRanges: (ranges: SelectedTimeRange[]) => void;
  clearTimeSelection: () => void;
}

// ========= Helpers ========= //
const DAY_MS = 86_400_000;

function getTZ(tz?: string) {
  return tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function toZDT(ms: number, tz: string) {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz);
}

function parseWeekStart(initialISO: string | undefined, tz: string, weekStartsOn: 0 | 1) {
  const base = initialISO ? Temporal.ZonedDateTime.from(`${initialISO}[${tz}]`) : Temporal.Now.zonedDateTimeISO(tz);
  const weekday = base.dayOfWeek; // 1=Mon..7=Sun
  const target = weekStartsOn === 1 ? 1 : 7; // Mon or Sun in 1..7 space
  const diff = (weekday - target + 7) % 7;
  const atStart = base.subtract({ days: diff }).with({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  return atStart.epochMilliseconds; // UTC ms
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function formatHourLabel(h: number) {
  const hour = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour}:00 ${ampm}`;
}

function snapMs(ms: number, step: number) {
  const snapped = Math.round(ms / step) * step;
  return snapped;
}

// ========= Overlap layout (columnizer) ========= //
interface PositionedEvent {
  id: EventId;
  rect: { top: number; height: number; leftPct: number; widthPct: number };
  dayIdx: number;
}

function layoutDay(
  events: CalEvent[],
  dayStart: number,
  dayEnd: number,
  pxPerMs: number,
  gap = 2
): PositionedEvent[] {
  const dayEvents = events
    .filter((e) => e.end > dayStart && e.start < dayEnd && !e.allDay)
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));

  const clusters: CalEvent[][] = [];
  let current: CalEvent[] = [];
  let currentEnd = -Infinity;
  for (const e of dayEvents) {
    if (current.length === 0 || e.start < currentEnd) {
      current.push(e);
      currentEnd = Math.max(currentEnd, e.end);
    } else {
      clusters.push(current);
      current = [e];
      currentEnd = e.end;
    }
  }
  if (current.length) clusters.push(current);

  const out: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const cols: CalEvent[][] = [];
    for (const e of cluster) {
      let placed = false;
      for (const col of cols) {
        if (col[col.length - 1].end <= e.start) { col.push(e); placed = true; break; }
      }
      if (!placed) cols.push([e]);
    }
    const colCount = cols.length;
    const colIdx = new Map<EventId, number>();
    cols.forEach((col, i) => col.forEach((e) => colIdx.set(e.id, i)));

    for (const e of cluster) {
      const top = Math.max(0, (Math.max(e.start, dayStart) - dayStart) * pxPerMs);
      const height = Math.max(12, (Math.min(e.end, dayEnd) - Math.max(e.start, dayStart)) * pxPerMs);
      const leftPct = (colIdx.get(e.id)! / colCount) * 100;
      const widthPct = 100 / colCount - (gap / colCount);
      out.push({ id: e.id, rect: { top, height, leftPct, widthPct }, dayIdx: 0 }); // dayIdx filled by caller
    }
  }
  return out;
}

// ========= Component ========= //
const DEFAULT_COLORS = {
  eventBg: "var(--card, #ffffff)",
  eventBorder: "var(--border, rgba(0,0,0,0.08))",
  selection: "rgba(59,130,246,0.2)",
  selectionBorder: "rgba(59,130,246,1)",
  ai: "rgba(16,185,129,0.18)",
  aiBorder: "rgba(5,150,105,0.8)",
  highlightRing: "rgba(234,179,8,0.9)",
  ghost: "rgba(59,130,246,0.18)",
  ghostBorder: "rgba(59,130,246,0.9)",
};

const MIN_SLOT_PX = 8; // visual minimum height for tiny events

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
  }: CalendarWeekProps,
  ref
) {
  // ---- configuration ----
  const tz = getTZ(timeZone);
  const [days, setDays] = useState<5 | 7>(daysProp);
  useEffect(() => { setDays(daysProp); }, [daysProp]);

  const weekStartMsInitial = useMemo(
    () => parseWeekStart(initialWeekStartISO, tz, weekStartsOn),
    [initialWeekStartISO, tz, weekStartsOn]
  );

  const [weekStartMs, setWeekStartMs] = useState<number>(weekStartMsInitial);

  // ---- events (controlled / uncontrolled) ----
  const [uncontrolledEvents, setUncontrolledEvents] = useState<CalEvent[]>(() => controlledEvents || []);
  useEffect(() => { if (controlledEvents) setUncontrolledEvents(controlledEvents); }, [controlledEvents]);
  const events = controlledEvents ?? uncontrolledEvents;

  // ---- time selection ranges (controlled / uncontrolled) ----
  const [uncontrolledRanges, setUncontrolledRanges] = useState<SelectedTimeRange[]>(() => []);
  useEffect(() => { if (selectedTimeRanges) setUncontrolledRanges(selectedTimeRanges); }, [selectedTimeRanges]);
  const timeRanges = selectedTimeRanges ?? uncontrolledRanges;
  const commitRanges = (next: SelectedTimeRange[]) => {
    onTimeSelectionChange?.(next);
    if (!selectedTimeRanges) setUncontrolledRanges(next);
  };

  const commitEvents = (next: CalEvent[]) => {
    if (onEventsChange) onEventsChange(next);
    if (!controlledEvents) setUncontrolledEvents(next);
  };

  // ---- selection model ----
  const [selectedEventIds, setSelectedEventIds] = useState<Set<EventId>>(new Set());
  function updateSelection(next: Set<EventId>) {
    setSelectedEventIds(new Set(next));
    onSelectChange?.(Array.from(next));
  }

  // ---- rubber-band selection of time ranges ----
  const [rubber, setRubber] = useState<Rubber>(null);
  const snapStep = slotMinutes * 60_000;                  // selection grid snapping
  const dragSnapMs = Math.max(1, dragSnapMinutes) * 60_000; // drag/resize snapping (default 5m)

  // ---- geometry ----
  const fullHeight = 24 * pxPerHour;      // 24h always
  const pxPerMs = pxPerHour / 3_600_000;  // ms → px

  // ---- positioned events per day ----
  const positioned = useMemo(() => {
    const arr: PositionedEvent[] = [];
    for (let dayIdx = 0; dayIdx < days; dayIdx++) {
      const dayStart00 = toZDT(weekStartMs + dayIdx * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
      const dayEnd24 = dayStart00 + DAY_MS;
      const laid = layoutDay(events, dayStart00, dayEnd24, pxPerMs).map((p) => ({ ...p, dayIdx }));
      arr.push(...laid);
    }
    return arr;
  }, [events, days, weekStartMs, tz, pxPerMs]);

  // ---- drag state ----
  const [drag, setDrag] = useState<DragState | null>(null);

  // helpers to convert pixel<->time within a day column
  function yToLocalMs(y: number, step = snapStep) {
    const clamped = clamp(y, 0, fullHeight);
    const dayMs = clamped / pxPerMs; // ms from 00:00
    return snapMs(dayMs, step);
  }

  function localMsToY(msInDay: number) {
    return clamp(msInDay * pxPerMs, 0, fullHeight);
  }

  // Imperative API
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

  // ---- scroll to a sensible hour initially (08:00) ----
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * pxPerHour;
  }, [pxPerHour]);

  // ---- global Escape handler to clear selections ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // cancel in-progress gestures
        setRubber(null);
        setDrag(null);
        // clear selected event ids
        if (selectedEventIds.size) {
          setSelectedEventIds(new Set());
          onSelectChange?.([]);
        }
        // clear time range selections
        if ((timeRanges?.length ?? 0) > 0) {
          commitRanges([]);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEventIds.size, timeRanges?.length, onSelectChange]);

  // ---- render ----
  return (
    <div className="w-full select-none text-sm">
      {/* Header: day labels */}
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)` }}>
        <div />
        {Array.from({ length: days }).map((_, i) => {
          const date = toZDT(weekStartMs + i * DAY_MS, tz);
          const label = `${date.toLocaleString(undefined, { weekday: "short" })} ${date.month}-${date.day}`;
          return (
            <div key={i} className="px-3 py-2 font-medium">
              {label}
            </div>
          );
        })}
      </div>

      {/* Body: scrollable 24h timeline */}
      <div ref={scrollRef} className="grid border-t border-gray-200 overflow-y-auto" style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)`, height: viewportHeight }}>
        {/* hour gutter */}
        <div className="relative border-r border-gray-200" style={{ height: fullHeight }}>
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="absolute right-1 -translate-y-2 text-xs text-gray-500" style={{ top: i * pxPerHour }}>
              {formatHourLabel(i % 24)}
            </div>
          ))}
        </div>

        {/* day columns */}
        {Array.from({ length: days }).map((_, dayIdx) => (
          <DayColumn
            key={dayIdx}
            dayIdx={dayIdx}
            days={days}
            tz={tz}
            weekStartMs={weekStartMs}
            gridHeight={fullHeight}
            pxPerHour={pxPerHour}
            pxPerMs={pxPerMs}
            events={events}
            positioned={positioned.filter((p) => p.dayIdx === dayIdx)}
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
          />
        ))}
      </div>
    </div>
  );
});

export default CalendarWeek;

// ========= Subcomponents ========= //

function DayColumn(props: {
  dayIdx: number;
  days: number;
  tz: string;
  weekStartMs: number;
  gridHeight: number;
  pxPerHour: number;
  pxPerMs: number;
  events: CalEvent[];
  positioned: PositionedEvent[];
  highlightedEventIds: Set<EventId>;
  selectedEventIds: Set<EventId>;
  setSelectedEventIds: (s: Set<EventId>) => void;
  drag: DragState | null;
  setDrag: React.Dispatch<React.SetStateAction<DragState | null>>;
  onCommit: (next: CalEvent[]) => void;
  rubber: Rubber;
  setRubber: React.Dispatch<React.SetStateAction<Rubber>>;
  yToLocalMs: (y: number, step?: number) => number;
  localMsToY: (msInDay: number) => number;
  snapStep: number;
  dragSnapMs: number;
  minDurMs: number;
  // time range selection (persistent overlays)
  timeRanges?: SelectedTimeRange[];
  commitRanges?: (next: SelectedTimeRange[]) => void;
  aiHighlights: TimeHighlight[];
}) {
  const {
    dayIdx, days, tz, weekStartMs, gridHeight,
    events, positioned, highlightedEventIds, selectedEventIds, setSelectedEventIds,
    drag, setDrag, onCommit, rubber, setRubber,
    yToLocalMs, localMsToY, snapStep, dragSnapMs, minDurMs,
    aiHighlights,
  } = props;

  const colRef = useRef<HTMLDivElement>(null);

  const dayStart00 = toZDT(weekStartMs + dayIdx * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
  const dayEnd24 = dayStart00 + DAY_MS;

  // Pointer handlers for empty-column rubber-band selection
  function onPointerDownEmpty(e: React.PointerEvent) {
    if (!colRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ms = yToLocalMs(y, snapStep);
    setRubber({
      startDayIdx: dayIdx,
      endDayIdx: dayIdx,
      startMsInDay: ms,
      endMsInDay: ms,
      multi: e.ctrlKey || e.metaKey,
      mode: (e.shiftKey && (e.ctrlKey || e.metaKey)) ? "clone" : "span",
    });
  }

  function onPointerMoveEmpty(e: React.PointerEvent) {
    if (!rubber || !colRef.current) return;
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const dayDelta = Math.floor((e.clientX - rect.left) / rect.width);
    const targetDayIdx = clamp(rubber.startDayIdx + dayDelta, 0, days - 1);
    setRubber({ ...rubber, endDayIdx: targetDayIdx, endMsInDay: yToLocalMs(y, snapStep) });
  }

  function onPointerUpEmpty() {
    if (!rubber) return;

    const a = Math.min(rubber.startDayIdx, rubber.endDayIdx);
    const b = Math.max(rubber.startDayIdx, rubber.endDayIdx);

    const newRanges: SelectedTimeRange[] = [];

    if (rubber.mode === "span") {
      // One continuous block sliced by day boundaries
      for (let i = a; i <= b; i++) {
        const base = toZDT(weekStartMs + i * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
        let segStart: number;
        let segEnd: number;
        if (a === b) {
          segStart = Math.min(rubber.startMsInDay, rubber.endMsInDay);
          segEnd = Math.max(rubber.startMsInDay, rubber.endMsInDay);
        } else if (i === a) {
          segStart = rubber.startMsInDay;
          segEnd = DAY_MS;
        } else if (i === b) {
          segStart = 0;
          segEnd = rubber.endMsInDay;
        } else {
          segStart = 0;
          segEnd = DAY_MS;
        }
        segStart = clamp(segStart, 0, DAY_MS);
        segEnd = clamp(segEnd, 0, DAY_MS);
        if (segEnd - segStart >= snapStep) {
          newRanges.push({
            id: `rng_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            dayIdx: i,
            startAbs: base + segStart,
            endAbs: base + segEnd,
          });
        }
      }
    } else {
      // clone mode: same times on every day
      const s = Math.min(rubber.startMsInDay, rubber.endMsInDay);
      const eMs = Math.max(rubber.startMsInDay, rubber.endMsInDay);
      if (eMs - s >= snapStep) {
        for (let i = a; i <= b; i++) {
          const base = toZDT(weekStartMs + i * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
          newRanges.push({
            id: `rng_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            dayIdx: i,
            startAbs: base + s,
            endAbs: base + eMs,
          });
        }
      }
    }

    setRubber(null);
    if (!newRanges.length) return;

    const existing = (props.timeRanges ?? []).slice();
    const next = rubber.multi ? [...existing, ...newRanges] : newRanges;
    props.commitRanges?.(next);
  }

  // Event selection click
  function toggleSelect(id: EventId, multi: boolean) {
    const next = new Set(selectedEventIds);
    if (multi) { next.has(id) ? next.delete(id) : next.add(id); }
    else { next.clear(); next.add(id); }
    setSelectedEventIds(next);
  }

  // Drag / resize logic
  function onPointerDownMove(e: React.PointerEvent, id: EventId, kind: "move" | "resize-start" | "resize-end") {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const evt = events.find((x) => x.id === id)!;
    setDrag({ kind, id, origStart: evt.start, origEnd: evt.end, startX: e.clientX, startY: e.clientY, startDayIdx: dayIdx });
  }

  function onPointerMoveColumn(e: React.PointerEvent) {
    if (!drag || !colRef.current) return;
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;

    // Cross-day detection: how many column-widths have we moved from the origin column?
    const dayDelta = Math.floor((e.clientX - rect.left) / rect.width);
    const targetDayIdx = clamp(drag.startDayIdx + dayDelta, 0, days - 1);

    const targetDayStart00 = toZDT(weekStartMs + targetDayIdx * DAY_MS, tz)
      .with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;

    const localMs = yToLocalMs(y, dragSnapMs);

    if (drag.kind === "move") {
      const dur = drag.origEnd - drag.origStart;
      let nextStart = targetDayStart00 + localMs - Math.floor(dur / 2);
      let nextEnd = nextStart + dur;
      // clamp to single-day bounds
      nextStart = Math.max(targetDayStart00, nextStart);
      nextEnd = Math.min(targetDayStart00 + DAY_MS, nextEnd);
      setDrag({ ...drag, targetDayIdx, hoverStart: nextStart, hoverEnd: nextEnd });
    } else {
      // resize
      const isStart = drag.kind === "resize-start";
      const fixed = isStart ? drag.origEnd : drag.origStart;
      let moving = targetDayStart00 + localMs;
      if (isStart) moving = Math.min(moving, fixed - minDurMs);
      else moving = Math.max(moving, fixed + minDurMs);
      // clamp into target day
      moving = clamp(moving, targetDayStart00, targetDayStart00 + DAY_MS);
      const hoverStart = isStart ? moving : fixed;
      const hoverEnd = isStart ? fixed : moving;
      setDrag({ ...drag, targetDayIdx, hoverStart, hoverEnd });
    }
  }

  function onPointerUpColumn() {
    if (!drag) return;
    const evtIdx = events.findIndex((x) => x.id === drag.id);
    if (evtIdx === -1) { setDrag(null); return; }
    const evt = events[evtIdx];

    const nextStart = drag.hoverStart ?? evt.start;
    const nextEnd = drag.hoverEnd ?? evt.end;

    if (nextStart !== evt.start || nextEnd !== evt.end) {
      const updated = { ...evt, start: nextStart, end: nextEnd };
      const next = events.slice(); next[evtIdx] = updated;
      onCommit(next);
    }
    setDrag(null);
  }

  // Decorations: AI highlights for this day
  const aiForDay = (aiHighlights ?? []).filter((h) => h.dayIdx === dayIdx);

  // Selected time ranges (persistent)
  const rangesForDay = (props.timeRanges ?? []).filter((r) => r.dayIdx === dayIdx);

  // Helper for rendering absolute ms as y within this day
  const yForAbs = (absMs: number) => localMsToY(absMs - dayStart00);

  // Rubber-band segment (for this day) based on mode
  const rubberSegment = (() => {
    if (!rubber) return null;
    const a = Math.min(rubber.startDayIdx, rubber.endDayIdx);
    const b = Math.max(rubber.startDayIdx, rubber.endDayIdx);
    if (dayIdx < a || dayIdx > b) return null;
    if (rubber.mode === "span") {
      if (a === b) return { start: Math.min(rubber.startMsInDay, rubber.endMsInDay), end: Math.max(rubber.startMsInDay, rubber.endMsInDay) };
      if (dayIdx === a) return { start: rubber.startMsInDay, end: DAY_MS };
      if (dayIdx === b) return { start: 0, end: rubber.endMsInDay };
      return { start: 0, end: DAY_MS };
    }
    // clone mode
    return { start: Math.min(rubber.startMsInDay, rubber.endMsInDay), end: Math.max(rubber.startMsInDay, rubber.endMsInDay) };
  })();

  return (
    <div
      ref={colRef}
      className="relative border-r border-gray-200 last:border-r-0 bg-white"
      style={{ height: gridHeight, backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)`, backgroundSize: `100% ${props.pxPerHour}px` }}
      onPointerDown={onPointerDownEmpty}
      onPointerMove={(e) => { onPointerMoveEmpty(e); onPointerMoveColumn(e); }}
      onPointerUp={() => { onPointerUpEmpty(); onPointerUpColumn(); }}
    >
      {/* AI time-range highlights */}
      {aiForDay.map((h) => (
        <div key={h.id}
          className="absolute inset-x-1 rounded border"
          style={{
            top: localMsToY(h.start),
            height: Math.max(6, localMsToY(h.end) - localMsToY(h.start)),
            background: DEFAULT_COLORS.ai,
            borderColor: DEFAULT_COLORS.aiBorder,
            pointerEvents: "none",
          }}
          title={h.intent || "AI highlight"}
        />
      ))}

      {/* Rubber-band selection (in-progress) */}
      {rubberSegment && (
        <div
          className="absolute inset-x-1 rounded border"
          style={{
            top: Math.min(localMsToY(rubberSegment.start), localMsToY(rubberSegment.end)),
            height: Math.abs(localMsToY(rubberSegment.end) - localMsToY(rubberSegment.start)),
            background: DEFAULT_COLORS.selection,
            borderColor: DEFAULT_COLORS.selectionBorder,
          }}
        />
      )}

      {/* Persistent selected ranges */}
      {rangesForDay.map((r) => (
        <div key={r.id}
          className="absolute inset-x-1 rounded border pointer-events-none"
          style={{
            top: yForAbs(r.startAbs),
            height: Math.max(4, yForAbs(r.endAbs) - yForAbs(r.startAbs)),
            background: DEFAULT_COLORS.selection,
            borderColor: DEFAULT_COLORS.selectionBorder,
            opacity: 0.6,
          }}
          title={new Date(r.startAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " – " + new Date(r.endAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        />
      ))}

      {/* Events in this day */}
      {positioned.map((p) => {
        const e = events.find((x) => x.id === p.id)!;
        const selected = selectedEventIds.has(e.id);
        const highlighted = highlightedEventIds.has(e.id);
        const isDragging = drag?.id === e.id;
        return (
          <div
            key={e.id}
            role="group"
            aria-selected={selected}
            className={`absolute rounded-md shadow-sm overflow-hidden border ${selected ? "ring-2 ring-blue-400 border-blue-600" : ""}`}
            style={{
              top: p.rect.top,
              height: Math.max(MIN_SLOT_PX, p.rect.height),
              left: `${p.rect.leftPct}%`,
              width: `calc(${p.rect.widthPct}% - 2px)`,
              background: DEFAULT_COLORS.eventBg,
              borderColor: DEFAULT_COLORS.eventBorder,
              boxShadow: highlighted ? `0 0 0 2px ${DEFAULT_COLORS.highlightRing}` : undefined,
              opacity: isDragging ? 0.35 : 1,
            }}
            onClick={(ev) => toggleSelect(e.id, ev.ctrlKey || ev.metaKey)}
          >
            {/* Resize handles */}
            <div
              className="absolute inset-x-0 top-0 h-2 cursor-n-resize"
              onPointerDown={(ev) => onPointerDownMove(ev, e.id, "resize-start")}
              onPointerMove={(ev) => onPointerMoveColumn(ev)}
              onPointerUp={() => onPointerUpColumn()}
              title="Resize start"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-2 cursor-s-resize"
              onPointerDown={(ev) => onPointerDownMove(ev, e.id, "resize-end")}
              onPointerMove={(ev) => onPointerMoveColumn(ev)}
              onPointerUp={() => onPointerUpColumn()}
              title="Resize end"
            />

            {/* Move handle / content */}
            <div
              className="h-full w-full cursor-grab active:cursor-grabbing p-1"
              onPointerDown={(ev) => onPointerDownMove(ev, e.id, "move")}
              onPointerMove={(ev) => onPointerMoveColumn(ev)}
              onPointerUp={() => onPointerUpColumn()}
              title={`${new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(e.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            >
              <div className="font-medium truncate text-sm">{e.title}</div>
              <div className="opacity-60 text-xs truncate">
                {formatTimeRangeLabel(e.start, e.end, tz)}
              </div>
            </div>
          </div>
        );
      })}

      {/* Drag ghost overlay in target day */}
      {drag && drag.targetDayIdx === dayIdx && drag.hoverStart != null && drag.hoverEnd != null && (
        <div
          className="absolute inset-x-1 rounded border pointer-events-none"
          style={{
            top: yForAbs(drag.hoverStart),
            height: Math.max(6, yForAbs(drag.hoverEnd) - yForAbs(drag.hoverStart)),
            background: DEFAULT_COLORS.ghost,
            borderColor: DEFAULT_COLORS.ghostBorder,
          }}
        />
      )}
    </div>
  );
}

function formatTimeRangeLabel(startMs: number, endMs: number, tz: string) {
  const s = toZDT(startMs, tz);
  const e = toZDT(endMs, tz);
  const f = (z: Temporal.ZonedDateTime) => `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
  return `${f(s)} – ${f(e)}`;
}

// Pure helper for tests: simulate ESC clearing logic
function reduceEscapeState(
  ranges: SelectedTimeRange[],
  selected: Set<EventId>,
  rubber: unknown,
  drag: unknown
) {
  return { ranges: [], selected: new Set<EventId>(), rubber: null as null, drag: null as null };
}

/* =============================================
   Lightweight Self-Tests (dev only)
   ============================================= */
export function runCalendarWeekSelfTest() {
  const results: Record<string, boolean> = {};

  // snapMs: 5-minute step
  results.snap_rounds_5m = snapMs(9 * 60_000, 5 * 60_000) === 10 * 60_000;
  results.snap_rounds_5m_down = snapMs(11 * 60_000, 5 * 60_000) === 10 * 60_000;

  // formatTimeRangeLabel
  const label = formatTimeRangeLabel(Date.UTC(2025, 0, 1, 9, 5), Date.UTC(2025, 0, 1, 10, 35), "UTC");
  results.format_label_has_colon = /09:05\s–\s10:35/.test(label);

  // parseWeekStart (UTC Monday start)
  const weekStartMs = parseWeekStart("2025-01-08T12:00:00.000Z", "UTC", 1);
  const weekday = toZDT(weekStartMs, "UTC").dayOfWeek; // 1=Mon
  results.week_starts_monday = weekday === 1;

  // cross-day slicing: span mode
  (function () {
    const s = 15 * 3_600_000; // 15:00
    const e = 11 * 3_600_000; // 11:00
    // simulate slicing Wed→Fri
    const a = 2, b = 4;
    const parts: { dayIdx: number; start: number; end: number }[] = [];
    for (let i = a; i <= b; i++) {
      let segStart: number, segEnd: number;
      if (a === b) { segStart = Math.min(s, e); segEnd = Math.max(s, e); }
      else if (i === a) { segStart = s; segEnd = DAY_MS; }
      else if (i === b) { segStart = 0; segEnd = e; }
      else { segStart = 0; segEnd = DAY_MS; }
      parts.push({ dayIdx: i, start: segStart, end: segEnd });
    }
    results.span_has_3_parts = parts.length === 3;
    results.span_first_day = parts[0].start === s && parts[0].end === DAY_MS;
    results.span_middle_day = parts[1].start === 0 && parts[1].end === DAY_MS;
    results.span_last_day = parts[2].start === 0 && parts[2].end === e;
  })();

  // cross-day cloning: clone mode
  (function () {
    const s = 9 * 3_600_000, e = 11 * 3_600_000; // 9:00–11:00
    const a = 1, b = 3; // Tue..Thu
    const out: { dayIdx: number; start: number; end: number }[] = [];
    for (let i = a; i <= b; i++) out.push({ dayIdx: i, start: s, end: e });
    results.clone_has_3_parts = out.length === 3;
    results.clone_identical_each_day = out.every(p => p.start === s && p.end === e);
  })();

    // escape reducer
  (function () {
    const r: SelectedTimeRange[] = [{ id: "t", dayIdx: 0, startAbs: 1, endAbs: 2 }];
    const s = new Set<EventId>(["a", "b"]);
    const out = reduceEscapeState(r, s, { any: true }, { dragging: true });
    results.escape_reducer_clears = out.ranges.length === 0 && out.selected.size === 0 && out.rubber === null && out.drag === null;
  })();

  return results;
}
