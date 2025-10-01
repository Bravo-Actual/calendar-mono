# Calendar Grid Refactor Plan

## Overview
Refactor the calendar grid system to adopt the clean patterns from the reference implementation while maintaining our existing features, styling, and data layer. This will improve maintainability, reduce complexity, and add advanced selection capabilities.

## Goals
1. **Cleaner Architecture**: Adopt the ItemHost pattern for better separation of concerns
2. **Better Drag & Drop**: Implement the reference's proven drag/drop patterns
3. **Advanced Selection**: Multi-select with keyboard modifiers, rubber band selection
4. **Improved UX**: Better click vs drag detection, smoother interactions
5. **Maintainability**: More modular components, clearer state management

## Current Features to Preserve
- ✅ Event categories with custom colors
- ✅ All-day events
- ✅ Meeting type icons (video, in-person)
- ✅ Show time as indicators (busy, free, tentative)
- ✅ Event context menus
- ✅ Time zone support
- ✅ Expandable day view
- ✅ AI time highlights
- ✅ Time range selection (rubber band)
- ✅ Event drag and drop with optimistic updates
- ✅ Event resize handles
- ✅ Offline-first data layer with outbox deduplication
- ✅ Dark/light theme support
- ✅ Accessibility (ARIA attributes)

## New Features from Reference
- 🆕 **Multi-select Events**: Ctrl/Cmd click to select multiple events
- 🆕 **Rubber Band Selection**: Drag to select time ranges across multiple days
- 🆕 **Keyboard Shortcuts**: Esc to clear selections, Ctrl+A to select all
- 🆕 **Cross-day Dragging**: Drag events to different days
- 🆕 **Better Visual Feedback**: Improved ghost/overlay during drag
- 🆕 **Auto-scroll**: Scroll during drag when near edges
- 🆕 **Smart Overlapping**: Better handling of overlapping events

## Architecture Changes

### 1. Component Structure
```
CalendarDayRange (main container)
├── DndContext (drag and drop)
├── TimeGutter (time labels)
└── DayColumn[] (droppable day containers)
    ├── ItemHost[] (drag wrapper for events)
    │   └── EventCard (our existing styled events)
    ├── TimeHighlights (AI highlights)
    ├── RubberBand (time selection overlay)
    └── DropPreview (snap indicator)
```

### 2. New Components to Create
- **`ItemHost`**: Wrapper that handles drag setup and selection for any calendar item
- **`EventHost`**: Specialized ItemHost for events with resize handles
- **`TimeGutter`**: Extracted time column component
- **`RubberBand`**: Time range selection overlay
- **`DropPreview`**: Ghost/snap indicator during drag
- **`SelectionManager`**: Hook for managing multi-select state

### 3. State Management
- **Selection State**: Set of selected event IDs
- **Drag State**: Current drag operation (move/resize) with clear types
- **Preview State**: Ghost positions during drag
- **Rubber State**: Time range selection state

## Implementation Phases

### Phase 1: Component Extraction ✅ COMPLETED
**Goal**: Extract reusable components without changing behavior

#### 1.1 Create ItemHost Component ✅ DONE
```tsx
interface ItemHostProps {
  event: EventResolved;
  layout: { top: number; height: number; leftPct: number; widthPct: number };
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  children: React.ReactNode;
}
```

#### 1.2 Create TimeGutter Component ✅ DONE
```tsx
interface TimeGutterProps {
  tz: string;
  timeFormat: '12_hour' | '24_hour';
  className?: string;
}
```

#### 1.3 Extract Utility Functions ✅ DONE
- Created `geometry.ts` with exact reference patterns
- Created `collision-detection.ts` with event overlap algorithm
- Created `selection-utils.ts` with time range merging
- Created `event-host.tsx` with resize handles

**Files created**:
- `apps/calendar/src/components/calendar-view/geometry.ts` ✅
- `apps/calendar/src/components/calendar-view/collision-detection.ts` ✅
- `apps/calendar/src/components/calendar-view/selection-utils.ts` ✅
- `apps/calendar/src/components/calendar-view/item-host.tsx` ✅
- `apps/calendar/src/components/calendar-view/time-gutter.tsx` ✅
- `apps/calendar/src/components/calendar-view/event-host.tsx` ✅

### Phase 2: Drag & Drop Improvement
**Goal**: Adopt reference drag patterns for better reliability

#### 2.1 Simplify Drag State
```tsx
interface DragState {
  kind: 'move' | 'resize';
  edge?: 'start' | 'end';
  eventId: string;
  anchorDayIdx: number;
  selectedIds: string[]; // For multi-select drag
}
```

#### 2.2 Improve Sensor Configuration
- Use 6px activation distance (reference uses 6px)
- Add keyboard sensor for accessibility
- Better pointer event handling

#### 2.3 Cross-day Drag Support
- Enable dragging events between days
- Update drop zones to accept cross-day operations
- Maintain time calculations across day boundaries

**Files to modify**:
- `apps/calendar/src/lib/calendar-drag/types.ts`
- `apps/calendar/src/lib/calendar-drag/drag-utils.ts`
- `apps/calendar/src/components/calendar-view/calendar-day-range.tsx`

### Phase 3: Advanced Selection
**Goal**: Add multi-select and rubber band selection

#### 3.1 Multi-select Events
- Ctrl/Cmd click to toggle selection
- Visual indicators for selected events
- Bulk operations (delete, move, update properties)

#### 3.2 Rubber Band Time Selection
- Drag empty areas to select time ranges
- Snap to grid (15-minute increments)
- Cross-day selection support
- Merge overlapping selections

