import type { EventResolved } from '@/lib/data-v2';
import type { CalendarTimeRange } from './calendar-view/types';

// Re-export calendar view types for compatibility
export type {
  CalendarTimeRange,
  SelectedTimeRange,
  SystemSlot,
} from './calendar-view/types';

export interface CalendarContext {
  // The date range currently visible on the calendar
  viewRange: CalendarTimeRange;

  // Array of all dates currently in view (useful for week/month views)
  viewDates: {
    dates: string[]; // Array of ISO date strings (YYYY-MM-DD)
    description: string; // Description of what these dates represent
  };

  // Events that are currently selected/highlighted by the user
  selectedEvents: {
    events: EventResolved[];
    description: string; // Description of what these events represent
    summary: string; // "There are 3 events in the user selection" | "No events currently selected"
  };

  // Time slots/ranges that the user has manually selected on the calendar
  selectedTimeRanges: {
    ranges: CalendarTimeRange[];
    description: string; // Description of what these ranges represent
    summary: string; // "The user has selected 5 hours of time, spread across 3 selections on 2 separate days" | "No time ranges selected"
  };

  // Current calendar view mode (legacy - use viewDetails for detailed info)
  currentView: 'week' | 'day' | 'month';

  // Detailed view information for AI navigation context (matches navigation tool structure)
  viewDetails: {
    mode: 'dateRange' | 'dateArray';
    // For dateRange mode
    dateRangeType?: 'day' | 'week' | 'workweek' | 'custom-days';
    dayCount?: number; // Number of days in current view
    startDate?: string; // YYYY-MM-DD format
    endDate?: string; // YYYY-MM-DD format
    // For dateArray mode
    dates?: string[]; // Array of YYYY-MM-DD dates for dateArray mode
    // Human-readable description
    description: string; // e.g. "work week view", "3-day custom view", "2 selected dates view"
  };

  // The primary date being viewed (useful for navigation context)
  currentDate: string; // ISO date string (YYYY-MM-DD)

  // Overall view summary
  view_summary: string; // "Viewing week of Dec 16-20, 2024 with 7 total events scheduled across 4 categories"

  // Timezone information for proper timestamp handling
  timezone: string; // IANA timezone identifier (e.g., "America/Chicago")

  // Current date/time context for AI agent
  currentDateTime: {
    utc: string; // Current UTC timestamp (ISO string)
    local: string; // Current timestamp in user's timezone (ISO string)
    timestamp: number; // Current epoch milliseconds
    description: string; // Human-readable description
  };
}
