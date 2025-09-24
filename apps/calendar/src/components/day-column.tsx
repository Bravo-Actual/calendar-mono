"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEvent,
  EventId,
  DragState,
  Rubber,
  SelectedTimeRange,
  TimeHighlight,
  SystemSlot,
  ShowTimeAs,
} from "./types";
import { DAY_MS, DEFAULT_COLORS, clamp, MIN_SLOT_PX, toZDT } from "./utils";
import type { PositionedEvent } from "./utils";
import { EventCard } from "./event-card";
import { EventCardContent } from "./event-card-content";
import { NowMoment } from "./now-moment";
import type { UserEventCategory } from "@/hooks/use-event-categories";
import { useAppStore } from "../store/app";

export function DayColumn(props: {
  dayIdx: number;
  days: number;
  tz: string;
  timeFormat?: '12_hour' | '24_hour';
  dayStartMs: number;
  getDayStartMs: (index: number) => number;
  gridHeight: number;
  pxPerHour: number;
  pxPerMs: number; // Passed for potential child component position/size calculations
  events: CalendarEvent[];
  positioned: PositionedEvent[];
  highlightedEventIds: Set<EventId>;
  selectedEventIds: Set<EventId>;
  setSelectedEventIds: (s: Set<EventId>) => void;
  drag: DragState | null;
  setDrag: React.Dispatch<React.SetStateAction<DragState | null>>;
  onCommit: (next: CalendarEvent[]) => void;
  rubber: Rubber;
  setRubber: React.Dispatch<React.SetStateAction<Rubber>>;
  yToLocalMs: (y: number, step?: number) => number;
  localMsToY: (msInDay: number) => number;
  snapStep: number;
  dragSnapMs: number;
  minDurMs: number;
  timeRanges?: SelectedTimeRange[];
  commitRanges?: (next: SelectedTimeRange[]) => void;
  aiHighlights: TimeHighlight[];
  systemSlots: SystemSlot[];
  onClearAllSelections?: () => void;
  shouldAnimateEntry: boolean;
  onEventDoubleClick?: (eventId: EventId) => void;
  // Context menu props
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;
  userCategories?: UserEventCategory[];
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  onDeleteSelected: () => void;
}) {
  const {
    dayIdx,
    days,
    tz,
    dayStartMs,
    gridHeight,
    pxPerHour,
    _pxPerMs, // Available for potential position/size calculations
    events,
    positioned,
    highlightedEventIds,
    selectedEventIds,
    setSelectedEventIds,
    drag,
    setDrag,
    onCommit,
    rubber,
    setRubber,
    yToLocalMs,
    localMsToY,
    snapStep,
    dragSnapMs,
    minDurMs,
    aiHighlights,
    systemSlots,
    shouldAnimateEntry,
    onEventDoubleClick,
    // Context menu props
    selectedIsOnlineMeeting,
    selectedIsInPerson,
    userCategories,
    onUpdateShowTimeAs,
    onUpdateCategory,
    onUpdateIsOnlineMeeting,
    onUpdateIsInPerson,
    onDeleteSelected,
  } = props;

  const colRef = useRef<HTMLDivElement>(null);
  const justFinishedDragRef = useRef(false);

  // Get AI highlighted events from store
  const { aiHighlightedEvents } = useAppStore();

  // Grid line metrics derived from snapping
  const slotMinutes = Math.max(1, Math.round(snapStep / 60000)); // e.g., 5, 15, 30, 60
  const lineCount = Math.floor((24 * 60) / slotMinutes);
  const pxPerMinute = pxPerHour / 60;

  const dayStart00 = props.dayStartMs;

  // ------------------------
  // Rubber-band selection on empty grid
  // ------------------------
  function onPointerDownEmpty(e: React.PointerEvent) {
    // Only handle left mouse button (button 0) for time range selection
    if (e.button !== 0) return;

    if (!colRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ms = yToLocalMs(y, snapStep);

    // Mark that we're starting a potential drag operation
    justFinishedDragRef.current = false;

    setRubber({
      startDayIdx: dayIdx,
      endDayIdx: dayIdx,
      startMsInDay: ms,
      endMsInDay: ms,
      multi: e.ctrlKey || e.metaKey,
      mode: e.shiftKey && (e.ctrlKey || e.metaKey) ? "clone" : "span",
    });
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only clear selections on simple clicks to empty calendar space
    // Don't clear when clicking on event cards or other interactive elements
    const target = e.target as HTMLElement;
    const isEventCard = target.closest('[role="group"]') !== null;
    const isTimeRange = target.closest('[data-time-range="true"]') !== null;

    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !justFinishedDragRef.current && !isEventCard && !isTimeRange && props.onClearAllSelections) {
      props.onClearAllSelections();
    }
  };

  function onPointerMoveEmpty(e: React.PointerEvent) {
    if (!rubber || !colRef.current) return;
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const dayDelta = Math.floor((e.clientX - rect.left) / rect.width);
    const targetDayIdx = clamp(rubber.startDayIdx + dayDelta, 0, days - 1);
    setRubber({
      ...rubber,
      endDayIdx: targetDayIdx,
      endMsInDay: yToLocalMs(y, snapStep),
    });
  }

  function onPointerUpEmpty() {
    if (!rubber) return;

    const a = Math.min(rubber.startDayIdx, rubber.endDayIdx);
    const b = Math.max(rubber.startDayIdx, rubber.endDayIdx);
    const newRanges: SelectedTimeRange[] = [];

    if (rubber.mode === "span") {
      // One continuous block sliced by day boundaries
      for (let i = a; i <= b; i++) {
        const base = props.getDayStartMs(i);
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
            startAbs: base + segStart,
            endAbs: base + segEnd,
          });
        }
      }
    } else {
      // Clone mode: same start/end on each day
      const s = Math.min(rubber.startMsInDay, rubber.endMsInDay);
      const eMs = Math.max(rubber.startMsInDay, rubber.endMsInDay);
      if (eMs - s >= snapStep) {
        for (let i = a; i <= b; i++) {
          const base = props.getDayStartMs(i);
          newRanges.push({
            id: `rng_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            startAbs: base + s,
            endAbs: base + eMs,
          });
        }
      }
    }

    const hasRanges = newRanges.length > 0;

    setRubber(null);

    // If we created ranges, mark that we just finished a drag to prevent click handler
    if (hasRanges) {
      justFinishedDragRef.current = true;
      // Clear the flag after a brief delay to allow click event to fire
      setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 0);
    }

    if (!hasRanges) return;

    const existing = (props.timeRanges ?? []).slice();
    const next = rubber.multi ? [...existing, ...newRanges] : newRanges;

    // If not using Ctrl (multi), clear event selections when creating time ranges
    if (!rubber.multi && selectedEventIds.size > 0) {
      props.setSelectedEventIds(new Set());
    }

    props.commitRanges?.(next);
  }

  // ------------------------
  // Card selection + drag/resize
  // ------------------------
  function toggleSelect(id: EventId, multi: boolean) {
    const next = new Set(selectedEventIds);
    if (multi) {
      // Ctrl+click: Keep existing selections and toggle this event
      next.has(id) ? next.delete(id) : next.add(id);
    } else {
      // Regular click: Clear all selections and select only this event
      next.clear();
      next.add(id);
      // Also clear time range selections when not using Ctrl
      if (props.commitRanges) {
        props.commitRanges([]);
      }
    }
    props.setSelectedEventIds(next);
  }

  function onPointerDownMove(
    e: React.PointerEvent,
    id: EventId,
    kind: "move" | "resize-start" | "resize-end"
  ) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // Check if Ctrl+Shift is pressed for copy mode
    const isCopyMode = e.ctrlKey && e.shiftKey;

    const evt = events.find((x) => x.id === id)!;
    setDrag({
      kind,
      id,
      origStart: evt.start_time_ms,
      origEnd: evt.end_time_ms,
      startX: e.clientX,
      startY: e.clientY,
      startDayIdx: dayIdx,
      isCopyMode,
    });
  }

  function onPointerMoveColumn(e: React.PointerEvent) {
    if (!drag || !colRef.current) return;

    // Check if we've moved far enough to start dragging (5px dead zone)
    const deltaX = Math.abs(e.clientX - drag.startX);
    const deltaY = Math.abs(e.clientY - drag.startY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (!drag.isDragging && distance < 5) {
      return; // Stay in dead zone, don't start dragging yet
    }

    // Mark as actively dragging once we exceed the threshold
    if (!drag.isDragging) {
      setDrag({ ...drag, isDragging: true });
    }

    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;

    // Cross-day movement based on column widths
    const dayDelta = Math.floor((e.clientX - rect.left) / rect.width);
    const targetDayIdx = clamp(drag.startDayIdx + dayDelta, 0, days - 1);

    const targetDayStart00 = props.getDayStartMs(targetDayIdx);

    const localMs = yToLocalMs(y, dragSnapMs);

    if (drag.kind === "move") {
      const dur = drag.origEnd - drag.origStart;
      let nextStart = targetDayStart00 + localMs - Math.floor(dur / 2);
      let nextEnd = nextStart + dur;
      nextStart = Math.max(targetDayStart00, nextStart);
      nextEnd = Math.min(targetDayStart00 + DAY_MS, nextEnd);
      setDrag({ ...drag, targetDayIdx, hoverStart: nextStart, hoverEnd: nextEnd, isDragging: true });
    } else {
      const isStart = drag.kind === "resize-start";
      const fixed = isStart ? drag.origEnd : drag.origStart;
      let moving = targetDayStart00 + localMs;
      if (isStart) moving = Math.min(moving, fixed - minDurMs);
      else moving = Math.max(moving, fixed + minDurMs);
      moving = clamp(moving, targetDayStart00, targetDayStart00 + DAY_MS);
      const hoverStart = isStart ? moving : fixed;
      const hoverEnd = isStart ? fixed : moving;
      setDrag({ ...drag, targetDayIdx, hoverStart, hoverEnd, isDragging: true });
    }
  }

  function onPointerUpColumn() {
    if (!drag) return;
    const evtIdx = events.findIndex((x) => x.id === drag.id);
    if (evtIdx === -1) { setDrag(null); return; }
    const evt = events[evtIdx];

    const nextStart = drag.hoverStart ?? evt.start_time_ms;
    const nextEnd = drag.hoverEnd ?? evt.end_time_ms;

    if (nextStart !== evt.start_time_ms || nextEnd !== evt.end_time_ms) {

      if (drag.isCopyMode) {
        // Create a copy of the event at the new position
        const copiedEvent = {
          ...evt,
          id: `copy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          start_time_ms: nextStart,
          end_time_ms: nextEnd,
          start_time: new Date(nextStart).toISOString(),
          duration: Math.round((nextEnd - nextStart) / (1000 * 60)), // Convert ms to minutes
          updated_at: new Date().toISOString(),
        };
        const next = [...events, copiedEvent];
        onCommit(next);
      } else {
        // Move the original event
        const updated = {
          ...evt,
          start_time_ms: nextStart,
          end_time_ms: nextEnd,
          start_time: new Date(nextStart).toISOString(),
          duration: Math.round((nextEnd - nextStart) / (1000 * 60)), // Convert ms to minutes
          updated_at: new Date().toISOString(),
        };
        const next = events.slice(); next[evtIdx] = updated;
        onCommit(next);
      }
    }
    setDrag(null);
  }

  // Decorations / overlays
  const dayEnd24 = dayStart00 + DAY_MS;

  // AI highlights: filter for current day using absolute timestamps
  const aiForDay = (aiHighlights ?? [])
    .filter((h: TimeHighlight) => {
      return h.endAbs > dayStart00 && h.startAbs < dayEnd24;
    });

  // Time ranges: filter by time overlap
  const rangesForDay = (props.timeRanges ?? [])
    .filter(r => r.endAbs > dayStart00 && r.startAbs < dayEnd24);
  const sysForDay = systemSlots ?? [];
  const yForAbs = (absMs: number) => localMsToY(absMs - dayStart00);

  const rubberSegment = (() => {
    if (!rubber) return null;
    const a = Math.min(rubber.startDayIdx, rubber.endDayIdx);
    const b = Math.max(rubber.startDayIdx, rubber.endDayIdx);
    if (dayIdx < a || dayIdx > b) return null;
    if (rubber.mode === "span") {
      if (a === b) return {
        start: Math.min(rubber.startMsInDay, rubber.endMsInDay),
        end: Math.max(rubber.startMsInDay, rubber.endMsInDay),
      };
      if (dayIdx === a) return { start: rubber.startMsInDay, end: DAY_MS };
      if (dayIdx === b) return { start: 0, end: rubber.endMsInDay };
      return { start: 0, end: DAY_MS };
    }
    // clone mode
    return {
      start: Math.min(rubber.startMsInDay, rubber.endMsInDay),
      end: Math.max(rubber.startMsInDay, rubber.endMsInDay),
    };
  })();

  function formatTimeRangeLabel(startMs: number, endMs: number, tz: string) {
    const s = toZDT(startMs, tz);
    const e = toZDT(endMs, tz);
    const f = (z: Temporal.ZonedDateTime) =>
      `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
    return `${f(s)} – ${f(e)}`;
  }

  return (
    <div
      ref={colRef}
      className="relative border-r border-border last:border-r-0"
      style={{ height: gridHeight, touchAction: "pan-y" }}
      onPointerDown={onPointerDownEmpty}
      onPointerMove={(e) => { onPointerMoveEmpty(e); onPointerMoveColumn(e); }}
      onPointerUp={() => { onPointerUpEmpty(); onPointerUpColumn(); }}
      onClick={handleClick}
    >
      {/* Grid lines layer (real HTML, not background) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {Array.from({ length: lineCount + 1 }).map((_, i) => {
          const minutesFromMidnight = i * slotMinutes;
          const isHour = minutesFromMidnight % 60 === 0;
          return (
            <div
              key={i}
              className={`absolute inset-x-0 border-t ${isHour ? "opacity-70" : "opacity-30"} border-border`}
              style={{ top: i * slotMinutes * pxPerMinute }}
            />
          );
        })}
      </div>


      {/* System suggestion slots */}
      <AnimatePresence>
        {sysForDay.map((s) => (
          <motion.div
            key={s.id}
            className="absolute inset-x-0 rounded border"
            style={{
              top: yForAbs(s.startAbs),
              height: Math.max(6, yForAbs(s.endAbs) - yForAbs(s.startAbs)),
              background: DEFAULT_COLORS.system,
              borderColor: DEFAULT_COLORS.systemBorder,
              pointerEvents: "none",
            }}
            title={s.reason || "Suggested slot"}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.2,
              ease: "easeOut"
            }}
          />
        ))}
      </AnimatePresence>

      {/* AI time highlights (yellow, behind user selections) */}
      <AnimatePresence>
        {aiForDay.map((h, index) => (
          <motion.div
            key={`ai-${index}`}
            className="absolute inset-x-0 rounded border pointer-events-none"
            style={{
              top: yForAbs(h.startAbs),
              height: Math.max(4, yForAbs(h.endAbs) - yForAbs(h.startAbs)),
              background: DEFAULT_COLORS.aiTimeHighlight,
              borderColor: DEFAULT_COLORS.aiTimeHighlightBorder,
              opacity: 0.8,
            }}
            title={
              h.intent ||
              `AI highlight: ${new Date(h.startAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(h.endAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            }
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 0.8, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.2,
              ease: "easeOut"
            }}
          />
        ))}
      </AnimatePresence>

      {/* Rubber-band selection (in-progress) */}
      {rubberSegment && (
        <div
          className="absolute inset-x-0 rounded border"
          style={{
            top: Math.min(localMsToY(rubberSegment.start), localMsToY(rubberSegment.end)),
            height: Math.abs(localMsToY(rubberSegment.end) - localMsToY(rubberSegment.start)),
            background: DEFAULT_COLORS.selection,
            borderColor: DEFAULT_COLORS.selectionBorder,
          }}
        />
      )}

      {/* Persistent selected ranges */}
      <AnimatePresence>
        {rangesForDay.map((r) => (
          <motion.div
            key={r.id}
            className="absolute inset-x-0 rounded border cursor-pointer hover:opacity-80"
            style={{
              top: yForAbs(r.startAbs),
              height: Math.max(4, yForAbs(r.endAbs) - yForAbs(r.startAbs)),
              background: DEFAULT_COLORS.selection,
              borderColor: DEFAULT_COLORS.selectionBorder,
              opacity: 0.6,
            }}
            onPointerDown={(e) => {
              // Prevent rubber band selection from starting when clicking on time ranges
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                // Ctrl+click: Remove this specific time range
                const remainingRanges = (props.timeRanges ?? []).filter(range => range.id !== r.id);
                props.commitRanges?.(remainingRanges);
              }
              // Regular click: Could potentially select just this range, but for now do nothing
            }}
            data-time-range="true"
            title={
              new Date(r.startAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
              " – " +
              new Date(r.endAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              mass: 0.8
            }}
          />
        ))}
      </AnimatePresence>

      {/* Event cards */}
      <AnimatePresence>
        {positioned.map((p, index) => {
          const e = events.find((x) => x.id === p.id)!;
          const selected = selectedEventIds.has(e.id);
          const highlighted = highlightedEventIds.has(e.id);
          const isDragging = drag?.id === e.id;

          // Create unique key based on event ID and date range for proper exit animations
          const dateKey = `${Math.floor(dayStartMs / DAY_MS)}`;
          const uniqueKey = `${e.id}-${dateKey}`;

          return (
            <motion.div
              key={uniqueKey}
              className="absolute"
              initial={!shouldAnimateEntry ? false : { scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{
                scale: 0.97,
                opacity: 0,
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  mass: 0.5
                }
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                mass: 0.6,
                delay: !shouldAnimateEntry ? 0 : index * 0.02 // Only stagger animation for entries that should animate
              }}
              style={{
                top: p.rect.top,
                height: Math.max(MIN_SLOT_PX, p.rect.height),
                left: `calc(${p.rect.leftPct}% + 4px)`,
                width: `calc(${p.rect.widthPct}% - 4px)`,
              }}
            >
              <EventCardContent
                event={e}
                selected={selected}
                highlighted={highlighted}
                isAiHighlighted={aiHighlightedEvents.has(e.id)}
                isDragging={isDragging}
                tz={tz}
                timeFormat={props.timeFormat}
                onSelect={toggleSelect}
                onPointerDownMove={onPointerDownMove}
                onPointerMoveColumn={onPointerMoveColumn}
                onPointerUpColumn={onPointerUpColumn}
                onDoubleClick={onEventDoubleClick}
                selectedEventCount={selectedEventIds.size}
                selectedIsOnlineMeeting={selectedIsOnlineMeeting}
                selectedIsInPerson={selectedIsInPerson}
                userCategories={userCategories}
                onUpdateShowTimeAs={onUpdateShowTimeAs}
                onUpdateCategory={onUpdateCategory}
                onUpdateIsOnlineMeeting={onUpdateIsOnlineMeeting}
                onUpdateIsInPerson={onUpdateIsInPerson}
                onDeleteSelected={onDeleteSelected}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Drag ghost overlay in target day */}
      {drag && drag.isDragging && drag.targetDayIdx === dayIdx && drag.hoverStart != null && drag.hoverEnd != null && (() => {
        const draggedEvent = events.find(e => e.id === drag.id);
        if (!draggedEvent) return null;
        return (
          <div
            className="absolute rounded border pointer-events-none opacity-75"
            style={{
              top: yForAbs(drag.hoverStart),
              height: Math.max(6, yForAbs(drag.hoverEnd) - yForAbs(drag.hoverStart)),
              left: "4px",
              width: "calc(94% - 4px)",
              background: DEFAULT_COLORS.eventBg,
              borderColor: DEFAULT_COLORS.eventBorder,
            }}
          >
            <div className="h-full w-full px-1 pt-1 pb-1 flex flex-col justify-start items-start overflow-hidden">
              <div className="font-medium truncate text-sm leading-none w-full text-left text-card-foreground">
                {draggedEvent.title}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Current time indicator */}
      <NowMoment dayStartMs={dayStart00} tz={tz} localMsToY={localMsToY} />
    </div>
  );
}