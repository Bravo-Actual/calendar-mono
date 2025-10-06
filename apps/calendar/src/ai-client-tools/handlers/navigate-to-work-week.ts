/**
 * Navigate to Work Week Tool Handler
 * Navigates calendar to display the work week (Mon-Fri) containing a date
 */

import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToWorkWeekArgs {
  date: string;
  timezone?: string;
}

/**
 * Get Monday of the work week containing the given date
 * If date is Saturday/Sunday, returns the following Monday
 */
function getWorkWeekMonday(date: Date): Date {
  const day = date.getDay();

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
    const args = rawArgs as NavigateToWorkWeekArgs;

    try {
      const store = useAppStore.getState();

      // Handle timezone setting if provided
      if (args.timezone && args.timezone !== store.timezone) {
        store.setTimezone(args.timezone);
      }

      // Parse YYYY-MM-DD as local date at midnight
      const [year, month, day] = args.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);

      if (Number.isNaN(date.getTime())) {
        return {
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format (e.g., "2025-10-15").',
        };
      }

      // Get the Monday of the work week
      const monday = getWorkWeekMonday(date);

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
      console.error('Navigate to work week error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
