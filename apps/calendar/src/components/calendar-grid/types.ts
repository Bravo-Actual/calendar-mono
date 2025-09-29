// Types for the reusable calendar grid component
import React from 'react';

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
    listeners: Record<string, any>;
  };
}

export type RenderItem<T extends TimeItem> = (args: {
  item: T;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;
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
}

export interface CalendarGridProps<T extends TimeItem> {
  // Data
  items: T[];
  days: Date[];

  // Styling
  pxPerHour?: number;
  snapMinutes?: number;
  gutterWidth?: number;

  // Interaction
  operations?: CalendarOperations<T>;
  onSelectionChange?: (selectedIds: string[]) => void;

  // Customization
  renderItem?: RenderItem<T>;
  className?: string;

  // Time zones (optional)
  timeZones?: TimeZoneConfig[];

  // Selection
  selectedIds?: string[];

  // Expanded day view
  expandedDay?: number | null;
  onExpandedDayChange?: (dayIndex: number | null) => void;
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
}