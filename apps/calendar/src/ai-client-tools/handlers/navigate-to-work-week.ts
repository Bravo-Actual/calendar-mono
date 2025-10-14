/**
 * Navigate to Work Week Tool Handler
 * Navigates calendar to display the work week (Mon-Fri) containing a date
 */

import { Temporal } from '@js-temporal/polyfill';
import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToWorkWeekArgs {
  date: string;
  timezone?: string;
}

/**
 * Get Monday of the work week containing the given date
 * If date is Saturday/Sunday, returns the following Monday
 * @param date The date within the week
 * @param timezone IANA timezone string
 */
function getWorkWeekMonday(date: Date, timezone: string): Date {
  // Convert to Temporal to get day of week in user's timezone
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);

  // Temporal uses ISO weekday: 1=Monday, 7=Sunday
  // Convert to JS format: 0=Sunday, 1=Monday, etc
  const isoWeekday = zdt.dayOfWeek; // 1-7
  const day = isoWeekday === 7 ? 0 : isoWeekday; // Convert to 0-6

  if (day === 0) {
    // Sunday - next Monday is tomorrow
    const monday = new Date(date);
    monday.setDate(date.getDate() + 1);
    return monday;
  } else if (day === 6) {
    // Saturday - next Monday is in 2 days
    const monday = new Date(date);
    monday.setDate(date.getDate() + 2);
    return monday;
  } else {
    // Weekday - go back to Monday of this week
    const diff = 1 - day; // Monday = 1
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    return monday;
  }
}

export const navigateToWorkWeekHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    // Validate required fields
    if (typeof rawArgs.date !== 'string') {
      return {
        success: false,
        error: 'Invalid arguments: date must be a string',
      };
    }

    const args: NavigateToWorkWeekArgs = {
      date: rawArgs.date,
      timezone: typeof rawArgs.timezone === 'string' ? rawArgs.timezone : undefined,
    };

    try {
      const store = useAppStore.getState();

      // Handle timezone setting if provided
      if (args.timezone && args.timezone !== store.timezone) {
        store.setTimezone(args.timezone);
      }

      // Parse YYYY-MM-DD using user's timezone
      const timezone = args.timezone || store.timezone;
      const [year, month, day] = args.date.split('-').map(Number);

      let date: Date;
      try {
        // Create date at midnight in user's timezone
        const plainDate = Temporal.PlainDate.from({ year, month, day });
        const zonedDateTime = plainDate.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' });
        date = new Date(zonedDateTime.epochMilliseconds);
      } catch (_error) {
        return {
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format (e.g., "2025-10-15").',
        };
      }

      // Get the Monday of the work week (using user's timezone for correct day calculation)
      const monday = getWorkWeekMonday(date, timezone);

      // Set to work week view (5 days)
      store.setDateRangeView('workweek', monday, 5);

      return {
        success: true,
        data: {
          action: 'navigate',
          mode: 'dateRange',
          viewType: 'workweek',
          startDate: monday.toISOString(),
          dayCount: 5,
          message: `Navigated to work week ${monday.toLocaleDateString()}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