#### 3.3 Keyboard Shortcuts
- `Esc`: Clear all selections
- `Ctrl+A`: Select all events
- `Delete`: Delete selected events
- Arrow keys: Navigate selection (future)

**Files to create**:
- `apps/calendar/src/components/calendar-view/rubber-band.tsx`
- `apps/calendar/src/hooks/use-rubber-selection.ts`
- `apps/calendar/src/hooks/use-keyboard-shortcuts.ts`

### Phase 4: Visual Improvements
**Goal**: Better drag feedback and visual polish

#### 4.1 Drag Overlay
- Use DragOverlay for smooth drag feedback
- Show selected count during multi-drag
- Better ghost appearance

#### 4.2 Drop Preview
- Snap indicator that matches event positioning
- Real-time feedback during drag
- Cross-day drop hints

#### 4.3 Auto-scroll
- Scroll when dragging near viewport edges
- Smooth scrolling behavior
- Prevent over-scrolling

**Files to modify**:
- `apps/calendar/src/components/calendar-view/day-column.tsx`
- `apps/calendar/src/components/calendar-view/event-card-content.tsx`

## Technical Specifications

### 1. Geometry System
Adopt reference geometry patterns:
```tsx
const GEOMETRY = {
  minuteHeight: 1.5, // px per minute
  topOffset: 8,      // header offset
  snapMinutes: 15    // grid snap
} as const;
```

### 2. Event Layout Engine
Implement collision detection for overlapping events:
```tsx
interface EventPlacement {
  lane: number;      // horizontal lane (0-based)
  lanes: number;     // total lanes in cluster
  leftPct: number;   // CSS left percentage
  widthPct: number;  // CSS width percentage
}
```

### 3. Selection State
```tsx
interface SelectionState {
  selectedEventIds: Set<string>;
  selectedTimeRanges: Array<{
    id: string;
    dayIdx: number;
    start: Date;
    end: Date;
  }>;
  mode: 'events' | 'time' | 'mixed';
}
```

### 4. Rubber Band Selection
```tsx
interface RubberState {
  active: boolean;
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  additive: boolean; // Ctrl/Cmd held
  snappedRanges: Record<number, Array<{ start: Date; end: Date }>>;
}
```

## Styling Guidelines

### 1. Maintain Current Colors
- Keep existing category color system
- Preserve dark/light theme support
- Maintain accessibility contrast ratios

### 2. Selection Indicators
```css
.selected-event {
  @apply ring-2 ring-ring border-ring shadow-lg;
}

.multi-selected {
  @apply ring-4 ring-blue-400 shadow-xl;
}

.rubber-band {
  @apply bg-blue-400/20 border-2 border-dashed border-blue-400;
}
```

### 3. Drag States
```css
.dragging {
  @apply opacity-50 cursor-grabbing;
}

.drag-ghost {
  @apply ring-2 ring-blue-400/70 bg-blue-400/10;
  outline: 2px dashed rgba(59, 130, 246, 0.6);
}
```

## Data Layer Integration

### 1. Preserve Offline-First
- Keep existing outbox deduplication
- Maintain optimistic updates
- Preserve sync functionality

### 2. Bulk Operations
Add support for multi-select operations:
```tsx
// Bulk update multiple events
async function updateMultipleEvents(
  userId: string,
  eventIds: string[],
  updates: Partial<EventFields>
): Promise<void>

// Bulk delete
async function deleteMultipleEvents(
  userId: string,
  eventIds: string[]
): Promise<void>
```

### 3. Time Range Operations
```tsx
// Create event from time selection
async function createEventFromTimeRange(
  userId: string,
  range: { start: Date; end: Date; dayIdx: number }
): Promise<string>
```

## Testing Strategy

### 1. Unit Tests
- Test geometry calculations
- Test collision detection
- Test selection state management
- Test drag calculations

### 2. Integration Tests
- Multi-select interactions
- Cross-day drag operations
- Rubber band selection
- Keyboard shortcuts

### 3. Visual Tests
- Screenshot tests for different states
- Drag and drop visual feedback
- Theme compatibility

## Migration Strategy

### 1. Feature Flags
Use feature flags to gradually roll out new behavior:
```tsx
const FEATURES = {
  multiSelect: true,
  rubberBand: true,
  crossDayDrag: true,
  autoScroll: true
} as const;
```

### 2. Backwards Compatibility
- Keep existing APIs during transition
- Maintain current keyboard shortcuts
- Preserve existing context menus

### 3. Incremental Rollout
1. **Week 1**: Phase 1 (Component extraction)
2. **Week 2**: Phase 2 (Drag improvements)
3. **Week 3**: Phase 3 (Advanced selection)
4. **Week 4**: Phase 4 (Visual polish)

## Success Metrics

### 1. Code Quality
- Reduce calendar component complexity by 40%
- Increase test coverage to 85%
- Eliminate drag-related bugs

### 2. User Experience
- Sub-100ms drag response time
- Support for 100+ events per day
- Zero selection state bugs

### 3. Developer Experience
- Clear component boundaries
- Reusable drag/selection logic
- Comprehensive TypeScript types

## Risk Mitigation

### 1. Breaking Changes
- Maintain existing prop interfaces
- Keep current event data structure
- Preserve accessibility features

### 2. Performance
- Profile geometry calculations
- Optimize render cycles during drag
- Lazy load heavy components

### 3. Browser Compatibility
- Test across all supported browsers
- Fallbacks for older touch devices
- Keyboard-only navigation support

## Detailed File Structure & Implementation

### 1. Utilities Layer (`apps/calendar/src/lib/calendar-grid/`)

