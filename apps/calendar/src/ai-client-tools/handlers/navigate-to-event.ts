/**
 * Navigate to Event Tool Handler
 * Navigates calendar to display a specific event with appropriate view
 */

import { Temporal } from '@js-temporal/polyfill';
import { db } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToEventArgs {
  eventId: string;
}

/**
 * Get Monday of the week containing the given date
 * @param date The date within the week
 * @param timezone IANA timezone string
 */
function getMondayOfWeek(date: Date, timezone: string): Date {
  // Convert to Temporal to get day of week in user's timezone
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);

  // Temporal uses ISO weekday: 1=Monday, 7=Sunday
  // Convert to JS format: 0=Sunday, 1=Monday, etc
  const isoWeekday = zdt.dayOfWeek; // 1-7
  const day = isoWeekday === 7 ? 0 : isoWeekday; // Convert to 0-6

  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

/**
 * Check if a date is during work week (Monday-Friday)
 * @param date The date to check
 * @param timezone IANA timezone string
 */
function isWorkWeekDay(date: Date, timezone: string): boolean {
  // Convert to Temporal to get day of week in user's timezone
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);

  // Temporal uses ISO weekday: 1=Monday, 7=Sunday
  const isoWeekday = zdt.dayOfWeek; // 1-7
  return isoWeekday >= 1 && isoWeekday <= 5; // Monday-Friday
}

export const navigateToEventHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    // Validate required fields
    if (typeof rawArgs.eventId !== 'string') {
      return {
        success: false,
        error: 'Invalid arguments: eventId must be a string',
      };
    }

    const args: NavigateToEventArgs = {
      eventId: rawArgs.eventId,
    };

    try {
      // Fetch the event from Dexie (offline-first local DB)
      const event = await db.events.get(args.eventId);

      if (!event) {
        return {
          success: false,
          error: `Event not found: ${args.eventId}`,
        };
      }

      const startDate = new Date(event.start_time);
      const store = useAppStore.getState();
      const timezone = store.timezone;

      // Determine if event is during work week or weekend (using user's timezone)
      const isWorkWeek = isWorkWeekDay(startDate, timezone);

      if (isWorkWeek) {
        // Show work week (Monday-Friday)
        const monday = getMondayOfWeek(startDate, timezone);
        store.setDateRangeView('workweek', monday, 5);

        return {
          success: true,
          data: {
            action: 'navigate',
            mode: 'dateRange',
            viewType: 'workweek',
            eventId: event.id,
            eventTitle: event.title,
            startDate: monday.toISOString(),
            message: `Navigated to work week containing "${event.title}"`,
          },
        };
      } else {
        // Show full week (includes weekend)
        const monday = getMondayOfWeek(startDate, timezone);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() - 1); // Go back to Sunday

        store.setDateRangeView('week', sunday, 7);

        return {
          success: true,
          data: {
            action: 'navigate',
            mode: 'dateRange',
            viewType: 'week',
            eventId: event.id,
            eventTitle: event.title,
            startDate: sunday.toISOString(),
            message: `Navigated to week containing "${event.title}"`,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
