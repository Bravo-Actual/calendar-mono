'use client';

import { Temporal } from '@js-temporal/polyfill';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ItemHost } from './ItemHost';
import { RangeHost } from './RangeHost';
import type {
  GeometryConfig,
  ItemLayout,
  RangeLayout,
  RenderItem,
  RenderRange,
  TimeItem,
} from './types';
import { computePlacements, minutes, minutesInTimezone, minuteToY, toDate, startOfDayInTimezone } from './utils';

interface DayColumnProps<T extends TimeItem, R extends TimeItem = TimeItem> {
  id: string;
  dayStart: Date;
  dayIndex: number;
  items: T[];
  selection: Set<string>;
  onSelectMouseDown: (e: React.MouseEvent, id: string) => void;
  setColumnRef?: (el: HTMLDivElement | null) => void;
  ghosts?: Array<{ id: string; title: string; start: Date; end: Date; selected?: boolean }>;
  highlights?: Array<{ start: Date; end: Date }>;
  rubber?: Array<{ start: Date; end: Date }>;
  onHighlightMouseDown?: (
    dayIndex: number,
    r: { start: Date; end: Date },
    e: React.MouseEvent
  ) => void;
  renderItem?: RenderItem<T>;
  rangeItems?: R[];
  renderRange?: RenderRange<R>;
  onRangeMouseDown?: (e: React.MouseEvent, id: string) => void;
  eventHighlights?: Map<
    string,
    { id: string; emoji_icon?: string | null; title?: string | null; message?: string | null }
  >;
  geometry: GeometryConfig;
  resizingItems?: Set<string>;
  className?: string;
  renderSelection?: (
    selection: { start: Date; end: Date },
    element: React.ReactNode
  ) => React.ReactNode;
  onTimeSlotHover?: (dayIndex: number, timeRange: { start: Date; end: Date } | null) => void;
  onTimeSlotDoubleClick?: (
    dayIndex: number,
    timeRange: { start: Date; end: Date },
    e: React.MouseEvent
  ) => void;
  isDragging?: boolean;
  workPeriods?: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
  }>;
  timeZone?: string;
  collaboratorFreeBusy?: Array<{
    user_id: string;
    start_time: string;
    end_time: string;
    show_time_as: string;
    avatar_url?: string | null;
    display_name?: string | null;
  }>;
  showCollaboratorOverlay?: boolean;
}

