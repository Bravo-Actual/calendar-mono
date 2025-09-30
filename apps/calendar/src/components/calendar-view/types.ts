// Calendar view component types
import type { ClientCalendar, ClientCategory } from '@/lib/data-v2/base/client-types';
import type { EventResolved } from '@/lib/data-v2';

export type EventId = string;

export interface TimeHighlight {
  id: string;
  startAbs: number; // absolute epoch ms UTC
  endAbs: number; // absolute epoch ms UTC
  title?: string;
  message?: string;
  emoji?: string;
}

export interface SystemSlot {
  id: string;
  startAbs: number; // absolute epoch ms UTC
  endAbs: number; // absolute epoch ms UTC
  reason?: string;
}

export interface SelectedTimeRange {
  id: string; // internal ID
  startAbs: number; // absolute epoch ms UTC (start < end)
  endAbs: number; // absolute epoch ms UTC
}

export type DragKind = 'move' | 'resize-start' | 'resize-end';
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
  isProcessing?: boolean;
}

export type Rubber = {
  startDayIdx: number;
  endDayIdx: number;
  startMsInDay: number;
  endMsInDay: number;
  multi: boolean;
  mode: 'span' | 'clone';
} | null;

export interface CalendarDayRangeProps {
  initialRangeStartISO?: string; // ISO string; defaults to today
  days?: number; // default 7, supports 1-14
  slotMinutes?: 5 | 10 | 15 | 30 | 60; // grid line density, default 30
  pxPerHour?: number; // vertical density, default 48
  viewportHeight?: number; // scroll viewport height (px), default 720
  timeZone?: string; // IANA TZ; default browser TZ
  timeFormat?: '12_hour' | '24_hour'; // time display format; default '12_hour'
  events?: EventResolved[]; // controlled; else internal state
  userCategories?: ClientCategory[]; // user's custom categories
  userCalendars?: ClientCalendar[]; // user's calendars
  aiHighlights?: TimeHighlight[]; // optional time-range overlays (AI)
  highlightedEventIds?: EventId[]; // optional highlight ring for specific events
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc. (default 1)
  minDurationMinutes?: number; // default 15
  dragSnapMinutes?: number; // default 5 for drag/resize snapping
  selectedTimeRanges?: SelectedTimeRange[]; // controlled; else internal
  onTimeSelectionChange?: (ranges: SelectedTimeRange[]) => void;
  systemHighlightSlots?: SystemSlot[]; // externally-provided system highlight slots
  columnDates?: (Date | string | number)[]; // explicit columns (supports non-consecutive days)
  onEventDoubleClick?: (eventId: EventId) => void; // double-click handler for events - UI interaction, not data mutation
}

export interface CalendarDayRangeHandle {
  goTo: (date: Date | string | number) => void;
  nextRange: () => void;
  prevRange: () => void;
  setDays: (d: number) => void;
  getVisibleRange: () => { startMs: number; endMs: number };
  getSelectedTimeRanges: () => SelectedTimeRange[];
  setSelectedTimeRanges: (ranges: SelectedTimeRange[]) => void;
  clearTimeSelection: () => void;
  clearAllSelections: () => void;
  selectEvents: (eventIds: EventId[]) => void;
}

// Calendar Context for AI Chat Integration
export interface CalendarTimeRange {
  start: string; // ISO datetime string
  end: string; // ISO datetime string
  description: string; // Human-readable description of what this range represents
}

// Additional types needed by calendar view components
export type ShowTimeAs = 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
export type EventCategory = NonNullable<ClientCategory['color']>;
