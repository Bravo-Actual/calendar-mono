// Utility functions for horizontal schedule calculations (horizontal version of cal-grid/utils.ts)
import { Temporal } from '@js-temporal/polyfill';
import { format } from 'date-fns';
import type { TimeItem, TimeLike } from '../cal-grid/types';

// Horizontal geometry configuration
export interface HorizontalGeometry {
  hourWidth: number; // Pixels per hour (horizontally)
  minuteWidth: number; // Pixels per minute (derived from hourWidth / 60)
  rowHeight: number; // Height of each row
  snapMinutes: number; // Snap to nearest X minutes
}

// Date utilities (same as cal-grid)
export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

// Timezone-aware version: get minutes from midnight in a specific timezone
export const minutesInTimezone = (d: Date, timeZone: string): number => {
  const instant = Temporal.Instant.fromEpochMilliseconds(d.getTime());
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
  return zonedDateTime.hour * 60 + zonedDateTime.minute;
};

// Timezone-aware version: get start of day in a specific timezone
export const startOfDayInTimezone = (d: Date, timeZone: string): Date => {
  const instant = Temporal.Instant.fromEpochMilliseconds(d.getTime());
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
  const startOfDay = zonedDateTime.withPlainTime(Temporal.PlainTime.from({ hour: 0, minute: 0, second: 0 }));
  return new Date(startOfDay.epochMilliseconds);
};

// Create a date by adding days and setting time in a specific timezone
export const createDateInTimezone = (
  baseDate: Date,
  daysOffset: number,
  hour: number,
  minute: number,
  timeZone: string
): Date => {
  const dayStart = startOfDayInTimezone(baseDate, timeZone);
  const instant = Temporal.Instant.fromEpochMilliseconds(dayStart.getTime());
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);

  const targetZoned = zonedDateTime
    .add({ days: daysOffset })
    .withPlainTime(Temporal.PlainTime.from({ hour, minute, second: 0 }));

  return new Date(targetZoned.epochMilliseconds);
};

export const toDate = (t: TimeLike) => new Date(t);

// Formatting utilities
export const fmtTime = (t: TimeLike) => format(new Date(t), 'h:mm');

