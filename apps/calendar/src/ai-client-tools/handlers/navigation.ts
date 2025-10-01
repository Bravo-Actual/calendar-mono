/**
 * Calendar Navigation Tool Handler
 * Handles calendar view navigation requests
 */

import { useAppStore } from '@/store/app';
import type { NavigationToolArgs, ToolHandler, ToolHandlerContext, ToolResult } from '../types';

/**
 * Calculate number of days between two dates (inclusive)
 */
function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
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

export const navigationToolHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    const args = rawArgs as NavigationToolArgs;

    try {
      const store = useAppStore.getState();

      // Handle timezone setting if provided
      if (args.timezone && args.timezone !== store.timezone) {
        store.setTimezone(args.timezone);
      }

      // Handle week start day if provided
      if (args.weekStartDay !== undefined && args.weekStartDay !== store.weekStartDay) {
        store.setWeekStartDay(args.weekStartDay);
      }

      // MODE 1: Specific dates array (non-consecutive or explicit dates mode)
      if (args.dates && Array.isArray(args.dates) && args.dates.length > 0) {
        if (args.dates.length > 14) {
          return {
            success: false,
            error: 'Cannot display more than 14 dates. Please provide 1-14 dates.',
          };
        }

        const parsedDates = args.dates.map((d) => new Date(d));
        const invalidDates = parsedDates.filter((d) => Number.isNaN(d.getTime()));

        if (invalidDates.length > 0) {
          return {
            success: false,
            error: 'Invalid date format in dates array. Use ISO 8601 format (e.g., "2024-01-15").',
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
              message: `Navigated to ${count}-day view starting ${startDate.toLocaleDateString()}`,
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
      }

      // MODE 2: Date range (consecutive dates)
      if (args.startDate) {
        const startDate = new Date(args.startDate);

        if (Number.isNaN(startDate.getTime())) {
          return {
            success: false,
            error: 'Invalid startDate format. Use ISO 8601 format (e.g., "2024-01-15").',
          };
        }

        // Single day view
        if (!args.endDate) {
          const viewType = args.viewType === 'day' ? 'day' : 'day';
          store.setDateRangeView(viewType, startDate, 1);

          return {
            success: true,
            data: {
              action: 'navigate',
              mode: 'dateRange',
              viewType: 'day',
              startDate: startDate.toISOString(),
              message: `Navigated to ${startDate.toLocaleDateString()}`,
            },
          };
        }

        // Date range view
        const endDate = new Date(args.endDate);

        if (Number.isNaN(endDate.getTime())) {
          return {
            success: false,
            error: 'Invalid endDate format. Use ISO 8601 format (e.g., "2024-01-15").',
          };
        }

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
            error:
              'Cannot display more than 14 days in a single view. Please use a shorter date range.',
          };
        }

        // Determine view type based on day count or explicit viewType
        let viewType: 'day' | 'week' | 'workweek' | 'custom-days' = 'custom-days';

        if (args.viewType) {
          // Explicit view type provided
          if (args.viewType === 'dates') {
            // Convert to date array mode
            const dates: Date[] = [];
            for (let i = 0; i < dayCount; i++) {
              const date = new Date(startDate);
              date.setDate(date.getDate() + i);
              dates.push(date);
            }

            store.clearSelectedDates();
            for (const date of dates) {
              store.toggleSelectedDate(date);
            }

            return {
              success: true,
              data: {
                action: 'navigate',
                mode: 'dateArray',
                dates: dates.map((d) => d.toISOString()),
                message: `Navigated to ${dayCount} selected dates`,
              },
            };
          } else {
            viewType = args.viewType;
          }
        } else {
          // Auto-detect view type from day count
          if (dayCount === 1) viewType = 'day';
          else if (dayCount === 7) viewType = 'week';
          else if (dayCount === 5) viewType = 'workweek';
          else viewType = 'custom-days';
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
            message: `Navigated to ${dayCount}-day ${viewType} view from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          },
        };
      }

      // No valid parameters provided
      return {
        success: false,
        error:
          'No valid navigation parameters provided. Provide either: dates array, startDate alone, or startDate with endDate.',
      };
    } catch (error) {
      console.error('Navigation tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
