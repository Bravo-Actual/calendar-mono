'use client';

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
import { computePlacements, minutes, minuteToY, toDate } from './utils';

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
}: DayColumnProps<T, R>) {
  const { setNodeRef } = useDroppable({
    id,
    data: { dayStart, geometry },
  });

  // Manual double-click detection to avoid interfering with single clicks
  const lastClickTime = React.useRef<number>(0);
  const lastClickSlot = React.useRef<string>('');

  // Compute placements for this single day's items
  const placements = useMemo(() => computePlacements(items), [items]);

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

            const startTime = new Date(dayStart);
            startTime.setHours(0, startMinutes, 0, 0);
            const endTime = new Date(dayStart);
            endTime.setHours(0, endMinutes, 0, 0);

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
          const top = minuteToY(minutes(s), geometry);
          const height = Math.max(6, minuteToY(minutes(e), geometry) - top);

          console.log('[DayColumn] Rendering range item:', {
            id: rangeItem.id,
            isSystemSlot: 'startAbs' in rangeItem,
            start: s.toISOString(),
            end: e.toISOString(),
            top,
            height,
          });

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
          const top = minuteToY(minutes(s), geometry);
          const height = Math.max(24, minuteToY(minutes(e), geometry) - top);
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
            />
          );
        })}
      </AnimatePresence>

      {/* Ghost previews during drag */}
      {ghosts?.map((g) => {
        const top = minuteToY(minutes(g.start), geometry);
        const height = Math.max(24, minuteToY(minutes(g.end), geometry) - top);

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
        const top = minuteToY(minutes(r.start), geometry);
        const height = Math.max(6, minuteToY(minutes(r.end), geometry) - top);
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
        const top = minuteToY(minutes(r.start), geometry);
        const height = Math.max(6, minuteToY(minutes(r.end), geometry) - top);
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
        <CurrentTimeIndicator geometry={geometry} />
      )}
    </div>
  );
}

function CurrentTimeIndicator({ geometry }: { geometry: GeometryConfig }) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
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
