'use client';

import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';

import type {
  TimeItem,
  RenderItem,
  GeometryConfig,
  ItemLayout,
} from './types';
import {
  minuteToY,
  toDate,
  minutes,
  computePlacements,
} from './utils';
import { ItemHost } from './ItemHost';
import { cn } from '@/lib/utils';

interface DayColumnProps<T extends TimeItem> {
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
  onHighlightMouseDown?: (dayIndex: number, r: { start: Date; end: Date }, e: React.MouseEvent) => void;
  renderItem?: RenderItem<T>;
  geometry: GeometryConfig;
  resizingItems?: Set<string>;
  className?: string;
}

export function DayColumn<T extends TimeItem>({
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
  geometry,
  resizingItems = new Set(),
  className,
}: DayColumnProps<T>) {
  const { setNodeRef } = useDroppable({
    id,
    data: { dayStart, geometry },
  });





  // Compute placements for this single day's items
  const placements = useMemo(() => computePlacements(items), [items]);

  // Grid lines configuration
  const totalHeight = minuteToY(24 * 60, geometry);
  const lineCount = Math.floor((24 * 60) / geometry.gridMinutes);

  const mergedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    setColumnRef?.(el);
  };

  return (
    <div
      ref={mergedRef}
      className={cn(
        'relative bg-background',
        className
      )}
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
                isHour
                  ? 'border-border/80'
                  : 'border-border/40'
              )}
              style={{ top: minuteToY(i * geometry.gridMinutes, geometry) }}
            />
          );
        })}
      </div>

      {/* Real items */}
      <AnimatePresence mode="popLayout">
        {items.map(item => {
          const s = toDate(item.start_time);
          const e = toDate(item.end_time);
          const top = minuteToY(minutes(s), geometry);
          const height = Math.max(24, minuteToY(minutes(e), geometry) - top);
          const plc = placements[item.id] || { lane: 0, lanes: 1 };
          const leftPct = (plc.lane / plc.lanes) * 100;
          const widthPct = (1 / plc.lanes) * 100;

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
            />
          );
        })}
      </AnimatePresence>

      {/* Ghost previews during drag */}
      <AnimatePresence>
        {ghosts?.map(g => {
          const top = minuteToY(minutes(g.start), geometry);
          const height = Math.max(24, minuteToY(minutes(g.end), geometry) - top);

          return (
            <motion.div
              key={`ghost-${g.id}`}
              className={cn(
                'absolute mx-1 rounded-md pointer-events-none z-30 bg-primary/10',
                g.selected && 'ring-2 ring-primary/50'
              )}
              style={{ top, height, left: 0, right: 0 }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            />
          );
        })}
      </AnimatePresence>

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
        return (
          <div
            key={`highlight-${idx}`}
            className="absolute left-0 right-0 bg-primary/10 border-y-2 border-primary cursor-pointer z-10"
            style={{ top, height }}
            onMouseDown={(e) => onHighlightMouseDown?.(dayIndex, r, e)}
          />
        );
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
    <div
      className="absolute inset-x-0 z-50 pointer-events-none"
      style={{ top: y }}
    >
      <div className="relative">
        <div className="absolute w-3 h-3 -translate-x-1.5 -translate-y-1.5 bg-ring rounded-full border-2 border-background" />
        <div className="h-0.5 bg-ring" />
      </div>
    </div>
  );
}