#### `geometry.ts` - Core measurement calculations
```typescript
// Based on reference lines 66-71
export const GEOMETRY = {
  minuteHeight: 1.5,  // px per minute (matches our current grid)
  topOffset: 8,       // header offset in px
  snapMinutes: 15,    // snap to 15-minute grid
  minEventHeight: 24, // minimum event height in px
  dayStartHour: 0,    // 24-hour format
  dayEndHour: 24
} as const;

// Core conversion functions (reference lines 67-70)
export const minuteToY = (minute: number) => GEOMETRY.topOffset + minute * GEOMETRY.minuteHeight;
export const yToMinute = (y: number) => Math.max(0, Math.round((y - GEOMETRY.topOffset) / GEOMETRY.minuteHeight));
export const snapToGrid = (minute: number) => Math.round(minute / GEOMETRY.snapMinutes) * GEOMETRY.snapMinutes;
export const snapToGridWithStep = (minute: number, step: number) => Math.round(minute / step) * step;

// Date utilities
export const startOfDay = (date: Date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
export const addDays = (date: Date, days: number) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);
export const getMinutesFromMidnight = (date: Date) => date.getHours() * 60 + date.getMinutes();

// Geometry for day column calculations
export interface CalendarGeometry {
  minuteHeight: number;
  topOffset: number;
  snapMinutes: number;
  dayStartMs: number;
  dayHeightPx: number;
}

export const createGeometry = (dayStart: Date): CalendarGeometry => ({
  minuteHeight: GEOMETRY.minuteHeight,
  topOffset: GEOMETRY.topOffset,
  snapMinutes: GEOMETRY.snapMinutes,
  dayStartMs: dayStart.getTime(),
  dayHeightPx: minuteToY(24 * 60) // Full day height
});
```

#### `collision-detection.ts` - Event overlap calculations
```typescript
// Based on reference lines 144-178
import type { EventResolved } from '@/lib/data-v2';

export interface EventPlacement {
  eventId: string;
  lane: number;      // 0-based horizontal lane
  lanes: number;     // total lanes in this cluster
  leftPct: number;   // CSS left percentage
  widthPct: number;  // CSS width percentage
}

interface EventInterval {
  id: string;
  startMinute: number;
  endMinute: number;
  lane: number;
}

// Compute horizontal placement for overlapping events (reference algorithm)
export function computeEventPlacements(events: EventResolved[], dayStart: Date): Record<string, EventPlacement> {
  // Convert events to intervals sorted by start time
  const intervals = events
    .map(event => ({
      id: event.id,
      startMinute: getMinutesFromMidnight(new Date(event.start_time_ms)),
      endMinute: getMinutesFromMidnight(new Date(event.end_time_ms)),
      lane: -1
    }))
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const active: EventInterval[] = [];
  const placements: Record<string, EventPlacement> = {};
  let clusterIds: string[] = [];
  let clusterMaxLane = -1;

  // Finalize current cluster by setting lane count
  const finalizeCluster = () => {
    if (clusterIds.length === 0) return;
    const lanes = clusterMaxLane + 1;
    clusterIds.forEach(id => {
      const placement = placements[id];
      if (placement) {
        placement.lanes = lanes;
        placement.leftPct = (placement.lane / lanes) * 100;
        placement.widthPct = (1 / lanes) * 100;
      }
    });
    clusterIds = [];
    clusterMaxLane = -1;
  };

  // Remove intervals that have ended
  const pruneActive = (currentTime: number) => {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMinute <= currentTime) {
        active.splice(i, 1);
      }
    }
  };

  // Find smallest available lane
  const findFreeLane = () => {
    const usedLanes = new Set(active.map(interval => interval.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane++;
    return lane;
  };

  // Process each interval
  for (const interval of intervals) {
    pruneActive(interval.startMinute);

    // If no active intervals, finalize previous cluster
    if (active.length === 0) {
      finalizeCluster();
    }

    // Assign lane and add to active
    const lane = findFreeLane();
    interval.lane = lane;
    active.push(interval);

    // Add to current cluster
    placements[interval.id] = {
      eventId: interval.id,
      lane,
      lanes: 1, // Will be updated in finalizeCluster
      leftPct: 0, // Will be calculated in finalizeCluster
      widthPct: 100 // Will be calculated in finalizeCluster
    };
    clusterIds.push(interval.id);
    clusterMaxLane = Math.max(clusterMaxLane, lane);
  }

  // Finalize last cluster
  finalizeCluster();

  return placements;
}
```

