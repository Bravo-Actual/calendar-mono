// Types for the horizontal timeline schedule view
import type React from 'react';
import type { TimeItem, ItemLayout, CalendarOperations } from '../cal-grid/types';
import type { ShowTimeAs } from '@/types';

// Row represents a person/resource in the schedule
export interface ScheduleRow {
  id: string;
  label: string;
  avatarUrl?: string;
  items: TimeItem[];
}

// Horizontal geometry configuration (time flows left-to-right)
export interface HorizontalGeometryConfig {
  pxPerHour: number; // Pixels per hour horizontally
  topOffset: number; // Top padding for header
  rowHeight: number; // Height of each person row
  snapMinutes: number; // Snap to nearest X minutes when dragging
}

// Time range for the schedule view
export interface ScheduleTimeRange {
  start: Date;
  end: Date;
}

// Horizontal item layout (X position and width instead of Y)
export interface HorizontalItemLayout {
  left: number; // X position in pixels
  width: number; // Width in pixels
  top: number; // Y position (row-based)
  height: number; // Row height
}

export interface CalendarScheduleProps<T extends TimeItem> {
  // Data
  rows: ScheduleRow[];

  // Time range
  timeRange: ScheduleTimeRange;

  // Styling
  pxPerHour?: number;
  snapMinutes?: number;
  rowHeight?: number;

  // Timezone
  timezone?: string;

  // Interaction
  operations?: CalendarOperations<T>;

  // Selection
  onSelectionChange?: (selectedIds: string[]) => void;
  selectedIds?: string[];

  // User data for action bar
  userCalendars?: Array<{
    id: string;
    name: string;
    color: string;
    type: 'default' | 'archive' | 'user';
  }>;
  userCategories?: Array<{
    id: string;
    name: string;
    color: string;
  }>;

  // Handlers for creating/updating events
  onCreateEvent?: (start: Date, end: Date) => Promise<any> | void;
  onCreateEvents?: (timeRanges: Array<{ start: Date; end: Date }>, categoryId: string, categoryName: string) => Promise<any[]>;
  onUpdateShowTimeAs?: (itemIds: string[], showTimeAs: ShowTimeAs) => void;
  onUpdateCalendar?: (itemIds: string[], calendarId: string) => void;
  onUpdateCategory?: (itemIds: string[], categoryId: string) => void;
  onUpdateIsOnlineMeeting?: (itemIds: string[], isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson?: (itemIds: string[], isInPerson: boolean) => void;
  onUpdateIsPrivate?: (itemIds: string[], isPrivate: boolean) => void;

  // Customization
  className?: string;
}

// Internal drag state for horizontal dragging
export interface HorizontalDragState {
  kind: 'move' | 'resize';
  edge?: 'start' | 'end';
  id: string;
  rowId: string; // Track which row the item belongs to
}
