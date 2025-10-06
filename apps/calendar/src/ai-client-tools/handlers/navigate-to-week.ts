/**
 * Navigate to Week Tool Handler
 * Navigates calendar to display the full week (7 days) containing a date
 */

import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToWeekArgs {
  date: string;
  timezone?: string;
  weekStartDay?: number;
}

/**
 * Get the start of the week containing the given date
 * @param date The date within the week
 * @param weekStartDay 0=Sunday, 1=Monday, etc
 */
function getWeekStart(date: Date, weekStartDay: number): Date {
  const day = date.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff);
  return weekStart;
}

export const navigateToWeekHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    const args = rawArgs as NavigateToWeekArgs;

    try {
      const store = useAppStore.getState();

      // Handle timezone setting if provided
      if (args.timezone && args.timezone !== store.timezone) {
        store.setTimezone(args.timezone);
      }

      // Handle week start day if provided
      const weekStartDay = args.weekStartDay ?? store.weekStartDay;
      if (args.weekStartDay !== undefined && args.weekStartDay !== store.weekStartDay) {
        store.setWeekStartDay(args.weekStartDay);
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

      // Get the start of the week
      const weekStart = getWeekStart(date, weekStartDay);

      // Set to week view (7 days)
      store.setDateRangeView('week', weekStart, 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return {
        success: true,
        data: {
          action: 'navigate',
          mode: 'dateRange',
          viewType: 'week',
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
          dayCount: 7,
          weekStartDay,
          message: `Navigated to week ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
        },
      };
    } catch (error) {
      console.error('Navigate to week error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