#### `selection-utils.ts` - Selection state management
```typescript
// Based on reference lines 32-61 for range merging
export interface TimeRange {
  start: Date;
  end: Date;
}

export interface SelectionState {
  selectedEventIds: Set<string>;
  selectedTimeRanges: Array<{
    id: string;
    dayIdx: number;
    start: Date;
    end: Date;
  }>;
  rubberBandActive: boolean;
}

const RUBBER_SNAP_MIN = 5; // 5-minute snap for rubber band selection

// Clone range safely
function cloneRange(range: TimeRange): TimeRange {
  return { start: new Date(range.start), end: new Date(range.end) };
}

// Merge overlapping/touching time ranges with tolerance
export function mergeTimeRanges(ranges: TimeRange[], stepMinutes: number = RUBBER_SNAP_MIN): TimeRange[] {
  if (!ranges || ranges.length === 0) return [];

  const sorted = ranges
    .filter(r => r && r.start <= r.end)
    .map(cloneRange)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeRange[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // Merge if overlapping or within step tolerance
    const gapMinutes = (next.start.getTime() - current.end.getTime()) / 60000;

    if (gapMinutes <= 0 || Math.abs(gapMinutes) <= stepMinutes) {
      // Merge: extend current end if next ends later
      if (next.end > current.end) {
        current.end = next.end;
      }
    } else {
      // No merge: add current and move to next
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

// Merge time range maps per day
export function mergeTimeRangeMaps(
  base: Record<number, TimeRange[]>,
  additional: Record<number, TimeRange[]>,
  stepMinutes: number = RUBBER_SNAP_MIN
): Record<number, TimeRange[]> {
  const result: Record<number, TimeRange[]> = { ...base };

  for (const [dayIdxStr, ranges] of Object.entries(additional)) {
    const dayIdx = Number(dayIdxStr);
    const combined = [...(result[dayIdx] || []), ...(ranges || [])];
    result[dayIdx] = mergeTimeRanges(combined, stepMinutes);
  }

  return result;
}

// Event selection utilities
export function toggleEventSelection(
  selectedIds: Set<string>,
  eventId: string,
  multiSelect: boolean
): Set<string> {
  const newSelection = new Set(selectedIds);

  if (multiSelect) {
    // Toggle: add if not present, remove if present
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
  } else {
    // Single select: clear all and add this one
    newSelection.clear();
    newSelection.add(eventId);
  }

  return newSelection;
}
```

#### `bulk-operations.ts` - Multi-event operations
```typescript
import { updateEventResolved, deleteEventResolved } from '@/lib/data-v2';
import type { EventFields } from '@/lib/data-v2/base/client-types';

export interface BulkUpdateOptions {
  userId: string;
  eventIds: string[];
  updates: Partial<EventFields>;
}

export interface BulkDeleteOptions {
  userId: string;
  eventIds: string[];
}

// Bulk update multiple events with proper error handling
export async function bulkUpdateEvents({ userId, eventIds, updates }: BulkUpdateOptions): Promise<{
  successful: string[];
  failed: Array<{ eventId: string; error: string }>;
}> {
  const successful: string[] = [];
  const failed: Array<{ eventId: string; error: string }> = [];

  // Process updates sequentially to avoid overwhelming the outbox
  for (const eventId of eventIds) {
    try {
      await updateEventResolved(userId, eventId, updates);
      successful.push(eventId);
    } catch (error) {
      failed.push({
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return { successful, failed };
}

// Bulk delete multiple events
export async function bulkDeleteEvents({ userId, eventIds }: BulkDeleteOptions): Promise<{
  successful: string[];
  failed: Array<{ eventId: string; error: string }>;
}> {
  const successful: string[] = [];
  const failed: Array<{ eventId: string; error: string }> = [];

  for (const eventId of eventIds) {
    try {
      await deleteEventResolved(userId, eventId);
      successful.push(eventId);
    } catch (error) {
      failed.push({
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return { successful, failed };
}
```

### 2. Drag System (`apps/calendar/src/lib/calendar-drag/`)

#### `sensors.ts` - dnd-kit sensor configuration
```typescript
// Based on reference lines 234-238
import { PointerSensor, KeyboardSensor, useSensors, useSensor } from '@dnd-kit/core';

export function useCalendarSensors() {
  return useSensors(
    // Distance-based activation prevents accidental drags during clicks
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 } // Reference uses 6px
    }),
    // Keyboard sensor for accessibility
    useSensor(KeyboardSensor)
  );
}
```

#### Updated `types.ts` - Comprehensive drag types
```typescript
import type { EventResolved } from '@/lib/data-v2';

// Drag operation kinds
export type DragKind = 'move' | 'resize-start' | 'resize-end';

// Complete drag state (reference line 356)
export interface DragState {
  kind: 'move' | 'resize';
  edge?: 'start' | 'end';
  eventId: string;
  anchorDayIdx: number;
  selectedIds: string[]; // Multi-select support
  originalEvent: EventResolved;
}

// Drag proposal for calculations
export interface DragProposal {
  type: 'move' | 'resize';
  eventId: string;
  newStartTime: Date;
  newEndTime: Date;
  targetDayIdx: number; // Cross-day support
}

// Pointer delta for calculations
export interface PointerDelta {
  deltaX: number;
  deltaY: number;
  pointerY: number;
}

// Calendar geometry for calculations
export interface CalendarGeometry {
  minuteHeight: number;
  topOffset: number;
  snapMinutes: number;
  dayStartMs: number;
  minDurMs: number;
  yToLocalMs: (y: number, snapStep: number) => number;
}

// Drag data for dnd-kit
export interface DragData {
  eventId: string;
  kind: DragKind;
}

// Drop zone data
export interface DropZoneData {
  dayIdx: number;
  dayStartMs: number;
  geometry: CalendarGeometry;
}

// Preview state during drag
export interface PreviewState {
  eventId: string;
  start: Date;
  end: Date;
  dayIdx: number;
}
```

