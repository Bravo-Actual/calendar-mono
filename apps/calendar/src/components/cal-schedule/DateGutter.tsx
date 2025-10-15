'use client';

import { Temporal } from '@js-temporal/polyfill';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { startOfDay } from '../cal-grid/utils';
import { createDateInTimezone, startOfDayInTimezone } from './schedule-utils';

interface DateGutterProps {
  startDate: Date;
  endDate: Date;
  hourWidth: number;
  startHour?: number; // Default 8am
  endHour?: number; // Default 6pm (18)
  timezone?: string;
  className?: string;
}

export function DateGutter({
  startDate,
  endDate,
  hourWidth,
  startHour = 8,
  endHour = 18,
  timezone,
  className,
}: DateGutterProps) {
  const normalizedStart = timezone
    ? startOfDayInTimezone(startDate, timezone)
    : startOfDay(startDate);
  const totalDays = Math.ceil(
    (endDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const hoursPerDay = endHour - startHour;

  // Generate hours with day/month markers (only business hours)
  const hours: Array<{
    index: number;
    date: Date;
    hour: number;
    isDayStart: boolean;
    isMonthStart: boolean;
    dayLabel?: string;
    monthLabel?: string;
    hourLabel: string;
  }> = [];

  for (let day = 0; day < totalDays; day++) {
    // Create date for this day in the appropriate timezone
    const dayDate = timezone
      ? createDateInTimezone(normalizedStart, day, 0, 0, timezone)
      : new Date(normalizedStart.getTime() + day * 24 * 60 * 60 * 1000);

    // Get day of month and check if month start using timezone-aware methods
    let dayOfMonth: number;
    let monthLabel: string | undefined;
    if (timezone) {
      const instant = Temporal.Instant.fromEpochMilliseconds(dayDate.getTime());
      const zonedDateTime = instant.toZonedDateTimeISO(timezone);
      dayOfMonth = zonedDateTime.day;
      if (dayOfMonth === 1) {
        const plainDate = zonedDateTime.toPlainDate();
        monthLabel = plainDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      }
    } else {
      dayOfMonth = dayDate.getDate();
      if (dayOfMonth === 1) {
        monthLabel = dayDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    }
    const isMonthStart = dayOfMonth === 1;

    for (let hour = startHour; hour < endHour; hour++) {
      const date = timezone
        ? createDateInTimezone(normalizedStart, day, hour, 0, timezone)
        : (() => {
            const d = new Date(dayDate);
            d.setHours(hour, 0, 0, 0);
            return d;
          })();

      const isDayStart = hour === startHour;
      const globalIndex = day * hoursPerDay + (hour - startHour);

      hours.push({
        index: globalIndex,
        date,
        hour,
        isDayStart,
        isMonthStart: isDayStart && isMonthStart,
        dayLabel: isDayStart ? dayOfMonth.toString() : undefined,
        monthLabel: isDayStart && isMonthStart ? monthLabel : undefined,
        hourLabel: format(date, 'ha').toLowerCase(),
      });
    }
  }

  return (
    <div className={cn('flex flex-col relative', className)}>
      {/* Month row */}
      <div className="h-10 border-b border-border flex relative">
        {hours.map((h) => (
          <div
            key={`month-${h.index}`}
            className="flex items-center px-2 flex-shrink-0"
            style={{ width: hourWidth }}
          >
            {h.monthLabel && <span className="text-sm font-medium">{h.monthLabel}</span>}
          </div>
        ))}
      </div>

      {/* Day row */}
      <div className="h-8 border-b border-border flex relative">
        {hours.map((h) => (
          <div
            key={`day-${h.index}`}
            className={cn(
              'flex items-center px-2 flex-shrink-0',
              h.isDayStart ? 'border-l border-border' : 'border-l border-border/20'
            )}
            style={{ width: hourWidth }}
          >
            {h.dayLabel && (
              <span className="text-xs font-medium text-muted-foreground">{h.dayLabel}</span>
            )}
          </div>
        ))}
      </div>

      {/* Hour row */}
      <div className="h-6 flex">
        {hours.map((h) => (
          <div
            key={`hour-${h.index}`}
            className={cn(
              'flex items-center px-2 flex-shrink-0 text-[10px] font-mono text-muted-foreground',
              h.isDayStart ? 'border-l border-border' : 'border-l border-border/20'
            )}
            style={{ width: hourWidth }}
          >
            {h.hourLabel}
          </div>
        ))}
      </div>
    </div>
  );
}
