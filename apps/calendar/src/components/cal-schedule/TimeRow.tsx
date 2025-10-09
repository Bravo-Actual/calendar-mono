'use client';

import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import type React from 'react';
import { cn } from '@/lib/utils';
import { ItemHost } from '../cal-grid/ItemHost';
import type { RenderItem, TimeItem } from '../cal-grid/types';
import type { HorizontalGeometryConfig } from './types';
import { dateToX, toDate } from './utils';

interface TimeRowProps<T extends TimeItem> {
  id: string;
  rowId: string;
  label: string;
  avatarUrl?: string;
  items: T[];
  startDate: Date;
  endDate: Date;
  geometry: HorizontalGeometryConfig;
  selection: Set<string>;
  onSelectMouseDown: (e: React.MouseEvent, id: string) => void;
  renderItem?: RenderItem<T>;
  className?: string;
}

export function TimeRow<T extends TimeItem>({
  id,
  rowId,
  label,
  avatarUrl,
  items,
  startDate,
  endDate,
  geometry,
  selection,
  onSelectMouseDown,
  renderItem,
  className,
}: TimeRowProps<T>) {
  const { setNodeRef } = useDroppable({
    id,
    data: { rowId, startDate, endDate, geometry },
  });

  const totalWidth = dateToX(endDate, startDate, geometry);

  return (
    <div
      ref={setNodeRef}
      className={cn('relative border-b border-border z-0', className)}
      style={{ height: geometry.rowHeight, width: totalWidth }}
    >
      {/* Hour grid lines */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
        {Array.from({
          length: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)),
        }).map((_, i) => {
          const hourDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
          const x = dateToX(hourDate, startDate, geometry);
          const isDay = hourDate.getHours() === 0;

          return (
            <div
              key={i}
              className={cn(
                'absolute top-0 bottom-0 border-l',
                isDay ? 'border-border' : 'border-border/40'
              )}
              style={{ left: x }}
            />
          );
        })}
      </div>

      {/* Items */}
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const itemStart = toDate(item.start_time);
          const itemEnd = toDate(item.end_time);
          const left = dateToX(itemStart, startDate, geometry);
          const width = Math.max(24, dateToX(itemEnd, startDate, geometry) - left);

          const layout = {
            top: 4, // Small padding from top of row
            height: geometry.rowHeight - 8, // Leave padding top/bottom
            leftPct: 0, // Not used in horizontal layout
            widthPct: 0, // Not used in horizontal layout
          };

          return (
            <div
              key={item.id}
              className="absolute z-0"
              style={{
                left,
                width,
                top: layout.top,
                height: layout.height,
              }}
            >
              <ItemHost
                item={item}
                layout={layout}
                selected={selection.has(item.id)}
                onMouseDownSelect={onSelectMouseDown}
                renderItem={renderItem}
              />
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
