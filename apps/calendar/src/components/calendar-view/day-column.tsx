// day-column.tsx - Day column component from working reference with original styling

import React, { useMemo, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from "framer-motion";
import { Temporal } from "@js-temporal/polyfill";
import type {
  EventId,
  Rubber,
  SelectedTimeRange,
  TimeHighlight,
  SystemSlot,
} from "./types";
import type { EventResolved } from "@/lib/data-v2";
import type { ShowTimeAs } from "@/types";
import { DAY_MS, DEFAULT_COLORS, clamp, MIN_SLOT_PX, toZDT } from "../utils";
import type { PositionedEvent } from "../utils";
import { EventCardContent } from "./event-card-content";
import { NowMoment } from "./now-moment";
import { GridContextMenu } from "./grid-context-menu";
import type { ClientCategory } from "@/lib/data-v2";
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from "@/store/app";
import type { CalendarGeometry } from '@/lib/calendar-drag';

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
  events: EventResolved[];
  positioned: PositionedEvent[];
  highlightedEventIds: Set<EventId>;
  selectedEventIds: Set<EventId>;
  setSelectedEventIds: (s: Set<EventId>) => void;
  onCommit: (next: EventResolved[]) => void;
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
  userCategories?: ClientCategory[];
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  onDeleteSelected: () => void;
  onRenameSelected: () => void;
  onCreateEvents?: (ranges: SelectedTimeRange[]) => void;
  // NEW: Preview times for drag feedback
  previewTimes?: Record<string, { start: Date; end: Date }>;
  // NEW: Drag state for snap highlighting
  dndDragState?: any;
}) {
  const {
    dayIdx,
    days,
    tz,
    dayStartMs,
    gridHeight,
    pxPerHour,
    pxPerMs: _pxPerMs, // Available for potential position/size calculations
    events,
    positioned,
    highlightedEventIds,
    selectedEventIds,
    setSelectedEventIds,
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
    previewTimes = {},
    dndDragState,
  } = props;

  const colRef = useRef<HTMLDivElement>(null);
  const justFinishedDragRef = useRef(false);

  // NEW: Make this day column a droppable zone
  const geometry: CalendarGeometry = {
    pxPerMs: _pxPerMs,
    snapStep,
    minDurMs,
    yToLocalMs,
    localMsToY,
    dayStartMs: props.dayStartMs
  };

  const { setNodeRef } = useDroppable({
    id: `day-${dayIdx}`,
    data: {
      dayIdx,
      dayStartMs: props.dayStartMs,
      geometry
    }
  });

  // Data hooks
  const { user } = useAuth();

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

    // Check if the pointer down is on an event element (let dnd-kit handle it)
    const target = e.target as HTMLElement;
    if (target.closest('[role="option"]')) {
      return; // Don't start grid selection if clicking on an event
    }

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
    <GridContextMenu
      selectedTimeRanges={props.timeRanges ?? []}
      hasActiveSelection={!!rubber && rubber.mode === "span"}
      onCreateEvent={props.onCreateEvents}
      onClearSelection={props.onClearAllSelections}
    >
      <div
        ref={(el) => {
          // @ts-ignore - We need to set the ref for calculations
          colRef.current = el;
          setNodeRef(el);
        }}
        data-day-idx={dayIdx}
        className="relative border-r border-border last:border-r-0"
        style={{ height: gridHeight, touchAction: "pan-y" }}
        onPointerDown={dndDragState ? undefined : onPointerDownEmpty}
        onPointerMove={dndDragState ? undefined : onPointerMoveEmpty}
        onPointerUp={dndDragState ? undefined : onPointerUpEmpty}
        onClick={dndDragState ? undefined : handleClick}
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

      {/* Drag snap indicator */}
      {dndDragState && previewTimes[dndDragState.eventId] && (() => {
        const preview = previewTimes[dndDragState.eventId];
        const startY = localMsToY(preview.start.getTime() - dayStartMs);
        const endY = localMsToY(preview.end.getTime() - dayStartMs);
        const height = Math.max(24, endY - startY);

        return (
          <div
            className="absolute bg-blue-400/20 rounded-lg pointer-events-none z-20 ring-2 ring-blue-400/50"
            style={{
              top: startY,
              height: height,
              left: '4px',
              right: '4px',
            }}
          />
        );
      })()}

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
        {aiForDay.map((h, index) => {
          const heightPx = Math.max(4, yForAbs(h.endAbs) - yForAbs(h.startAbs));
          const hasDescription = (h.title || h.message) && (h.title?.trim() || h.message?.trim());
          const showInlineDescription = hasDescription && heightPx >= 20; // Only show inline text if highlight is tall enough

          return (
            <motion.div
              key={`ai-${index}`}
              className="absolute inset-x-0 rounded border pointer-events-none"
              style={{
                top: yForAbs(h.startAbs),
                height: heightPx,
                background: DEFAULT_COLORS.aiTimeHighlight,
                borderColor: DEFAULT_COLORS.aiTimeHighlightBorder,
                opacity: 0.8,
              }}
              title={
                [h.emoji, h.title, h.message].filter(Boolean).join(' ') ||
                `AI highlight: ${new Date(h.startAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(h.endAbs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              }
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 0.8, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                ease: "easeOut"
              }}
            >
              {showInlineDescription && (
                <div className="absolute top-0 left-0 px-2 py-1 w-full">
                  <div
                    className="text-xs font-medium text-foreground leading-tight overflow-hidden"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      hyphens: 'auto'
                    }}
                  >
                    {h.emoji && <span className="mr-1">{h.emoji}</span>}
                    {h.title && <span className="font-semibold">{h.title}</span>}
                    {h.title && h.message && <span className="mx-1">-</span>}
                    {h.message && <span>{h.message}</span>}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
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
          const isDragging = false; // dnd-kit handles dragging state

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
                onDoubleClick={onEventDoubleClick}
                previewTimes={previewTimes[e.id]}
                selectedEventCount={selectedEventIds.size}
                selectedIsOnlineMeeting={selectedIsOnlineMeeting}
                selectedIsInPerson={selectedIsInPerson}
                userCategories={userCategories}
                onUpdateShowTimeAs={onUpdateShowTimeAs}
                onUpdateCategory={onUpdateCategory}
                onUpdateIsOnlineMeeting={onUpdateIsOnlineMeeting}
                onUpdateIsInPerson={onUpdateIsInPerson}
                onDeleteSelected={onDeleteSelected}
                onRenameSelected={props.onRenameSelected}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>


        {/* Current time indicator */}
        <NowMoment dayStartMs={dayStart00} tz={tz} localMsToY={localMsToY} />
      </div>
    </GridContextMenu>
  );
}