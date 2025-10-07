// Re-export calendar view types for compatibility
export type {
  CalendarTimeRange,
  SelectedTimeRange,
  SystemSlot,
} from './calendar-view/types';

// Simplified calendar context - only includes user selections
// View range and dates are sent separately via runtime context
export interface CalendarContext {
  // Events that are currently selected/clicked by the user
  selectedEvents: {
    eventIds: string[]; // Array of event IDs
    count: number; // Number of selected events
    summary: string; // "No events selected" | "2 events selected"
  };

  // Time slots/ranges that the user has manually selected on the calendar
  selectedTimeRanges: {
    ranges: Array<{
      start: string; // ISO timestamp
      end: string; // ISO timestamp
    }>;
    count: number; // Number of selected time ranges
    summary: string; // "No time slots selected" | "2 time slots selected"
  };
}
