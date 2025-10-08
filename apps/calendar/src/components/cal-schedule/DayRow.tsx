'use client';

import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TimeItem } from '../cal-grid/types';
import {
  createHorizontalGeometry,
  dateToX,
  startOfDay,
  computeHorizontalPlacements,
  type HorizontalGeometry,
} from './schedule-utils';
import { ScheduleItemHost } from './ScheduleItemHost';

interface DayRowProps<T extends TimeItem> {
  id: string;
  rowId: string;
  items: T[];
  startDate: Date;
  endDate: Date;
  hourWidth: number;
  rowHeight: number;
  snapMinutes?: number;
  startHour?: number; // Default 8am
  endHour?: number; // Default 6pm (18)
  selection: Set<string>;
  onSelectMouseDown: (e: React.MouseEvent, id: string) => void;
  className?: string;
}

export function DayRow<T extends TimeItem>({
  id,
  rowId,
  items,
  startDate,
  endDate,
  hourWidth,
  rowHeight,
  snapMinutes = 15,
  startHour = 8,
  endHour = 18,
  selection,
  onSelectMouseDown,
  className,
}: DayRowProps<T>) {
  const { setNodeRef } = useDroppable({
    id,
    data: { rowId, startDate, endDate, hourWidth },
  });

  // Create horizontal geometry
  const geometry = useMemo(
    () => createHorizontalGeometry({ hourWidth, rowHeight, snapMinutes }),
    [hourWidth, rowHeight, snapMinutes]
  );

  const normalizedStart = startOfDay(startDate);

  // Calculate total width based on business hours only
  const totalDays = Math.ceil((endDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));
  const hoursPerDay = endHour - startHour;
  const totalWidth = totalDays * hoursPerDay * hourWidth;

  // Compute horizontal placements (lane calculations for overlapping items)
  const placements = useMemo(() => computeHorizontalPlacements(items), [items]);

  return (
    <div
      ref={setNodeRef}
      className={cn('relative border-b border-border', className)}
      style={{ height: rowHeight, width: totalWidth }}
    >
      {/* Hour grid lines (business hours only) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {Array.from({ length: totalDays * hoursPerDay + 1 }).map((_, i) => {
          const x = i * hourWidth;
          const hourIndex = i % hoursPerDay;
          const isDayBoundary = hourIndex === 0;
          return (
            <div
              key={i}
              className={cn(
                'absolute top-0 bottom-0 border-l',
                isDayBoundary ? 'border-border' : 'border-border/40'
              )}
              style={{ left: x }}
            />
          );
        })}
      </div>

      {/* Items */}
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const itemStart = new Date(item.start_time);
          const itemEnd = new Date(item.end_time);

          // Use dateToX for horizontal positioning (business hours offset)
          const left = dateToX(itemStart, startDate, geometry, startHour, endHour);
          const right = dateToX(itemEnd, startDate, geometry, startHour, endHour);
          const width = Math.max(24, right - left);

          // Get lane placement for overlapping items (horizontal lanes stack vertically)
          const placement = placements[item.id] || { lane: 0, lanes: 1 };
          const usableHeight = rowHeight - 8;
          const top = 4 + (placement.lane / placement.lanes) * usableHeight;
          const height = (1 / placement.lanes) * usableHeight;

          return (
            <ScheduleItemHost
              key={item.id}
              item={item}
              left={left}
              width={width}
              top={top}
              height={height}
              selected={selection.has(item.id)}
              onMouseDownSelect={onSelectMouseDown}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