#### Updated `drag-utils.ts` - Multi-select drag support
```typescript
// Enhanced version with multi-select and cross-day support
import type { EventResolved } from '@/lib/data-v2';
import type { DragState, DragProposal, PointerDelta, CalendarGeometry, PreviewState } from './types';
import { getMinutesFromMidnight, addMinutes, startOfDay } from '../calendar-grid/geometry';

// Calculate drag proposal for single or multiple events (reference lines 380-429)
export function calculateDragProposals(
  dragState: DragState,
  pointerDelta: PointerDelta,
  targetGeometry: CalendarGeometry,
  allEvents: EventResolved[]
): DragProposal[] {
  const { kind, eventId, selectedIds, edge } = dragState;

  // Get events to move (either selected group or just the dragged event)
  const eventsToMove = selectedIds.length > 1 && selectedIds.includes(eventId)
    ? selectedIds.map(id => allEvents.find(e => e.id === id)).filter(Boolean) as EventResolved[]
    : allEvents.filter(e => e.id === eventId);

  const proposals: DragProposal[] = [];

  if (kind === 'move') {
    // Calculate target time from pointer position
    const targetLocalMs = targetGeometry.yToLocalMs(pointerDelta.pointerY, targetGeometry.snapMinutes);
    const targetAbsMs = targetGeometry.dayStartMs + targetLocalMs;

    // For multi-move, maintain relative positions
    const primaryEvent = eventsToMove.find(e => e.id === eventId);
    if (!primaryEvent) return [];

    const primaryDuration = primaryEvent.end_time_ms - primaryEvent.start_time_ms;
    const primaryNewStart = targetAbsMs - Math.floor(primaryDuration / 2);

    eventsToMove.forEach(event => {
      const offset = event.start_time_ms - primaryEvent.start_time_ms;
      const duration = event.end_time_ms - event.start_time_ms;
      const newStartMs = primaryNewStart + offset;
      const newEndMs = newStartMs + duration;

      proposals.push({
        type: 'move',
        eventId: event.id,
        newStartTime: new Date(newStartMs),
        newEndTime: new Date(newEndMs),
        targetDayIdx: Math.floor((targetGeometry.dayStartMs - startOfDay(new Date(targetGeometry.dayStartMs)).getTime()) / (24 * 60 * 60 * 1000))
      });
    });
  } else if (kind === 'resize') {
    // Resize only affects the primary event
    const event = eventsToMove[0];
    if (!event) return [];

    const targetLocalMs = targetGeometry.yToLocalMs(pointerDelta.pointerY, targetGeometry.snapMinutes);
    const targetAbsMs = targetGeometry.dayStartMs + targetLocalMs;

    let newStartMs = event.start_time_ms;
    let newEndMs = event.end_time_ms;

    if (edge === 'start') {
      newStartMs = targetAbsMs;
      // Ensure minimum duration
      if (newEndMs - newStartMs < targetGeometry.minDurMs) {
        newStartMs = newEndMs - targetGeometry.minDurMs;
      }
    } else if (edge === 'end') {
      newEndMs = targetAbsMs;
      // Ensure minimum duration
      if (newEndMs - newStartMs < targetGeometry.minDurMs) {
        newEndMs = newStartMs + targetGeometry.minDurMs;
      }
    }

    proposals.push({
      type: 'resize',
      eventId: event.id,
      newStartTime: new Date(newStartMs),
      newEndTime: new Date(newEndMs),
      targetDayIdx: Math.floor((targetGeometry.dayStartMs - startOfDay(new Date(targetGeometry.dayStartMs)).getTime()) / (24 * 60 * 60 * 1000))
    });
  }

  return proposals;
}

// Convert proposals to preview state
export function proposalsToPreview(proposals: DragProposal[]): Record<string, PreviewState> {
  const preview: Record<string, PreviewState> = {};

  proposals.forEach(proposal => {
    preview[proposal.eventId] = {
      eventId: proposal.eventId,
      start: proposal.newStartTime,
      end: proposal.newEndTime,
      dayIdx: proposal.targetDayIdx
    };
  });

  return preview;
}

// KEEP EXISTING calculatePointerDelta function exactly as is
export function calculatePointerDelta(
  dragOverEvent: any,
  dayColumnRect: DOMRect
): PointerDelta {
  const activatorEvent = dragOverEvent.activatorEvent as PointerEvent;
  const delta = dragOverEvent.delta || { x: 0, y: 0 };
  const pointerY = activatorEvent.clientY + delta.y - dayColumnRect.top;

  return {
    deltaX: delta.x,
    deltaY: delta.y,
    pointerY
  };
}
```

### 3. Hooks (`apps/calendar/src/hooks/`)

#### `use-selection.ts` - Selection state management
```typescript
// Based on reference lines 280, 337-351
import { useState, useCallback, useEffect } from 'react';
import type { EventResolved } from '@/lib/data-v2';
import { toggleEventSelection, type SelectionState, type TimeRange } from '@/lib/calendar-grid/selection-utils';

export interface UseSelectionReturn {
  selectedEventIds: Set<string>;
  selectedTimeRanges: Array<{ id: string; dayIdx: number; start: Date; end: Date }>;
  selectEvent: (eventId: string, multiSelect: boolean) => void;
  selectAllEvents: (events: EventResolved[]) => void;
  clearSelection: () => void;
  addTimeRange: (dayIdx: number, range: TimeRange) => void;
  clearTimeRanges: () => void;
  isEventSelected: (eventId: string) => boolean;
  hasSelection: boolean;
}

export function useSelection(): UseSelectionReturn {
  const [state, setState] = useState<SelectionState>({
    selectedEventIds: new Set(),
    selectedTimeRanges: [],
    rubberBandActive: false
  });

  const selectEvent = useCallback((eventId: string, multiSelect: boolean) => {
    setState(prev => ({
      ...prev,
      selectedEventIds: toggleEventSelection(prev.selectedEventIds, eventId, multiSelect),
      // Clear time ranges when selecting events (unless multi-select)
      selectedTimeRanges: multiSelect ? prev.selectedTimeRanges : []
    }));
  }, []);

  const selectAllEvents = useCallback((events: EventResolved[]) => {
    setState(prev => ({
      ...prev,
      selectedEventIds: new Set(events.map(e => e.id)),
      selectedTimeRanges: [] // Clear time ranges
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState({
      selectedEventIds: new Set(),
      selectedTimeRanges: [],
      rubberBandActive: false
    });
  }, []);

  const addTimeRange = useCallback((dayIdx: number, range: TimeRange) => {
    setState(prev => ({
      ...prev,
      selectedTimeRanges: [
        ...prev.selectedTimeRanges,
        {
          id: `range_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          dayIdx,
          start: range.start,
          end: range.end
        }
      ],
      // Clear event selection when selecting time
      selectedEventIds: new Set()
    }));
  }, []);

  const clearTimeRanges = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedTimeRanges: []
    }));
  }, []);

  const isEventSelected = useCallback((eventId: string) => {
    return state.selectedEventIds.has(eventId);
  }, [state.selectedEventIds]);

  const hasSelection = state.selectedEventIds.size > 0 || state.selectedTimeRanges.length > 0;

  return {
    selectedEventIds: state.selectedEventIds,
    selectedTimeRanges: state.selectedTimeRanges,
    selectEvent,
    selectAllEvents,
    clearSelection,
    addTimeRange,
    clearTimeRanges,
    isEventSelected,
    hasSelection
  };
}
```

#### `use-keyboard-shortcuts.ts` - Keyboard handling
```typescript
// Based on reference lines 314-335
import { useEffect } from 'react';
import type { EventResolved } from '@/lib/data-v2';

