'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { HorizontalGeometryConfig } from './types';
import { dateToX } from './utils';
import { startOfDay } from '../cal-grid/utils';

interface TimeHeaderProps {
  startDate: Date;
  endDate: Date;
  geometry: HorizontalGeometryConfig;
  scrollLeft: number;
  timezone: string;
  className?: string;
}

export function TimeHeader({
  startDate,
  endDate,
  geometry,
  scrollLeft,
  timezone,
  className,
}: TimeHeaderProps) {
  // Generate days with month labels - fixed width per day
  const days: Array<{ dayLabel: string; monthLabel?: string; width: number }> = [];
  const dayWidth = 600; // Fixed: 600px per day

  const normalizedStart = startOfDay(startDate);
  let currentDate = new Date(normalizedStart);

  while (currentDate < endDate) {
    const dayStart = new Date(currentDate);

    days.push({
      dayLabel: dayStart.getDate().toString(),
      monthLabel: dayStart.getDate() === 1
        ? dayStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : undefined,
      width: dayWidth,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Find active month based on scroll position
  let activeMonth = days.find(day => day.monthLabel)?.monthLabel || '';
  let cumulativeX = 0;

  for (const day of days) {
    if (day.monthLabel) {
      if (cumulativeX > scrollLeft) {
        break;
      }
      activeMonth = day.monthLabel;
    }
    cumulativeX += day.width;
  }

  return (
    <div className={cn('relative', className)}>
      {/* Sticky active month indicator */}
      <div className="absolute left-0 top-0 h-10 w-48 bg-background border-r border-b border-border flex items-center justify-center z-20">
        <span className="text-sm font-medium">{activeMonth}</span>
      </div>

      {/* Scrolling timeline */}
      <div className="overflow-hidden" style={{ marginLeft: -scrollLeft }}>
        {/* Month row - same boxes as day row */}
        <div className="h-10 border-b border-border flex">
          {days.map((day, i) => (
            <div key={i} className="flex items-center px-2" style={{ width: day.width }}>
              {day.monthLabel && <span className="text-sm font-medium">{day.monthLabel}</span>}
            </div>
          ))}
        </div>

        {/* Day row - same boxes as month row */}
        <div className="h-8 border-b border-border flex">
          {days.map((day, i) => (
            <div
              key={i}
              className="flex items-center justify-center border-r border-border/40"
              style={{ width: day.width }}
            >
              <span className="text-xs text-muted-foreground">{day.dayLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
