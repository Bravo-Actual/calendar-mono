// Utility functions for horizontal timeline calculations
import { Temporal } from '@js-temporal/polyfill';
import type { HorizontalGeometryConfig } from './types';

// Convert a date to X position (pixels from start)
export function dateToX(date: Date, startDate: Date, geometry: HorizontalGeometryConfig): number {
  const msFromStart = date.getTime() - startDate.getTime();
  const hoursFromStart = msFromStart / (1000 * 60 * 60);
  return hoursFromStart * geometry.pxPerHour;
}

// Convert X position to date
export function xToDate(x: number, startDate: Date, geometry: HorizontalGeometryConfig): Date {
  const hoursFromStart = x / geometry.pxPerHour;
  const msFromStart = hoursFromStart * 60 * 60 * 1000;
  return new Date(startDate.getTime() + msFromStart);
}

// Get minutes from midnight for a date
export function getMinutesFromMidnight(date: Date, timeZone?: string): number {
  if (timeZone) {
    const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
    const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
    return zonedDateTime.hour * 60 + zonedDateTime.minute;
  }
  return date.getHours() * 60 + date.getMinutes();
}

// Snap a date to the nearest interval
export function snapToInterval(date: Date, snapMinutes: number, timeZone?: string): Date {
  const totalMinutes = getMinutesFromMidnight(date, timeZone);
  const snapped = Math.round(totalMinutes / snapMinutes) * snapMinutes;
  const snappedHour = Math.floor(snapped / 60);
  const snappedMinute = snapped % 60;

  if (timeZone) {
    // Use Temporal to create date in specific timezone
    const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
    const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
    const snappedZoned = zonedDateTime.withPlainTime(
      Temporal.PlainTime.from({ hour: snappedHour, minute: snappedMinute, second: 0 })
    );
    return new Date(snappedZoned.epochMilliseconds);
  }

  const result = new Date(date);
  result.setHours(snappedHour, snappedMinute, 0, 0);
  return result;
}

// Calculate total width needed for time range
export function getTotalWidth(
  startDate: Date,
  endDate: Date,
  geometry: HorizontalGeometryConfig
): number {
  return dateToX(endDate, startDate, geometry);
}

// Convert TimeItem to Date (handles Date | string | number)
export function toDate(time: Date | string | number): Date {
  if (time instanceof Date) return time;
  return new Date(time);
}