export interface UseKeyboardShortcutsOptions {
  events: EventResolved[];
  onSelectAll: (events: EventResolved[]) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  selectedEventIds: Set<string>;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  events,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  selectedEventIds,
  disabled = false
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!(target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ));

      // Don't handle shortcuts when user is typing
      if (isTyping) return;

      switch (e.key) {
        case 'Escape':
          // Clear all selections
          onClearSelection();
          break;

        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onSelectAll(events);
          }
          break;

        case 'Delete':
        case 'Backspace':
          if (selectedEventIds.size > 0) {
            e.preventDefault();
            onDeleteSelected();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [events, onSelectAll, onClearSelection, onDeleteSelected, selectedEventIds, disabled]);
}
```

#### `use-rubber-selection.ts` - Rubber band selection
```typescript
// Based on reference lines 470-550
import { useState, useCallback, useRef } from 'react';
import type { TimeRange } from '@/lib/calendar-grid/selection-utils';
import { mergeTimeRanges, mergeTimeRangeMaps } from '@/lib/calendar-grid/selection-utils';
import { yToMinute, snapToGridWithStep, minuteToY, startOfDay, addMinutes } from '@/lib/calendar-grid/geometry';

const RUBBER_SNAP_MIN = 5; // 5-minute snap for rubber band

export interface RubberBandState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  snappedLeft: number;
  snappedRight: number;
  snappedTop: number;
  snappedBottom: number;
  additive: boolean; // Ctrl/Cmd held during selection
}

export interface UseRubberSelectionOptions {
  dayStarts: Date[];
  existingTimeRanges: Record<number, TimeRange[]>;
  onSelectionChange: (ranges: Record<number, TimeRange[]>) => void;
  gridRef: React.RefObject<HTMLElement>;
  columnRefs: React.RefObject<Array<HTMLElement | null>>;
}

