/**
 * Navigate to Dates Tool Handler
 * Navigates calendar to display a specific array of dates (non-consecutive allowed)
 */

import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToDatesArgs {
  dates: string[];
  timezone?: string;
}

/**
 * Check if dates form a consecutive range
 */
function isConsecutiveDates(dates: Date[]): boolean {
  if (dates.length <= 1) return true;

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = sorted[i - 1];
    const currDate = sorted[i];
    const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.abs(dayDiff - 1) > 0.1) {
      // Not consecutive (allowing small floating point error)
      return false;
    }
  }
  return true;
}

export const navigateToDatesHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    const args = rawArgs as NavigateToDatesArgs;

    try {
      const store = useAppStore.getState();

      // Handle timezone setting if provided
      if (args.timezone && args.timezone !== store.timezone) {
        store.setTimezone(args.timezone);
      }

      // Validate array
      if (!args.dates || !Array.isArray(args.dates) || args.dates.length === 0) {
        return {
          success: false,
          error: 'dates array is required and must contain at least 1 date.',
        };
      }

      if (args.dates.length > 14) {
        return {
          success: false,
          error: 'Cannot display more than 14 dates. Please provide 1-14 dates.',
        };
      }

      // Parse dates
      const parsedDates = args.dates.map((d) => {
        const [year, month, day] = d.split('-').map(Number);
        return new Date(year, month - 1, day);
      });

      const invalidDates = parsedDates.filter((d) => Number.isNaN(d.getTime()));
      if (invalidDates.length > 0) {
        return {
          success: false,
          error: 'Invalid date format in dates array. Use YYYY-MM-DD format (e.g., "2025-10-15").',
        };
      }

      // Check if dates are consecutive
      const consecutive = isConsecutiveDates(parsedDates);

      if (consecutive && parsedDates.length > 1) {
        // Use date range mode for consecutive dates
        const sorted = [...parsedDates].sort((a, b) => a.getTime() - b.getTime());
        const startDate = sorted[0];
        const count = parsedDates.length;

        // Determine view type
        let viewType: 'week' | 'workweek' | 'custom-days' = 'custom-days';
        if (count === 7) viewType = 'week';
        else if (count === 5) viewType = 'workweek';

        store.setDateRangeView(viewType, startDate, count);

        return {
          success: true,
          data: {
            action: 'navigate',
            mode: 'dateRange',
            viewType,
            startDate: startDate.toISOString(),
            dayCount: count,
            message: `Navigated to ${count} consecutive dates (${viewType} view)`,
          },
        };
      } else {
        // Use date array mode for non-consecutive dates
        store.clearSelectedDates();
        for (const date of parsedDates) {
          store.toggleSelectedDate(date);
        }

        return {
          success: true,
          data: {
            action: 'navigate',
            mode: 'dateArray',
            dates: parsedDates.map((d) => d.toISOString()),
            message: `Navigated to ${parsedDates.length} selected dates`,
          },
        };
      }
    } catch (error) {
      console.error('Navigate to dates error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
