// calendar-grid.tsx - Generic calendar grid component
// Based on reference lines 233-677

"use client";

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DndContext, DragOverlay, DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core';

// Generic types and utilities
import type { TimeItem, ItemKind } from './time-item-types';
import { getTitle } from './time-item-types';
import type { RenderItem } from './item-host';

// Calendar utilities
import { useCalendarSensors } from './sensors';
import { useDragState } from './drag-state';
import { useSelection } from './use-selection';
import { useRubberSelection } from './use-rubber-selection';
import { TimeGutter } from './time-gutter';
import { computeEventPlacements } from './collision-detection';
import { ItemHost } from './item-host';
import { startOfDay, addDays, getMinutesFromMidnight, minuteToY } from './geometry';

export interface CalendarGridProps {
  items: TimeItem[];
  onItemUpdate?: (itemId: string, updates: { start_time?: Date; end_time?: Date }) => void;
  onItemDelete?: (itemId: string) => void;
  renderItem?: RenderItem;
  tz?: string;
  timeFormat?: '12_hour' | '24_hour';
  className?: string;
  initialDays?: Date[];
}

export function CalendarGrid({
  items,
  onItemUpdate,
  onItemDelete,
  renderItem,
  tz = 'UTC',
  timeFormat = '12_hour',
  className = "",
  initialDays
}: CalendarGridProps) {
  // Sensors configuration from reference
  const sensors = useCalendarSensors();

  // Day range state (reference lines 246-247)
  const [days, setDays] = useState<Date[]>(() => {
    if (initialDays) return initialDays;
    const anchor = startOfDay(new Date());
    const len = 7;
    return Array.from({ length: len }).map((_, i) => addDays(anchor, i));
  });

  // Expanded day UX (reference lines 257-263)
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const columnPercents = useMemo(() => {
    const n = days.length;
    if (n === 0) return [] as number[];
    const weights = Array.from({ length: n }, (_, i) =>
      expandedDay === null ? 1 : (i === expandedDay ? 4 : 0.8)
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => (w / sum) * 100);
  }, [days, expandedDay]);

  // Selection state
  const { selection, onSelectMouseDown, clearSelection, selectAll, isSelected } = useSelection();

  // Time range selection state
  const [selectedTimeRanges, setSelectedTimeRanges] = useState<Array<{ id: string; start: Date; end: Date; dayIdx: number }>>([]);

  // Drag state
  const [overlayItem, setOverlayItem] = useState<TimeItem | null>(null);
  const { dragRef, handleDragStart, clearDragState } = useDragState(
    items,
    days,
    setOverlayItem
  );

  // Rubber band selection
  const gridRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Array<HTMLElement | null>>([]);
  const { lasso, rubberPreviewByDay, beginLasso, moveLasso, endLasso: originalEndLasso } = useRubberSelection(
    days,
    gridRef,
    columnRefs
  );

  // Enhanced endLasso to create persistent time ranges
  const endLasso = useCallback(() => {
    // Create persistent time ranges from rubber preview
    if (rubberPreviewByDay) {
      const newRanges: Array<{ id: string; start: Date; end: Date; dayIdx: number }> = [];

      Object.entries(rubberPreviewByDay).forEach(([dayIdxStr, ranges]) => {
        const dayIdx = parseInt(dayIdxStr);
        ranges?.forEach((range) => {
          newRanges.push({
            id: `range-${Date.now()}-${dayIdx}-${Math.random()}`,
            start: range.start,
            end: range.end,
            dayIdx
          });
        });
      });

      if (newRanges.length > 0) {
        setSelectedTimeRanges(prev => [...prev, ...newRanges]);
      }
    }

    // Call original endLasso
    originalEndLasso();
  }, [rubberPreviewByDay, originalEndLasso]);

  // Helper: items for a specific day (reference line 353)
  const itemsForDay = (day: Date) => {
    const dayStart = startOfDay(day).getTime();
    return items.filter(item => {
      const itemStart = startOfDay(item.start_time).getTime();
      return itemStart === dayStart;
    });
  };

  // Drag handlers following reference pattern
  const onDragStart = (e: DragStartEvent) => {
    handleDragStart(e);
  };

  const onDragMove = (e: DragMoveEvent) => {
    // TODO: Add autoscroll and preview updates from reference lines 380-429
  };

  const onDragEnd = (e: DragEndEvent) => {
    // TODO: Implement actual drag end logic following reference lines 431-467
    console.log('Drag ended:', e);
    clearDragState();
    setOverlayItem(null);
  };

  // Grid mouse handlers for rubber band - exact reference implementation
  const handleGridMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.calendar-item')) return;
    if (!(e.ctrlKey || e.metaKey)) {
      clearSelection();
    }
    beginLasso(e);
  };

  return (
    <div className={`w-full h-full overflow-auto bg-background text-foreground ${className}`}>
      {/* Header - similar to reference lines 567-599 */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">
            Range: {days[0]?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} → {days[days.length - 1]?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              className="px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
              onClick={() => setDays(prev => prev.map(d => addDays(d, -7)))}
            >
              Prev
            </button>
            <button
              className="px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
              onClick={() => {
                const today = startOfDay(new Date());
                setDays(Array.from({ length: days.length }).map((_, i) => addDays(today, i)));
              }}
            >
              Today
            </button>
            <button
              className="px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
              onClick={() => setDays(prev => prev.map(d => addDays(d, 7)))}
            >
              Next
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="flex items-stretch mt-1 select-none">
          {/* Time gutter spacer */}
          <div className="w-14 flex-shrink-0"></div>

          {/* Day header buttons */}
          <div className="flex-1 flex gap-[1px]">
            {days.map((day, i) => (
              <motion.button
                key={i}
                onClick={() => setExpandedDay(cur => cur === i ? null : i)}
                className="text-center text-xs py-1 text-muted-foreground bg-transparent hover:bg-accent rounded-sm border border-border"
                animate={{ width: `${columnPercents[i] ?? (100 / days.length)}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              >
                {day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Body - matches reference lines 602-644 */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
        <div
          className="grid border-t border-border flex-1 overflow-hidden"
          style={{ gridTemplateColumns: "72px 1fr" }}
          ref={gridRef}
          onMouseDown={handleGridMouseDown}
          onMouseMove={moveLasso}
          onMouseUp={endLasso}
        >
          {/* Time gutter */}
          <TimeGutter tz={tz} timeFormat={timeFormat} pxPerHour={64} />

          {/* Day columns container */}
          <div className="relative flex-1 min-h-0">
            <div className="flex pr-2.5 relative" style={{ height: 24 * 64 }}>
            {days.map((day, dayIdx) => {
              const dayItems = itemsForDay(day);
              const placements = computeEventPlacements(dayItems);

              return (
                <motion.div
                  key={dayIdx}
                  className="relative border-l border-border"
                  style={{
                    height: 24 * 64, // 1536px - matches original CalendarDayRange
                  }}
                  animate={{ width: `${columnPercents[dayIdx] ?? (100 / days.length)}%` }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  ref={(el) => { columnRefs.current[dayIdx] = el; }}
                >
                  {/* Grid lines layer - matches original DayColumn */}
                  <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    {Array.from({ length: Math.floor((24 * 60) / 30) + 1 }).map((_, i) => {
                      const minutesFromMidnight = i * 30; // 30-minute slots
                      const isHour = minutesFromMidnight % 60 === 0;
                      const pxPerMinute = 64 / 60; // 64px per hour / 60 minutes
                      return (
                        <div
                          key={i}
                          className={`absolute inset-x-0 border-t ${isHour ? "opacity-70" : "opacity-30"} border-border`}
                          style={{ top: i * 30 * pxPerMinute }}
                        />
                      );
                    })}
                  </div>
                  {/* Items for this day - matches reference lines 192-205 */}
                  {dayItems.map(item => {
                    const placement = placements[item.id] || { lane: 0, lanes: 1, leftPct: 0, widthPct: 100 };
                    const startMinute = getMinutesFromMidnight(item.start_time);
                    const endMinute = getMinutesFromMidnight(item.end_time);
                    const top = minuteToY(startMinute);
                    const height = Math.max(8, minuteToY(endMinute) - top);

                    const layout = {
                      top,
                      height,
                      leftPct: placement.leftPct,
                      widthPct: placement.widthPct
                    };

                    return (
                      <ItemHost
                        key={item.id}
                        item={item}
                        layout={layout}
                        selected={isSelected(item.id)}
                        onMouseDownSelect={onSelectMouseDown}
                        renderItem={renderItem}
                      />
                    );
                  })}

                  {/* Rubber band preview for this day - matches reference implementation */}
                  {rubberPreviewByDay[dayIdx]?.map((range, idx) => {
                    const startMinute = getMinutesFromMidnight(range.start);
                    const endMinute = getMinutesFromMidnight(range.end);
                    const pxPerMinute = 64 / 60; // Match original calculation
                    const top = startMinute * pxPerMinute;
                    const height = Math.max(6, (endMinute - startMinute) * pxPerMinute);

                    return (
                      <div
                        key={`rubber-${idx}`}
                        className="absolute inset-x-0 bg-blue-400/20 border-2 border-dashed border-blue-400 pointer-events-none"
                        style={{ top, height }}
                      />
                    );
                  })}

                  {/* Persistent selected time ranges */}
                  {selectedTimeRanges
                    .filter(range => range.dayIdx === dayIdx)
                    .map((range) => {
                      const startMinute = getMinutesFromMidnight(range.start);
                      const endMinute = getMinutesFromMidnight(range.end);
                      const pxPerMinute = 64 / 60;
                      const top = startMinute * pxPerMinute;
                      const height = Math.max(6, (endMinute - startMinute) * pxPerMinute);

                      return (
                        <div
                          key={range.id}
                          className="absolute inset-x-0 bg-blue-400/30 border border-blue-400 rounded cursor-pointer hover:bg-blue-400/40"
                          style={{ top, height }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Remove this time range when clicked
                            setSelectedTimeRanges(prev => prev.filter(r => r.id !== range.id));
                          }}
                        />
                      );
                    })}
                </motion.div>
              );
            })}

            {/* Lasso rectangle - positioned relative to entire day columns area */}
            {lasso && (
              <div
                className="absolute bg-blue-400/10 border border-blue-400 border-dashed pointer-events-none z-10"
                style={{
                  left: Math.min(lasso.sx0, lasso.sx1),
                  top: Math.min(lasso.sy0, lasso.sy1),
                  width: Math.abs(lasso.sx1 - lasso.sx0),
                  height: Math.abs(lasso.sy1 - lasso.sy0)
                }}
              />
            )}
            </div>
          </div>
        </div>

        {/* Global drag overlay - matches reference lines 646-673 */}
        <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
          {overlayItem ? (
            <div className="rounded-md shadow-sm bg-card text-card-foreground border-2 border-ring p-2">
              <div className="font-semibold text-sm">{getTitle(overlayItem)}</div>
              <div className="text-xs opacity-70">
                {overlayItem.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –
                {overlayItem.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}