export function useRubberSelection({
  dayStarts,
  existingTimeRanges,
  onSelectionChange,
  gridRef,
  columnRefs
}: UseRubberSelectionOptions) {
  const [rubberState, setRubberState] = useState<RubberBandState | null>(null);
  const [previewRanges, setPreviewRanges] = useState<Record<number, TimeRange[]>>({});

  const beginSelection = useCallback((e: React.MouseEvent) => {
    // Don't start on calendar items
    if ((e.target as HTMLElement).closest('.calendar-item')) return;

    const additive = e.ctrlKey || e.metaKey;
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;

    const startX = e.clientX - gridRect.left;
    const startY = e.clientY - gridRect.top;

    // Find initial column for snapping
    let snappedLeft = startX;
    let snappedRight = startX;
    let firstColumnTop = 0;

    for (let idx = 0; idx < dayStarts.length; idx++) {
      const column = columnRefs.current?.current?.[idx];
      if (!column) continue;

      const columnRect = column.getBoundingClientRect();
      const left = columnRect.left - gridRect.left;
      const right = columnRect.right - gridRect.left;

      if (startX >= left && startX <= right) {
        snappedLeft = left;
        snappedRight = right;
        firstColumnTop = columnRect.top - gridRect.top;
        break;
      }
    }

    // Snap vertical start to grid
    const initialMinute = snapToGridWithStep(yToMinute(startY - firstColumnTop), RUBBER_SNAP_MIN);
    const snappedY = firstColumnTop + minuteToY(initialMinute);

    setRubberState({
      active: true,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      snappedLeft,
      snappedRight,
      snappedTop: snappedY,
      snappedBottom: snappedY,
      additive
    });

    setPreviewRanges({});
  }, [dayStarts, gridRef, columnRefs]);

  const updateSelection = useCallback((e: React.MouseEvent) => {
    if (!rubberState?.active) return;

    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;

    const currentX = e.clientX - gridRect.left;
    const currentY = e.clientY - gridRect.top;

    // Calculate selection bounds
    const xMin = Math.min(rubberState.startX, currentX);
    const xMax = Math.max(rubberState.startX, currentX);
    const yMin = Math.min(rubberState.startY, currentY);
    const yMax = Math.max(rubberState.startY, currentY);

    // Find intersecting columns and calculate ranges
    const rawRanges: Record<number, TimeRange[]> = {};
    let newSnappedLeft = rubberState.snappedLeft;
    let newSnappedRight = rubberState.snappedRight;
    let firstColumnTop = 0;
    let hasIntersection = false;

    dayStarts.forEach((dayStart, idx) => {
      const column = columnRefs.current?.current?.[idx];
      if (!column) return;

      const columnRect = column.getBoundingClientRect();
      const left = columnRect.left - gridRect.left;
      const right = columnRect.right - gridRect.left;
      const top = columnRect.top - gridRect.top;
      const bottom = columnRect.bottom - gridRect.top;

      // Check intersection
      const intersectsX = !(xMax < left || xMin > right);
      const intersectsY = !(yMax < top || yMin > bottom);

      if (!intersectsX || !intersectsY) return;

      if (!hasIntersection) {
        newSnappedLeft = left;
        newSnappedRight = right;
        firstColumnTop = top;
        hasIntersection = true;
      } else {
        newSnappedLeft = Math.min(newSnappedLeft, left);
        newSnappedRight = Math.max(newSnappedRight, right);
      }

      // Calculate time range for this column
      const relativeYMin = Math.max(yMin, top) - top;
      const relativeYMax = Math.min(yMax, bottom) - top;

      const startMinute = snapToGridWithStep(yToMinute(relativeYMin), RUBBER_SNAP_MIN);
      const endMinute = snapToGridWithStep(yToMinute(relativeYMax), RUBBER_SNAP_MIN);

      if (endMinute > startMinute) {
        const rangeStart = addMinutes(startOfDay(dayStart), startMinute);
        const rangeEnd = addMinutes(startOfDay(dayStart), Math.max(endMinute, startMinute + RUBBER_SNAP_MIN));

        rawRanges[idx] = [{ start: rangeStart, end: rangeEnd }];
      }
    });

    // Calculate snapped rectangle
    let snappedTop = rubberState.snappedTop;
    let snappedBottom = rubberState.snappedBottom;

    if (hasIntersection) {
      const topMinute = snapToGridWithStep(yToMinute(yMin - firstColumnTop), RUBBER_SNAP_MIN);
      const bottomMinute = snapToGridWithStep(yToMinute(yMax - firstColumnTop), RUBBER_SNAP_MIN);
      snappedTop = firstColumnTop + minuteToY(topMinute);
      snappedBottom = firstColumnTop + minuteToY(bottomMinute);
    }

    // Merge with existing if additive
    const mergedRanges = rubberState.additive
      ? mergeTimeRangeMaps(existingTimeRanges, rawRanges, RUBBER_SNAP_MIN)
      : Object.fromEntries(
          Object.entries(rawRanges).map(([dayIdx, ranges]) => [
            Number(dayIdx),
            mergeTimeRanges(ranges, RUBBER_SNAP_MIN)
          ])
        );

    setRubberState(prev => prev ? {
      ...prev,
      currentX,
      currentY,
      snappedLeft: newSnappedLeft,
      snappedRight: newSnappedRight,
      snappedTop,
      snappedBottom
    } : null);

    setPreviewRanges(mergedRanges);
  }, [rubberState, gridRef, columnRefs, dayStarts, existingTimeRanges]);

  const endSelection = useCallback(() => {
    if (!rubberState?.active) {
      setRubberState(null);
      setPreviewRanges({});
      return;
    }

    // Commit the selection
    const finalRanges = rubberState.additive
      ? mergeTimeRangeMaps(existingTimeRanges, previewRanges, RUBBER_SNAP_MIN)
      : previewRanges;

    onSelectionChange(finalRanges);

    setRubberState(null);
    setPreviewRanges({});
  }, [rubberState, previewRanges, existingTimeRanges, onSelectionChange]);

  return {
    rubberState,
    previewRanges,
    beginSelection,
    updateSelection,
    endSelection,
    isActive: rubberState?.active || false
  };
}
```

### 4. Components (`apps/calendar/src/components/calendar-view/`)

#### `item-host.tsx` - Universal drag wrapper
```typescript
// Based on reference lines 135-141
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { EventResolved } from '@/lib/data-v2';
import type { DragData } from '@/lib/calendar-drag/types';

export interface ItemHostProps {
  event: EventResolved;
  layout: {
    top: number;
    height: number;
    leftPct: number;
    widthPct: number;
  };
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, eventId: string) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ItemHost({
  event,
  layout,
  selected,
  onMouseDownSelect,
  children,
  className = "",
  style = {}
}: ItemHostProps) {
  // Main drag handle for moving
  const moveHandle = useDraggable({
    id: `move:${event.id}`,
    data: { eventId: event.id, kind: 'move' } as DragData
  });

  return (
    <div
      ref={moveHandle.setNodeRef}
      {...moveHandle.attributes}
      {...moveHandle.listeners}
      className={`absolute calendar-item ${className}`}
      style={{
        top: layout.top,
        height: Math.max(24, layout.height),
        left: `${layout.leftPct}%`,
        width: `${layout.widthPct}%`,
        ...style
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDownSelect(e, event.id);
      }}
    >
      {children}
    </div>
  );
}
```

#### `event-host.tsx` - Event-specific wrapper with resize handles
```typescript
// Based on reference lines 92-118
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { EventResolved } from '@/lib/data-v2';
import type { DragData } from '@/lib/calendar-drag/types';
import { ItemHost, type ItemHostProps } from './item-host';

interface ResizeHandleProps {
  eventId: string;
  edge: 'start' | 'end';
}

