'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { startOfDayInTimezone } from './schedule-utils';

interface DayNavigatorProps {
  startDate: Date;
  endDate: Date;
  currentDate: Date; // Date currently visible in viewport
  onJumpTo: (date: Date) => void;
  timezone?: string;
  className?: string;
}

export function DayNavigator({
  startDate,
  endDate,
  currentDate,
  onJumpTo,
  timezone,
  className,
}: DayNavigatorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [daysToShow, setDaysToShow] = React.useState(31);

  const today = timezone
    ? startOfDayInTimezone(new Date(), timezone)
    : (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();

  const currentDateNormalized = new Date(currentDate);
  currentDateNormalized.setHours(0, 0, 0, 0);

  // Calculate how many days fit in the available width
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateDaysToShow = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const dayButtonWidth = 32 + 2; // 32px button + 2px gap (w-8 + gap-0.5)
      const availableDays = Math.floor(containerWidth / dayButtonWidth);
      // Make it odd so current day is centered
      const oddDays = availableDays % 2 === 0 ? availableDays - 1 : availableDays;
      setDaysToShow(Math.max(15, oddDays)); // Minimum 15 days
    };

    // Initial calculation
    updateDaysToShow();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateDaysToShow);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const daysBeforeCurrent = Math.floor(daysToShow / 2);

  const days: Array<{
    date: Date;
    label: string;
    isWeekend: boolean;
    isToday: boolean;
    isCurrent: boolean;
  }> = [];

  // Start from daysBeforeCurrent days before current date
  const iterDate = new Date(currentDateNormalized);
  iterDate.setDate(iterDate.getDate() - daysBeforeCurrent);

  for (let i = 0; i < daysToShow; i++) {
    const dayStart = new Date(iterDate);
    const dayOfWeek = dayStart.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = dayStart.getTime() === today.getTime();
    const isCurrent = dayStart.getTime() === currentDateNormalized.getTime();

    // Format: Just day number
    const dayNum = dayStart.getDate();

    days.push({
      date: new Date(dayStart),
      label: dayNum.toString(),
      isWeekend,
      isToday,
      isCurrent,
    });

    iterDate.setDate(iterDate.getDate() + 1);
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 bg-background border-t border-border h-10 flex',
        className
      )}
    >
      {/* Label */}
      <div className="w-48 bg-background border-r border-border z-10 flex items-center px-4 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">Jump to</span>
      </div>

      {/* Macro day view - NOT scrolled, fixed minimap */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div ref={containerRef} className="relative flex items-center gap-0.5 px-2 h-full">
          {/* Fade out edges - positioned relative to days container */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          {days.map((day, i) => (
            <button
              key={i}
              className={cn(
                'w-8 h-8 shrink-0 flex items-center justify-center text-xs rounded-md font-normal transition-colors',
                // Today styling - primary color like shadcn date picker
                day.isToday &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                // Current date (from scroll) - outline style
                !day.isToday && day.isCurrent && 'ring-2 ring-primary bg-accent',
                // Default styling
                !day.isToday && !day.isCurrent && 'hover:bg-accent hover:text-accent-foreground',
                // Weekend muted
                !day.isToday && !day.isCurrent && day.isWeekend && 'text-muted-foreground'
              )}
              onClick={() => onJumpTo(day.date)}
              title={day.date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
