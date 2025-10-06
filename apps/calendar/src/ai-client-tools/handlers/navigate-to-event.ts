/**
 * Navigate to Event Tool Handler
 * Navigates calendar to display a specific event with appropriate view
 */

import { db } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

interface NavigateToEventArgs {
  eventId: string;
}

/**
 * Get Monday of the week containing the given date
 */
function getMondayOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

/**
 * Check if a date is during work week (Monday-Friday)
 */
function isWorkWeekDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

export const navigateToEventHandler: ToolHandler = {
  async execute(
    rawArgs: Record<string, unknown>,
    _context: ToolHandlerContext
  ): Promise<ToolResult> {
    const args = rawArgs as NavigateToEventArgs;

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

      // Determine if event is during work week or weekend
      const isWorkWeek = isWorkWeekDay(startDate);

      if (isWorkWeek) {
        // Show work week (Monday-Friday)
        const monday = getMondayOfWeek(startDate);
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
        const monday = getMondayOfWeek(startDate);
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
      console.error('Navigate to event error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
