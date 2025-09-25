
// UI-only types for calendar components
import type { ClientCalendar, ClientCategory } from '@/lib/data/base/client-types';

export type EventId = string;
export type { AssembledEvent as CalendarEvent } from '@/lib/data/base/client-types';

export interface TimeHighlight {
  id: string;
  startAbs: number; // absolute epoch ms UTC
  endAbs: number;   // absolute epoch ms UTC
  intent?: string;
}

export interface SystemSlot {
  id: string;
  startAbs: number; // absolute epoch ms UTC
  endAbs: number;   // absolute epoch ms UTC
  reason?: string;
}

export interface SelectedTimeRange {
  id: string;          // internal ID
  startAbs: number;    // absolute epoch ms UTC (start < end)
  endAbs: number;      // absolute epoch ms UTC
}

export type DragKind = "move" | "resize-start" | "resize-end";
export interface DragState {
  kind: DragKind;
  id: EventId;
  origStart: number;
  origEnd: number;
  startX: number;
  startY: number;
  startDayIdx: number;
  targetDayIdx?: number;
  hoverStart?: number;
  hoverEnd?: number;
  isDragging?: boolean;
  isCopyMode?: boolean;
}

export type Rubber = {
  startDayIdx: number;
  endDayIdx: number;
  startMsInDay: number;
  endMsInDay: number;
  multi: boolean;
  mode: "span" | "clone";
} | null;

export interface CalendarDayRangeProps {
  initialRangeStartISO?: string;         // ISO string; defaults to today
  days?: number;                         // default 7, supports 1-14
  slotMinutes?: 5 | 10 | 15 | 30 | 60;  // grid line density, default 30
  pxPerHour?: number;                   // vertical density, default 48
  viewportHeight?: number;              // scroll viewport height (px), default 720
  timeZone?: string;                    // IANA TZ; default browser TZ
  timeFormat?: '12_hour' | '24_hour';   // time display format; default '12_hour'
  events?: CalendarEvent[];                  // controlled; else internal state
  onEventsChange?: (next: CalendarEvent[]) => void;
  onSelectChange?: (ids: EventId[]) => void; // selected event cards
  onCreateEvents?: (ranges: SelectedTimeRange[]) => void; // create events from time ranges
  onDeleteEvents?: (ids: EventId[]) => void; // delete selected events
  onUpdateEvents?: (ids: EventId[], updates: Partial<CalendarEvent>) => void; // update selected events
  onUpdateEvent?: (updates: { id: string; start_time: string; end_time: string }) => void; // update single event (drag/drop)
  userCategories?: ClientCategory[]; // user's custom categories
  userCalendars?: ClientCalendar[]; // user's calendars
  aiHighlights?: TimeHighlight[];       // optional time-range overlays (AI)
  highlightedEventIds?: EventId[];      // optional highlight ring for specific events
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc. (default 1)
  minDurationMinutes?: number;          // default 15
  dragSnapMinutes?: number;             // default 5 for drag/resize snapping
  selectedTimeRanges?: SelectedTimeRange[]; // controlled; else internal
  onTimeSelectionChange?: (ranges: SelectedTimeRange[]) => void;
  systemHighlightSlots?: SystemSlot[];  // externally-provided system highlight slots
  columnDates?: (Date | string | number)[]; // explicit columns (supports non-consecutive days)
  onEventDoubleClick?: (eventId: EventId) => void; // double-click handler for events
}


export interface CalendarDayRangeHandle {
  goTo: (date: Date | string | number) => void;
  nextRange: () => void;
  prevRange: () => void;
  setDays: (d: number) => void;
  getVisibleRange: () => ({ startMs: number; endMs: number });
  getSelectedTimeRanges: () => SelectedTimeRange[];
  setSelectedTimeRanges: (ranges: SelectedTimeRange[]) => void;
  clearTimeSelection: () => void;
  clearAllSelections: () => void;
  selectEvents: (eventIds: EventId[]) => void;
}

// Calendar Context for AI Chat Integration
export interface CalendarTimeRange {
  start: string // ISO datetime string
  end: string   // ISO datetime string
  description: string // Human-readable description of what this range represents
}

export interface CalendarContext {
  // The date range currently visible on the calendar
  viewRange: CalendarTimeRange

  // Array of all dates currently in view (useful for week/month views)
  viewDates: {
    dates: string[] // Array of ISO date strings (YYYY-MM-DD)
    description: string // Description of what these dates represent
  }

  // Events that are currently selected/highlighted by the user
  selectedEvents: {
    events: CalendarEvent[]
    description: string // Description of what these events represent
    summary: string // "There are 3 events in the user selection" | "No events currently selected"
  }

  // Time slots/ranges that the user has manually selected on the calendar
  selectedTimeRanges: {
    ranges: CalendarTimeRange[]
    description: string // Description of what these ranges represent
    summary: string // "The user has selected 5 hours of time, spread across 3 selections on 2 separate days" | "No time ranges selected"
  }

  // Current calendar view mode (legacy - use viewDetails for detailed info)
  currentView: 'week' | 'day' | 'month'

  // Detailed view information for AI navigation context (matches navigation tool structure)
  viewDetails: {
    mode: 'consecutive' | 'non-consecutive'
    // For consecutive mode
    consecutiveType?: 'day' | 'week' | 'workweek' | 'custom-days'
    dayCount?: number // Number of days in current view
    startDate?: string // YYYY-MM-DD format
    endDate?: string // YYYY-MM-DD format
    // For non-consecutive mode
    dates?: string[] // Array of YYYY-MM-DD dates for non-consecutive mode
    // Human-readable description
    description: string // e.g. "work week view", "3-day custom view", "2 selected dates view"
  }

  // The primary date being viewed (useful for navigation context)
  currentDate: string // ISO date string (YYYY-MM-DD)

  // Category information with summary
  categories: {
    events_by_category: {
      category_name: string
      category_color: string
      event_count: number
      total_duration_minutes: number
    }[]
    summary: string // "Events span 4 different categories: Work (3 events, 4 hours), Personal (1 event, 1 hour), Focus Time (2 events, 3 hours), Meetings (1 event, 30 minutes)"
  }

  // Overall view summary
  view_summary: string // "Viewing week of Dec 16-20, 2024 with 7 total events scheduled across 4 categories"

  // Timezone information for proper timestamp handling
  timezone: string // IANA timezone identifier (e.g., "America/Chicago")

  // Current date/time context for AI agent
  currentDateTime: {
    utc: string // Current UTC timestamp (ISO string)
    local: string // Current timestamp in user's timezone (ISO string)
    timestamp: number // Current epoch milliseconds
    description: string // Human-readable description
  }
}