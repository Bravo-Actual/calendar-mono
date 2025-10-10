/**
 * Navigate to Date Range Tool Handler
 * Navigates calendar to display a custom consecutive date range
 */

import { Temporal } from '@js-temporal/polyfill';
import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToDateRangeArgs {
  startDate: string;
  endDate: string;
  timezone?: string;
}

/**
 * Calculate number of days between two dates (inclusive)
 */
function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
}

export const navigateToDateRangeHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    // Validate required fields
    if (typeof rawArgs.startDate !== 'string' || typeof rawArgs.endDate !== 'string') {
      return {
        success: false,
        error: 'Invalid arguments: startDate and endDate must be strings',
      };
    }

    const args: NavigateToDateRangeArgs = {
      startDate: rawArgs.startDate,
      endDate: rawArgs.endDate,
      timezone: typeof rawArgs.timezone === 'string' ? rawArgs.timezone : undefined,
    };

    try {
      const store = useAppStore.getState();

      // Handle timezone setting if provided
      if (args.timezone && args.timezone !== store.timezone) {
        store.setTimezone(args.timezone);
      }

      // Parse dates using user's timezone
      const timezone = args.timezone || store.timezone;

      // Parse start date
      const [startYear, startMonth, startDay] = args.startDate.split('-').map(Number);
      let startDate: Date;
      try {
        const plainDate = Temporal.PlainDate.from({ year: startYear, month: startMonth, day: startDay });
        const zonedDateTime = plainDate.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' });
        startDate = new Date(zonedDateTime.epochMilliseconds);
      } catch (error) {
        return {
          success: false,
          error: 'Invalid startDate format. Use YYYY-MM-DD format (e.g., "2025-10-15").',
        };
      }

      // Parse end date
      const [endYear, endMonth, endDay] = args.endDate.split('-').map(Number);
      let endDate: Date;
      try {
        const plainDate = Temporal.PlainDate.from({ year: endYear, month: endMonth, day: endDay });
        const zonedDateTime = plainDate.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' });
        endDate = new Date(zonedDateTime.epochMilliseconds);
      } catch (error) {
        return {
          success: false,
          error: 'Invalid endDate format. Use YYYY-MM-DD format (e.g., "2025-10-15").',
        };
      }

      // Validate range
      if (endDate < startDate) {
        return {
          success: false,
          error: 'endDate must be after or equal to startDate.',
        };
      }

      const dayCount = daysBetween(startDate, endDate);

      if (dayCount > 14) {
        return {
          success: false,
          error: 'Cannot display more than 14 days. Please use a shorter date range.',
        };
      }

      // Determine view type based on day count
      let viewType: 'day' | 'week' | 'workweek' | 'custom-days' = 'custom-days';

      if (dayCount === 1) {
        viewType = 'day';
      } else if (dayCount === 7) {
        viewType = 'week';
      } else if (dayCount === 5) {
        viewType = 'workweek';
      }

      store.setDateRangeView(viewType, startDate, dayCount);

      return {
        success: true,
        data: {
          action: 'navigate',
          mode: 'dateRange',
          viewType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          dayCount,
          message: `Navigated to ${dayCount}-day range ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        },
      };
    } catch (error) {
      console.error('Navigate to date range error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
