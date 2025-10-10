// Types for the reusable calendar grid component
import type React from 'react';

// Calendar selection type for app store integration
export type CalendarSelection =
  | {
      type: 'event' | 'task' | 'reminder' | 'annotation';
      id: string;
      data?: TimeItem; // Full item data for convenience
      start_time?: Date;
      end_time?: Date;
    }
  | {
      type: 'timeRange';
      id?: never;
      data?: never;
      start_time: Date;
      end_time: Date;
    };

export type TimeLike = Date | string | number;

export interface TimeItem {
  id: string;
  start_time: TimeLike;
  end_time: TimeLike;
  [key: string]: any; // Allow additional properties for flexibility
}

export interface ItemLayout {
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  // Gap spacing info for proper card positioning
  gapPx?: number;
  lane?: number;
  lanes?: number;
}

export interface DragHandlers {
  move: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: Record<string, any>;
    listeners?: Record<string, any>;
  };
  resizeStart: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: Record<string, any>;
    listeners?: Record<string, any>;
  };
  resizeEnd: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: Record<string, any>;
    listeners?: Record<string, any>;
  };
}

export type RenderItem<T extends TimeItem> = (args: {
  item: T;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;
  highlight?: {
    id: string;
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
  };
  timeZone?: string;
}) => React.ReactNode;

export interface RangeLayout {
  top: number;
  height: number;
}

export type RenderRange<T extends TimeItem> = (args: {
  item: T;
  layout: RangeLayout;
  onMouseDown?: (e: React.MouseEvent, id: string) => void;
}) => React.ReactNode;

export interface TimeZoneConfig {
  label: string;
  timeZone: string;
  hour12: boolean;
}

export interface CalendarOperations<T extends TimeItem> {
  move: (item: T, newTimes: { start: Date; end: Date }) => Promise<void>;
  resize: (item: T, newTimes: { start: Date; end: Date }) => Promise<void>;
  delete: (item: T) => Promise<void>;
  create?: (timeRanges: Array<{ start: Date; end: Date }>) => Promise<T[]>; // Return created items
}

// Imperative API for CalendarGrid selection management
export interface CalendarGridHandle {
  // Clear operations
  clearSelections: () => void;
  clearItemSelections: (itemIds: string[]) => void;
  clearTimeRangeSelections: () => void;
  clearSelectionsByRange: (ranges: Array<{ start: Date; end: Date }>) => void;

  // Select operations
  selectItems: (itemIds: string[]) => void;
  selectAllVisible: () => void;
  selectByType: (type: 'event' | 'task' | 'reminder' | 'annotation') => void;
  selectTimeRanges: (ranges: Array<{ start: Date; end: Date }>) => void;

  // Query operations
  getSelections: () => CalendarSelection[];
  getSelectedItemIds: () => string[];
  getSelectedTimeRanges: () => Array<{ start: Date; end: Date }>;
  getAllItems: () => TimeItem[];
}

export interface CalendarGridProps<T extends TimeItem, R extends TimeItem = TimeItem> {
  // Data
  items: T[];
  rangeItems?: R[];
  eventHighlights?: Map<
    string,
    { id: string; emoji_icon?: string | null; title?: string | null; message?: string | null }
  >;

  // View Configuration - matches app store structure
  viewMode: 'dateRange' | 'dateArray';

  // Date Range mode (formerly consecutive)
  dateRangeType?: 'day' | 'week' | 'workweek' | 'custom-days';
  startDate?: Date;
  customDayCount?: number;
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.

  // Date Array mode (formerly non-consecutive)
  selectedDates?: Date[];

  // Styling
  pxPerHour?: number;
  snapMinutes?: number;
  gridMinutes?: number;
  gutterWidth?: number;

  // Interaction
  operations?: CalendarOperations<T>;

  // Selection Interface - both internal and external sync
  onSelectionChange?: (selectedIds: string[]) => void; // Simple callback for selected item IDs
  onSelectionsChange?: (selections: CalendarSelection[]) => void; // Full selection sync for app store
  onSelectedItemsChange?: (items: T[]) => void; // Callback for selected items
  selections?: CalendarSelection[]; // External selections to sync (optional)

  // Customization
  renderItem?: RenderItem<T>;
  renderRange?: RenderRange<R>;
  onRangeClick?: (item: R) => void;
  renderSelection?: (
    selection: { start: Date; end: Date },
    element: React.ReactNode
  ) => React.ReactNode;
  className?: string;

  // Time zones (optional)
  timeZones?: TimeZoneConfig[];

  // Work schedule for shading non-work hours
  workSchedule?: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
  }>;

  // Legacy selection prop (deprecated, use selections instead)
  selectedIds?: string[];

  // Expanded day view
  expandedDay?: number | null;
  onExpandedDayChange?: (dayIndex: number | null) => void;

  // Time selection mode - when enabled, single time range selection calls callback
  timeSelectionMode?: boolean;
  onTimeSelection?: (start: Date, end: Date) => void;
  onTimeSelectionDismiss?: () => void;

  // Collaborator free/busy overlay
  collaboratorFreeBusy?: Array<{
    user_id: string;
    start_time: string;
    end_time: string;
    show_time_as: string;
    avatar_url?: string | null;
    display_name?: string | null;
  }>;
  showCollaboratorOverlay?: boolean;
}

// Internal types
export interface DragState {
  kind: 'move' | 'resize';
  edge?: 'start' | 'end';
  id: string;
  anchorDayIdx: number;
}

export interface ItemPlacement {
  lane: number;
  lanes: number;
}

// Geometry configuration
export interface GeometryConfig {
  minuteHeight: number;
  topOffset: number;
  snapMinutes: number;
  gridMinutes: number;
}
