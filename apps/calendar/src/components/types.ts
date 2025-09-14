import { Temporal } from "@js-temporal/polyfill";

export type EventId = string;

export type ShowTimeAs = "busy" | "tentative" | "free";
export type EventCategory = "neutral" | "slate" | "orange" | "yellow" | "green" | "blue" | "indigo" | "violet" | "fuchsia" | "rose";

export interface CalEvent {
  id: EventId;
  title: string;
  start: number; // epoch ms UTC
  end: number;   // epoch ms UTC (end > start)
  allDay?: boolean;
  aiSuggested?: boolean;
  showTimeAs?: ShowTimeAs;
  category?: EventCategory;
  isOnlineMeeting?: boolean;
  isInPerson?: boolean;
  meta?: Record<string, unknown>;
}

export interface TimeHighlight {
  id: string;
  dayIdx: number; // 0..(days-1) relative to current weekStart
  start: number;  // ms from 00:00 local (e.g., 13:30 -> 48600000)
  end: number;    // ms from 00:00 local
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

export interface CalendarWeekProps {
  initialWeekStartISO?: string;         // ISO string; defaults to today
  days?: 5 | 7;                         // default 7
  slotMinutes?: 5 | 10 | 15 | 30 | 60;  // grid line density, default 30
  pxPerHour?: number;                   // vertical density, default 48
  viewportHeight?: number;              // scroll viewport height (px), default 720
  timeZone?: string;                    // IANA TZ; default browser TZ
  events?: CalEvent[];                  // controlled; else internal state
  onEventsChange?: (next: CalEvent[]) => void;
  onSelectChange?: (ids: EventId[]) => void; // selected event cards
  aiHighlights?: TimeHighlight[];       // optional time-range overlays (AI)
  highlightedEventIds?: EventId[];      // optional highlight ring for specific events
  weekStartsOn?: 0 | 1;                 // 0=Sunday, 1=Monday (default 1)
  minDurationMinutes?: number;          // default 15
  dragSnapMinutes?: number;             // default 5 for drag/resize snapping
  selectedTimeRanges?: SelectedTimeRange[]; // controlled; else internal
  onTimeSelectionChange?: (ranges: SelectedTimeRange[]) => void;
  systemHighlightSlots?: SystemSlot[];  // externally-provided system highlight slots
  columnDates?: (Date | string | number)[]; // explicit columns (supports non-consecutive days)
}

export interface CalendarWeekHandle {
  goTo: (date: Date | string | number) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  setDays: (d: 5 | 7) => void;
  getVisibleRange: () => ({ startMs: number; endMs: number });
  getSelectedTimeRanges: () => SelectedTimeRange[];
  setSelectedTimeRanges: (ranges: SelectedTimeRange[]) => void;
  clearTimeSelection: () => void;
}