function ResizeHandle({ eventId, edge }: ResizeHandleProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `resize:${edge}:${eventId}`,
    data: { eventId, kind: `resize-${edge}` } as DragData
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`absolute left-0 right-0 h-1 cursor-ns-resize hover:bg-white/20 transition-colors z-10 ${
        edge === 'start' ? 'top-0' : 'bottom-0'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

export interface EventHostProps extends Omit<ItemHostProps, 'children'> {
  children: React.ReactNode;
  enableResize?: boolean;
  isDragging?: boolean;
}

export function EventHost({
  event,
  layout,
  selected,
  onMouseDownSelect,
  children,
  enableResize = true,
  isDragging = false,
  className = "",
  style = {}
}: EventHostProps) {
  return (
    <ItemHost
      event={event}
      layout={layout}
      selected={selected}
      onMouseDownSelect={onMouseDownSelect}
      className={`${className} ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-pointer'}`}
      style={style}
    >
      {enableResize && <ResizeHandle eventId={event.id} edge="start" />}
      {children}
      {enableResize && <ResizeHandle eventId={event.id} edge="end" />}
    </ItemHost>
  );
}
```

#### `time-gutter.tsx` - Time column component
```typescript
// Based on reference lines 76-87
import React from 'react';
import { minuteToY } from '@/lib/calendar-grid/geometry';

export interface TimeGutterProps {
  tz: string;
  timeFormat: '12_hour' | '24_hour';
  className?: string;
}

export function TimeGutter({ tz, timeFormat, className = "" }: TimeGutterProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayHeight = minuteToY(24 * 60);

  const formatHour = (hour: number) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);

    return new Intl.DateTimeFormat('en-US', {
      hour: timeFormat === '12_hour' ? 'numeric' : '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12_hour',
      timeZone: tz
    }).format(date);
  };

  return (
    <div
      className={`relative border-r border-border flex-shrink-0 w-14 ${className}`}
      style={{ height: dayHeight }}
    >
      {hours.map(hour => (
        <div
          key={hour}
          className="absolute right-1 text-xs text-muted-foreground select-none"
          style={{ top: minuteToY(hour * 60) - 6 }}
        >
          {formatHour(hour)}
        </div>
      ))}
    </div>
  );
}
```

#### `rubber-band.tsx` - Time selection overlay
```typescript
import React from 'react';
import type { RubberBandState } from '@/hooks/use-rubber-selection';

export interface RubberBandProps {
  state: RubberBandState | null;
  className?: string;
}

export function RubberBand({ state, className = "" }: RubberBandProps) {
  if (!state?.active) return null;

  const width = Math.abs(state.snappedRight - state.snappedLeft);
  const height = Math.abs(state.snappedBottom - state.snappedTop);
  const left = Math.min(state.snappedLeft, state.snappedRight);
  const top = Math.min(state.snappedTop, state.snappedBottom);

  return (
    <div
      className={`absolute bg-blue-400/10 border-2 border-dashed border-blue-400 pointer-events-none z-20 ${className}`}
      style={{ left, top, width, height }}
    />
  );
}
```

#### `drop-preview.tsx` - Drag snap indicator
```typescript
import React from 'react';
import type { PreviewState } from '@/lib/calendar-drag/types';
import { minuteToY, getMinutesFromMidnight } from '@/lib/calendar-grid/geometry';

export interface DropPreviewProps {
  preview: PreviewState | null;
  className?: string;
}

export function DropPreview({ preview, className = "" }: DropPreviewProps) {
  if (!preview) return null;

  const startMinute = getMinutesFromMidnight(preview.start);
  const endMinute = getMinutesFromMidnight(preview.end);
  const top = minuteToY(startMinute);
  const height = Math.max(24, minuteToY(endMinute) - top);

  return (
    <div
      className={`absolute bg-blue-400/20 rounded-lg pointer-events-none z-20 ring-2 ring-blue-400/50 ${className}`}
      style={{
        top,
        height,
        left: '4px',
        right: '4px'
      }}
    />
  );
}
```

## Critical Implementation Details

### EXACT Current Integration Points
- **Event data**: Use `EventResolved` from `@/lib/data-v2`
- **Updates**: Use `updateEventResolved()` and `deleteEventResolved()`
- **Colors**: Use existing `getCategoryColors()` function
- **Context menus**: Keep `EventContextMenu` wrapper
- **AI highlights**: Preserve `TimeHighlights` component
- **Optimistic updates**: Maintain current pattern in calendar-day-range.tsx
- **Outbox**: Use existing `addToOutboxWithMerging()` for deduplication

### EXACT Styling Requirements
- **Selected events**: `ring-2 ring-ring border-ring shadow-lg`
- **Multi-selected**: `ring-4 ring-blue-400 shadow-xl`
- **Dragging**: `opacity-50 cursor-grabbing`
- **Colors**: Use existing `categoryColors.bg`, `categoryColors.text`, `categoryColors.border`
- **Icons**: Keep existing `Video`, `PersonStanding` from lucide-react
- **Spacing**: Maintain `px-1.5 pt-1.5 pb-1` for event content

### EXACT Sensor Configuration
```typescript
useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
```

### EXACT Selection Logic
- **Single click**: Clear all, select one
- **Ctrl/Cmd click**: Toggle individual selection
- **Ctrl/Cmd+A**: Select all events
- **Escape**: Clear all selections
- **Rubber band without Ctrl**: Clear events, select time
- **Rubber band with Ctrl**: Additive selection

This plan provides complete implementation details that prevent drift and ensure consistency with our existing codebase while adopting the proven patterns from the reference implementation.

## Conclusion

This refactor will significantly improve the calendar's architecture while adding powerful new features. By following the proven patterns from the reference implementation and maintaining our existing design system, we'll create a more maintainable and feature-rich calendar component.

The phased approach ensures we can deliver value incrementally while minimizing risk. Each phase builds on the previous one, allowing for testing and validation at each step.