export function DayColumn<T extends TimeItem, R extends TimeItem = TimeItem>({
  id,
  dayStart,
  dayIndex,
  items,
  selection,
  onSelectMouseDown,
  setColumnRef,
  ghosts,
  highlights,
  rubber,
  onHighlightMouseDown,
  renderItem,
  rangeItems,
  renderRange,
  onRangeMouseDown,
  eventHighlights,
  geometry,
  resizingItems = new Set(),
  className,
  renderSelection,
  onTimeSlotHover,
  onTimeSlotDoubleClick,
  isDragging = false,
  workPeriods,
  timeZone,
  collaboratorFreeBusy,
  showCollaboratorOverlay = false,
}: DayColumnProps<T, R>) {
  const { setNodeRef } = useDroppable({
    id,
    data: { dayStart, geometry },
  });

  // Manual double-click detection to avoid interfering with single clicks
  const lastClickTime = React.useRef<number>(0);
  const lastClickSlot = React.useRef<string>('');

  // Compute placements for this single day's items
  const placements = useMemo(() => computePlacements(items, timeZone), [items, timeZone]);

  // Grid lines configuration
  const totalHeight = minuteToY(24 * 60, geometry);
  const lineCount = Math.floor((24 * 60) / geometry.gridMinutes);

  // Calculate non-work hour ranges for shading
  const nonWorkRanges = useMemo(() => {
    if (!workPeriods || workPeriods.length === 0) return [];

    // Convert work periods to minute ranges
    const workRanges = workPeriods
      .map((period) => {
        const [startHour, startMin] = period.start_time.split(':').map(Number);
        const [endHour, endMin] = period.end_time.split(':').map(Number);
        return {
          start: startHour * 60 + startMin,
          end: endHour * 60 + endMin,
        };
      })
      .sort((a, b) => a.start - b.start);

    // Find gaps (non-work ranges)
    const gaps: Array<{ start: number; end: number }> = [];
    let currentMinute = 0;

    for (const range of workRanges) {
      if (range.start > currentMinute) {
        gaps.push({ start: currentMinute, end: range.start });
      }
      currentMinute = Math.max(currentMinute, range.end);
    }

    // Add final gap if work doesn't extend to midnight
    if (currentMinute < 24 * 60) {
      gaps.push({ start: currentMinute, end: 24 * 60 });
    }

    return gaps;
  }, [workPeriods]);

  // Calculate which collaborators are free in each 30-minute slot
  const collaboratorSlots = useMemo(() => {
    if (!collaboratorFreeBusy || !showCollaboratorOverlay) return new Map();

    const slots = new Map<number, Array<{ user_id: string; avatar_url?: string | null; display_name?: string | null }>>();
    const slotCount = Math.floor((24 * 60) / geometry.gridMinutes);

    // For each 30-minute slot in the day
    for (let i = 0; i < slotCount; i++) {
      const slotStartMinutes = i * geometry.gridMinutes;
      const slotEndMinutes = slotStartMinutes + geometry.gridMinutes;

      // Create timezone-aware slot times
      let slotStart: Date;
      let slotEnd: Date;

      if (timeZone) {
        const dayStartInTz = startOfDayInTimezone(dayStart, timeZone);
        const instant = Temporal.Instant.fromEpochMilliseconds(dayStartInTz.getTime());
        const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
        const startZoned = zonedDateTime.add({ minutes: slotStartMinutes });
        const endZoned = zonedDateTime.add({ minutes: slotEndMinutes });
        slotStart = new Date(startZoned.epochMilliseconds);
        slotEnd = new Date(endZoned.epochMilliseconds);
      } else {
        slotStart = new Date(dayStart);
        slotStart.setHours(0, slotStartMinutes, 0, 0);
        slotEnd = new Date(dayStart);
        slotEnd.setHours(0, slotEndMinutes, 0, 0);
      }

      // Check if user has any events overlapping this slot
      const userHasEventInSlot = items.some((item) => {
        const itemStart = toDate(item.start_time);
        const itemEnd = toDate(item.end_time);
        // Item overlaps with slot if it starts before slot ends AND ends after slot starts
        return itemStart < slotEnd && itemEnd > slotStart;
      });

      // Skip this slot if user has events
      if (userHasEventInSlot) {
        continue;
      }

      const freeCollaborators: Array<{ user_id: string; avatar_url?: string | null; display_name?: string | null }> = [];

      // Group collaborator free blocks by user
      const collaboratorsByUser = new Map<string, typeof collaboratorFreeBusy>();
      collaboratorFreeBusy.forEach((block) => {
        if (!collaboratorsByUser.has(block.user_id)) {
          collaboratorsByUser.set(block.user_id, []);
        }
        collaboratorsByUser.get(block.user_id)?.push(block);
      });

      // For each collaborator, check if they have a free block overlapping this slot
      collaboratorsByUser.forEach((blocks, userId) => {
        const hasFreeBlockInSlot = blocks.some((block) => {
          const blockStart = new Date(block.start_time);
          const blockEnd = new Date(block.end_time);
          // Block overlaps with slot if it starts before slot ends AND ends after slot starts
          return blockStart < slotEnd && blockEnd > slotStart;
        });

        if (hasFreeBlockInSlot) {
          // User is free in this slot
          freeCollaborators.push({
            user_id: userId,
            avatar_url: blocks[0].avatar_url,
            display_name: blocks[0].display_name,
          });
        }
      });

      if (freeCollaborators.length > 0) {
        slots.set(i, freeCollaborators);
      }
    }

    return slots;
  }, [collaboratorFreeBusy, showCollaboratorOverlay, geometry.gridMinutes, dayStart, timeZone, items]);

  const mergedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    setColumnRef?.(el);
  };

  return (
    <div
      ref={mergedRef}
      className={cn('relative bg-background', className)}
      style={{ height: totalHeight }}
    >
      {/* Grid lines layer */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {Array.from({ length: lineCount + 1 }).map((_, i) => {
          const minutesFromMidnight = i * geometry.gridMinutes;
          const isHour = minutesFromMidnight % 60 === 0;
          return (
            <div
              key={i}
              className={cn(
                'absolute inset-x-0 border-t',
                isHour ? 'border-border/80' : 'border-border/40'
              )}
              style={{ top: minuteToY(i * geometry.gridMinutes, geometry) }}
            />
          );
        })}
      </div>

      {/* Non-work hours shading layer */}
      {nonWorkRanges.length > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {nonWorkRanges.map((range, index) => {
            const top = minuteToY(range.start, geometry);
            const height = minuteToY(range.end, geometry) - top;
            return (
              <div
                key={`non-work-${index}`}
                className="absolute inset-x-0 bg-neutral-500/25 dark:bg-white/[0.015]"
                style={{ top, height }}
              />
            );
          })}
        </div>
      )}

      {/* Time slot hover areas - disabled when dragging or when highlights exist */}
      {onTimeSlotHover && !isDragging && (!highlights || highlights.length === 0) && (
        <div className="absolute inset-0 z-0">
          {Array.from({ length: lineCount }).map((_, i) => {
            const startMinutes = i * geometry.gridMinutes;
            const endMinutes = startMinutes + geometry.gridMinutes;
            const top = minuteToY(startMinutes, geometry);
            const height = minuteToY(endMinutes, geometry) - top;

            // Create timezone-aware dates
            let startTime: Date;
            let endTime: Date;

            if (timeZone) {
              const dayStartInTz = startOfDayInTimezone(dayStart, timeZone);
              const instant = Temporal.Instant.fromEpochMilliseconds(dayStartInTz.getTime());
              const zonedDateTime = instant.toZonedDateTimeISO(timeZone);

              const startZoned = zonedDateTime.add({ minutes: startMinutes });
              const endZoned = zonedDateTime.add({ minutes: endMinutes });

              startTime = new Date(startZoned.epochMilliseconds);
              endTime = new Date(endZoned.epochMilliseconds);
            } else {
              startTime = new Date(dayStart);
              startTime.setHours(0, startMinutes, 0, 0);
              endTime = new Date(dayStart);
              endTime.setHours(0, endMinutes, 0, 0);
            }

            const timeRange = { start: startTime, end: endTime };

            return (
              <div
                key={`time-slot-${i}`}
                className="absolute inset-x-0 hover:bg-primary/30 transition-colors time-slot-area"
                style={{ top, height }}
                onMouseEnter={() => onTimeSlotHover(dayIndex, timeRange)}
                onMouseLeave={() => onTimeSlotHover(dayIndex, null)}
                onPointerDown={(e) => {
                  // Only interfere with right-click events, let left-click through for lasso
                  if (e.button === 2) {
                    e.stopPropagation();
                  }
                }}
                onMouseDown={(e) => {
                  // Only interfere with right-click events, let left-click through for lasso
                  if (e.button === 2) {
                    e.stopPropagation();
                  }
                }}
                onClick={(e) => {
                  // Handle single click timing manually for double-click detection
                  const now = Date.now();
                  const slotKey = `${dayIndex}-${i}`;

                  if (now - lastClickTime.current < 300 && lastClickSlot.current === slotKey) {
                    // This is a double-click
                    e.stopPropagation();
                    e.preventDefault();
                    onTimeSlotDoubleClick?.(dayIndex, timeRange, e);
                  }

                  lastClickTime.current = now;
                  lastClickSlot.current = slotKey;
                }}
              />
            );
          })}
        </div>
      )}

      {/* Collaborator free/busy overlay - shows avatars of free collaborators */}
      <AnimatePresence>
        {showCollaboratorOverlay && collaboratorSlots.size > 0 && (
          <div className="absolute inset-0 z-[5] pointer-events-none" aria-hidden>
            {Array.from(collaboratorSlots.entries()).map(([slotIndex, freeCollaborators]) => {
              const startMinutes = slotIndex * geometry.gridMinutes;
              const endMinutes = startMinutes + geometry.gridMinutes;
              const top = minuteToY(startMinutes, geometry);
              const height = minuteToY(endMinutes, geometry) - top;

              // Match event card positioning exactly
              const usableWidth = 92;
              const cardTop = top + 3;
              const cardHeight = Math.max(20, height - 6);
              const cardLeft = `calc(0% + 6px)`;
              const cardWidth = `calc(${usableWidth}% - 6px)`;

              return (
                <div
                  key={`collab-slot-${slotIndex}`}
                  className="absolute transition-opacity duration-300"
                  style={{
                    top: cardTop,
                    height: cardHeight,
                    left: cardLeft,
                    width: cardWidth,
                  }}
                >
                  <div className="h-full flex items-center justify-start gap-1 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-md shadow-sm animate-in fade-in duration-300">
                    {freeCollaborators.slice(0, 3).map((collab: { user_id: string; avatar_url?: string | null; display_name?: string | null }) => {
                      const initials = collab.display_name
                        ? collab.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                        : '?';

                      return (
                        <div
                          key={collab.user_id}
                          className="size-6 rounded-full bg-green-500/90 border-2 border-background flex items-center justify-center text-[10px] font-semibold text-white shadow-sm"
                          title={collab.display_name || 'Collaborator'}
                        >
                          {collab.avatar_url ? (
                            <img
                              src={collab.avatar_url}
                              alt={collab.display_name || ''}
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                      );
                    })}
                    {freeCollaborators.length > 3 && (
                      <div className="size-6 rounded-full bg-green-600/90 border-2 border-background flex items-center justify-center text-[10px] font-semibold text-white shadow-sm">
                        +{freeCollaborators.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Range items (AI highlights, etc.) - rendered behind events */}
      <AnimatePresence mode="popLayout">
        {rangeItems?.map((rangeItem) => {
          // Handle both SystemSlot format (startAbs/endAbs) and TimeItem format (start_time/end_time)
          const s =
            'startAbs' in rangeItem
              ? new Date(rangeItem.startAbs)
              : toDate(rangeItem.start_time);
          const e =
            'endAbs' in rangeItem ? new Date(rangeItem.endAbs) : toDate(rangeItem.end_time);
          const minutesFn = timeZone ? (d: Date) => minutesInTimezone(d, timeZone) : minutes;
          const top = minuteToY(minutesFn(s), geometry);
          const height = Math.max(6, minuteToY(minutesFn(e), geometry) - top);

          const layout: RangeLayout = {
            top,
            height,
          };

          return (
            <RangeHost
              key={rangeItem.id}
              item={rangeItem}
              layout={layout}
              onMouseDown={onRangeMouseDown}
              renderRange={renderRange}
            />
          );
        })}
      </AnimatePresence>

      {/* Real items */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => {
          const s = toDate(item.start_time);
          const e = toDate(item.end_time);
          const minutesFn = timeZone ? (d: Date) => minutesInTimezone(d, timeZone) : minutes;
          const top = minuteToY(minutesFn(s), geometry);
          const height = Math.max(24, minuteToY(minutesFn(e), geometry) - top);
          const plc = placements[item.id] || { lane: 0, lanes: 1 };
          // Reserve 8% of total width on right for time selection
          const usableWidth = 92;
          const leftPct = (plc.lane / plc.lanes) * usableWidth;
          const widthPct = (1 / plc.lanes) * usableWidth; // Full lane width, no gap

          const layout: ItemLayout = {
            top,
            height,
            leftPct,
            widthPct,
          };

          return (
            <ItemHost
              key={item.id}
              item={item}
              layout={layout}
              selected={selection.has(item.id)}
              onMouseDownSelect={onSelectMouseDown}
              renderItem={renderItem}
              highlight={eventHighlights?.get(item.id)}
              itemIndex={index}
              timeZone={timeZone}
            />
          );
        })}
      </AnimatePresence>

      {/* Ghost previews during drag */}
      {ghosts?.map((g) => {
        const minutesFn = timeZone ? (d: Date) => minutesInTimezone(d, timeZone) : minutes;
        const top = minuteToY(minutesFn(g.start), geometry);
        const height = Math.max(24, minuteToY(minutesFn(g.end), geometry) - top);

        return (
          <div
            key={`ghost-${g.id}`}
            className={cn(
              'absolute mx-1 rounded-md pointer-events-none z-30 bg-primary/10',
              g.selected && 'ring-2 ring-primary/50'
            )}
            style={{ top, height, left: 0, right: 0 }}
          />
        );
      })}

      {/* Live lasso preview (snapped), per-day */}
      {rubber?.map((r, idx) => {
        const minutesFn = timeZone ? (d: Date) => minutesInTimezone(d, timeZone) : minutes;
        const top = minuteToY(minutesFn(r.start), geometry);
        const height = Math.max(6, minuteToY(minutesFn(r.end), geometry) - top);
        return (
          <div
            key={`rubber-${idx}`}
            className="absolute left-0 right-0 bg-primary/20 border-y-2 border-primary z-10"
            style={{ top, height }}
          />
        );
      })}

      {/* Persisted range highlights */}
      {highlights?.map((r, idx) => {
        const minutesFn = timeZone ? (d: Date) => minutesInTimezone(d, timeZone) : minutes;
        const top = minuteToY(minutesFn(r.start), geometry);
        const height = Math.max(6, minuteToY(minutesFn(r.end), geometry) - top);
        const highlightElement = (
          <div
            key={`highlight-${idx}`}
            className="absolute left-0 right-0 bg-primary/10 border-y-2 border-primary hover:bg-primary/20 transition-colors z-10"
            style={{ top, height }}
            onMouseDown={(e) => onHighlightMouseDown?.(dayIndex, r, e)}
          />
        );

        return renderSelection ? renderSelection(r, highlightElement) : highlightElement;
      })}

      {/* Current time indicator (if today) */}
      {dayStart.toDateString() === new Date().toDateString() && (
        <CurrentTimeIndicator geometry={geometry} timeZone={timeZone} />
      )}
    </div>
  );
}

function CurrentTimeIndicator({ geometry, timeZone }: { geometry: GeometryConfig; timeZone?: string }) {
  const now = new Date();
  const currentMinutes = timeZone ? minutesInTimezone(now, timeZone) : now.getHours() * 60 + now.getMinutes();
  const y = minuteToY(currentMinutes, geometry);

  return (
    <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: y }}>
      <div className="relative">
        <div className="absolute w-3 h-3 -translate-x-1.5 -translate-y-1.5 bg-ring rounded-full border-2 border-background" />
        <div className="h-0.5 bg-ring" />
      </div>
    </div>
  );
}
