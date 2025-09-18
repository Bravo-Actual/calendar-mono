
export type EventId = string;

export type ShowTimeAs = "free" | "tentative" | "busy" | "oof" | "working_elsewhere";
export type EventCategory = "neutral" | "slate" | "orange" | "yellow" | "green" | "blue" | "indigo" | "violet" | "fuchsia" | "rose";
export type UserRole = "viewer" | "contributor" | "owner" | "delegate_full";
export type InviteType = "required" | "optional";
export type RsvpStatus = "tentative" | "accepted" | "declined";
export type AttendanceType = "in_person" | "virtual";
export type TimeDefenseLevel = "flexible" | "normal" | "high" | "hard_block";

export interface CalEvent {
  // Core event fields (from events table)
  id: EventId;
  owner: string;
  creator: string;
  series_id?: string;
  title: string;
  agenda?: string;
  online_event: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person: boolean;
  start_time: string; // ISO timestamp
  duration: number; // minutes
  all_day: boolean;
  private: boolean;
  request_responses: boolean;
  allow_forwarding: boolean;
  hide_attendees: boolean;
  history: unknown[];
  created_at: string;
  updated_at: string;

  // User's relationship to event (from event_user_roles or ownership)
  user_role?: UserRole;
  invite_type?: InviteType;
  rsvp?: RsvpStatus;
  rsvp_timestamp?: string;
  attendance_type?: AttendanceType;
  following: boolean;

  // User's event options (from user_event_options)
  show_time_as: ShowTimeAs;
  user_category_id?: string;
  user_category_name?: string;
  user_category_color?: string;
  time_defense_level: TimeDefenseLevel;
  ai_managed: boolean;
  ai_instructions?: string;

  // Computed fields for calendar rendering
  start: number; // epoch ms UTC (computed from start_time)
  end: number;   // epoch ms UTC (computed from start_time + duration)
  aiSuggested?: boolean; // Legacy field for AI suggestions (not yet in DB)
}

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

export interface CalendarWeekProps {
  initialWeekStartISO?: string;         // ISO string; defaults to today
  days?: number;                         // default 7, supports 1-14
  slotMinutes?: 5 | 10 | 15 | 30 | 60;  // grid line density, default 30
  pxPerHour?: number;                   // vertical density, default 48
  viewportHeight?: number;              // scroll viewport height (px), default 720
  timeZone?: string;                    // IANA TZ; default browser TZ
  events?: CalEvent[];                  // controlled; else internal state
  onEventsChange?: (next: CalEvent[]) => void;
  onSelectChange?: (ids: EventId[]) => void; // selected event cards
  onCreateEvents?: (ranges: SelectedTimeRange[]) => void; // create events from time ranges
  onDeleteEvents?: (ids: EventId[]) => void; // delete selected events
  onUpdateEvents?: (ids: EventId[], updates: Partial<CalEvent>) => void; // update selected events
  userCategories?: import("@/hooks/use-event-categories").UserEventCategory[]; // user's custom categories
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

export interface CalendarWeekHandle {
  goTo: (date: Date | string | number) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  setDays: (d: number) => void;
  getVisibleRange: () => ({ startMs: number; endMs: number });
  getSelectedTimeRanges: () => SelectedTimeRange[];
  setSelectedTimeRanges: (ranges: SelectedTimeRange[]) => void;
  clearTimeSelection: () => void;
  clearAllSelections: () => void;
  selectEvents: (eventIds: EventId[]) => void;
}