// Timezone-aware time formatting
export const fmtTimeInTimezone = (t: TimeLike, timeZone: string): string => {
  const instant = Temporal.Instant.fromEpochMilliseconds(new Date(t).getTime());
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
  const hour = zonedDateTime.hour % 12 || 12;
  const minute = zonedDateTime.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

export const fmtDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

// Create geometry from config
export const createHorizontalGeometry = ({
  hourWidth,
  rowHeight,
  snapMinutes,
}: {
  hourWidth: number;
  rowHeight: number;
  snapMinutes: number;
}): HorizontalGeometry => ({
  hourWidth,
  minuteWidth: hourWidth / 60, // 60 minutes per hour
  rowHeight,
  snapMinutes,
});

// Horizontal position calculations (X instead of Y)
export const minuteToX = (min: number, geo: HorizontalGeometry) => min * geo.minuteWidth;

export const xToMinute = (x: number, geo: HorizontalGeometry) =>
  Math.max(0, Math.round(x / geo.minuteWidth));

// Convert date to X position (business hours only: 8am-6pm by default)
export const dateToX = (
  date: Date,
  startDate: Date,
  geo: HorizontalGeometry,
  startHour = 8,
  endHour = 18
): number => {
  const normalizedStart = startOfDay(startDate);
  const itemDate = new Date(date);

  // Calculate which day this is from the start
  const daysFromStart = Math.floor(
    (startOfDay(itemDate).getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get hour and minute within the day
  const hour = itemDate.getHours();
  const minute = itemDate.getMinutes();
  const totalMinutesInDay = hour * 60 + minute;

  // Offset by start hour (8am = 480 minutes)
  const businessHourMinutes = totalMinutesInDay - startHour * 60;

  // Hours per day in business hours
  const hoursPerDay = endHour - startHour;

  // Position = (days * hours_per_day * hourWidth) + (business_hour_minutes * minuteWidth)
  return daysFromStart * (hoursPerDay * geo.hourWidth) + minuteToX(businessHourMinutes, geo);
};

// Timezone-aware version of dateToX
export const dateToXInTimezone = (
  date: Date,
  startDate: Date,
  geo: HorizontalGeometry,
  timeZone: string,
  startHour = 8,
  endHour = 18
): number => {
  const normalizedStart = startOfDayInTimezone(startDate, timeZone);

  // Calculate which day this is from the start
  const daysFromStart = Math.floor(
    (startOfDayInTimezone(date, timeZone).getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get hour and minute within the day in the specified timezone
  const totalMinutesInDay = minutesInTimezone(date, timeZone);

  // Offset by start hour (8am = 480 minutes)
  const businessHourMinutes = totalMinutesInDay - startHour * 60;

  // Hours per day in business hours
  const hoursPerDay = endHour - startHour;

  // Position = (days * hours_per_day * hourWidth) + (business_hour_minutes * minuteWidth)
  return daysFromStart * (hoursPerDay * geo.hourWidth) + minuteToX(businessHourMinutes, geo);
};

// Convert X position to date
export const xToDate = (x: number, startDate: Date, geo: HorizontalGeometry): Date => {
  const normalizedStart = startOfDay(startDate);
  const totalMinutes = xToMinute(x, geo);
  return addMinutes(normalizedStart, totalMinutes);
};

// Snapping utilities
export const snap = (value: number, interval: number) => Math.round(value / interval) * interval;

export const snapTo = (value: number, interval: number) => Math.round(value / interval) * interval;

// Item placement calculations (horizontal lanes)
export interface HorizontalPlacement {
  lane: number;
  lanes: number;
}

export function computeHorizontalPlacements<T extends TimeItem>(
  items: T[]
): Record<string, HorizontalPlacement> {
  const sorted = [...items].sort((a, b) => {
    const aStart = toDate(a.start_time).getTime();
    const bStart = toDate(b.start_time).getTime();
    if (aStart !== bStart) return aStart - bStart;
    return toDate(a.end_time).getTime() - toDate(b.end_time).getTime();
  });

  const lanes: Array<{ end: number }> = [];
  const placements: Record<string, HorizontalPlacement> = {};

  for (const item of sorted) {
    const start = toDate(item.start_time).getTime();
    const end = toDate(item.end_time).getTime();

    let lane = lanes.findIndex((l) => l.end <= start);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push({ end });
    } else {
      lanes[lane].end = end;
    }

    placements[item.id] = { lane, lanes: lanes.length };
  }

  const maxLanes = lanes.length;
  for (const id in placements) {
    placements[id].lanes = maxLanes;
  }

  return placements;
}

// Range merging utilities (for time selections)
export function mergeRanges(
  ranges: Array<{ start: Date; end: Date }>,
  snapMin: number
): Array<{ start: Date; end: Date }> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Array<{ start: Date; end: Date }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    const gap = (curr.start.getTime() - last.end.getTime()) / 60000;
    if (gap <= snapMin) {
      last.end = new Date(Math.max(last.end.getTime(), curr.end.getTime()));
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

export function mergeMaps(
  a: Record<number, Array<{ start: Date; end: Date }>>,
  b: Record<number, Array<{ start: Date; end: Date }>>,
  snapMin: number
): Record<number, Array<{ start: Date; end: Date }>> {
  const result: Record<number, Array<{ start: Date; end: Date }>> = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const k of allKeys) {
    const combined = [...(a[k] || []), ...(b[k] || [])];
    result[k] = mergeRanges(combined, snapMin);
  }
  return result;
}

// Find day index for a date
export function findDayIndexForDate(date: Date, days: Date[]): number {
  const t = startOfDay(date).getTime();
  return days.findIndex((d) => startOfDay(d).getTime() === t);
}
