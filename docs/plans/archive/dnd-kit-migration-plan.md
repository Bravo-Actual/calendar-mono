# Calendar Drag & Drop Migration Plan: Custom → dnd-kit

## Problem Statement

The current custom drag/drop implementation in `CalendarDayRange` has multiple overlapping event handlers causing duplicate outbox entries and complex state management issues. Each drag operation triggers multiple `onPointerUpColumn` calls, leading to duplicate database writes.

## Solution Overview

Migrate from custom pointer event handling to **dnd-kit** library following the architectural patterns from the provided example code. This will provide:

- Single `onDragEnd` callback (eliminates duplicate outbox entries)
- Clean separation of drag logic from business logic
- Better accessibility and keyboard support
- Preserved complex calendar behaviors (rubber band, ctrl+click, AI highlights)

## Architecture Analysis: Example Code Patterns

The provided example demonstrates several key patterns we should adopt:

### 1. Pure Function Architecture
```typescript
// core/drag.ts - Pure reducers
export function begin(ids: ID[], kind: DragKind, anchorStart: Date, anchorEnd: Date): DragState
export function hover(s: DragState, deltaMinutes: number): DragState
export function propose(s: DragState, g: CalendarGeometry, ctx?: ConstraintCtx): DragProposal | null
```

### 2. Single Callback Pattern
```typescript
// components/CalendarHost.tsx
function onDragEnd(e: DragEndEvent) {
  const proposal = propose(drag, geometry, constraintCtx);
  if (proposal) onCommit(proposal); // SINGLE DATABASE CALL
}
```

### 3. Preview State During Drag
```typescript
const [preview, setPreview] = useState<Record<ID, { start: string; end: string }>>({});
// Show visual feedback without database writes until drag completes
```

### 4. Adapter Pattern for Data Layer
```typescript
// adapters/dexie.ts
export async function commitProposal(p: DragProposal) {
  for (const id of p.ids) {
    await updateEventResolved(id, { start_time: p.newStart, end_time: p.newEnd });
  }
}
```

### 5. Resize Handle Strategy
```typescript
// Resize handles via data attributes instead of separate event handlers
<div data-drag-id={`resize:start:${item.id}`} className="resize-handle" />
```

## Migration Strategy: 3-Phase Approach

### Phase 1: Core dnd-kit Integration (Minimal Changes)
**Goal**: Replace custom drag/drop with dnd-kit while preserving ALL existing behaviors

#### 1.1 Install Dependencies
```bash
pnpm add @dnd-kit/core @dnd-kit/modifiers @dnd-kit/utilities
```

#### 1.2 Create Core Drag Utilities
**File**: `src/lib/calendar-drag/types.ts`
```typescript
export type DragKind = 'move' | 'resize-start' | 'resize-end';

export interface DragProposal {
  type: 'move' | 'resize';
  eventId: string;
  newStartTime: Date;
  newEndTime: Date;
}

export interface CalendarGeometry {
  pxPerMs: number;
  snapStep: number;
  minDurMs: number;
  yToLocalMs: (y: number) => number;
  localMsToY: (ms: number) => number;
}
```

**File**: `src/lib/calendar-drag/drag-utils.ts`
```typescript
import type { DragProposal, CalendarGeometry } from './types';
import type { EventResolved } from '@/lib/data-v2';

export function calculateDragProposal(
  event: EventResolved,
  dragKind: DragKind,
  deltaMs: number,
  geometry: CalendarGeometry
): DragProposal {
  // Pure function - no side effects
  // Calculate new start/end times based on drag delta
}

export function applyTimeConstraints(
  startTime: Date,
  endTime: Date,
  geometry: CalendarGeometry
): { start: Date; end: Date } {
  // Apply minimum duration, snap to grid, etc.
}
```

#### 1.3 Wrap Calendar in DndContext
**File**: `src/components/calendar-view/calendar-day-range.tsx` (modify existing)

```typescript
import { DndContext, DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core';

export function CalendarDayRange(props: CalendarDayRangeProps) {
  // ... existing state ...

  const [dragState, setDragState] = useState<{
    eventId: string;
    kind: DragKind;
    originalEvent: EventResolved;
  } | null>(null);

  const [previewTimes, setPreviewTimes] = useState<Record<string, {
    start: Date;
    end: Date;
  }>>({});

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { eventId: string; kind: DragKind };
    const originalEvent = events.find(e => e.id === data.eventId);
    if (!originalEvent) return;

    setDragState({
      eventId: data.eventId,
      kind: data.kind,
      originalEvent
    });
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!dragState || !event.over) return;

    // Calculate preview position
    const deltaMs = calculateDeltaFromPointer(event, geometry);
    const proposal = calculateDragProposal(
      dragState.originalEvent,
      dragState.kind,
      deltaMs,
      geometry
    );

    setPreviewTimes({
      [dragState.eventId]: {
        start: proposal.newStartTime,
        end: proposal.newEndTime
      }
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!dragState || !event.over) {
      setDragState(null);
      setPreviewTimes({});
      return;
    }

    // SINGLE DATABASE UPDATE - This solves the duplicate outbox issue
    try {
      const deltaMs = calculateDeltaFromPointer(event, geometry);
      const proposal = calculateDragProposal(
        dragState.originalEvent,
        dragState.kind,
        deltaMs,
        geometry
      );

      console.log('🎯 Single drag end - updating event:', proposal);

      await updateEventResolved(user!.id, proposal.eventId, {
        start_time: proposal.newStartTime,
        end_time: proposal.newEndTime
      });

    } catch (error) {
      console.error('Drag update failed:', error);
    } finally {
      setDragState(null);
      setPreviewTimes({});
    }
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* Existing calendar content - UNCHANGED */}
      {/* All rubber band, ctrl+click, AI highlights remain exactly the same */}
    </DndContext>
  );
}
```

#### 1.4 Convert EventCard to Use dnd-kit
**File**: `src/components/calendar-view/event-card-content.tsx` (replace drag handlers)

```typescript
import { useDraggable } from '@dnd-kit/core';

export function EventCardContent(props: EventCardContentProps) {
  const moveAttributes = useDraggable({
    id: `move:${props.event.id}`,
    data: { eventId: props.event.id, kind: 'move' }
  });

  const resizeStartAttributes = useDraggable({
    id: `resize-start:${props.event.id}`,
    data: { eventId: props.event.id, kind: 'resize-start' }
  });

  const resizeEndAttributes = useDraggable({
    id: `resize-end:${props.event.id}`,
    data: { eventId: props.event.id, kind: 'resize-end' }
  });

  // Use preview times if available, otherwise use actual event times
  const displayStartTime = previewTimes[props.event.id]?.start || props.event.start_time;
  const displayEndTime = previewTimes[props.event.id]?.end || props.event.end_time;

  return (
    <div className="event-card-content">
      {/* Top resize handle */}
      <div
        ref={resizeStartAttributes.setNodeRef}
        {...resizeStartAttributes.listeners}
        {...resizeStartAttributes.attributes}
        className="resize-handle-top"
      />

      {/* Main content area */}
      <div
        ref={moveAttributes.setNodeRef}
        {...moveAttributes.listeners}
        {...moveAttributes.attributes}
        className="event-content"
        onClick={props.onSelect} // Preserve click behavior
      >
        {/* Existing event content */}
      </div>

      {/* Bottom resize handle */}
      <div
        ref={resizeEndAttributes.setNodeRef}
        {...resizeEndAttributes.listeners}
        {...resizeEndAttributes.attributes}
        className="resize-handle-bottom"
      />
    </div>
  );
}
```

#### 1.5 Add Drop Zones to Day Columns
**File**: `src/components/calendar-view/day-column.tsx` (add droppable)

```typescript
import { useDroppable } from '@dnd-kit/core';

export function DayColumn(props: DayColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `day-${props.dayIdx}`,
    data: {
      dayIdx: props.dayIdx,
      dayStartMs: props.dayStartMs,
      geometry: {
        pxPerMs: props.pxPerMs,
        snapStep: props.snapStep,
        yToLocalMs: props.yToLocalMs,
        localMsToY: props.localMsToY
      }
    }
  });

  return (
    <div ref={setNodeRef} className="day-column">
      {/* ALL EXISTING CONTENT UNCHANGED */}
      {/* Rubber band selection - keep exactly as is */}
      {/* Event cards - now use dnd-kit but look the same */}
      {/* Time highlights - unchanged */}
      {/* System slots - unchanged */}
    </div>
  );
}
```

#### 1.6 Remove Old Drag Handlers
**Files to clean up**:
- Remove all `onPointerDown/Move/Up` handlers from event cards
- Remove `DragState` from day-column.tsx (replaced by dnd-kit state)
- Remove custom drag logic in `onPointerUpColumn` function

### Phase 2: Enhanced Features (Optional)
**Goal**: Add advanced dnd-kit features while maintaining compatibility

#### 2.1 Multi-Select Drag
```typescript
// Drag multiple selected events simultaneously
const selectedEventIds = Array.from(selectedEventIds);
if (selectedEventIds.includes(draggedEventId)) {
  // Move all selected events by the same delta
}
```

#### 2.2 Auto-scroll During Drag
```typescript
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

<DndContext
  modifiers={[restrictToVerticalAxis]}
  // Auto-scroll when dragging near edges
>
```

#### 2.3 Collision Detection
```typescript
import { closestCenter } from '@dnd-kit/core';

<DndContext collisionDetection={closestCenter}>
```

### Phase 3: Testing & Validation
**Goal**: Ensure all behaviors work correctly

#### 3.1 Functional Tests
- [ ] Single event drag creates only one outbox entry
- [ ] Event resize works correctly
- [ ] Multi-day drag works
- [ ] Rubber band selection unchanged
- [ ] Ctrl+click selection unchanged
- [ ] AI highlights display correctly
- [ ] Keyboard shortcuts work
- [ ] Performance is acceptable

#### 3.2 Integration Tests
- [ ] Offline-first pattern still works
- [ ] Database sync works correctly
- [ ] Error handling for failed drags
- [ ] Optimistic updates work

## Files to Modify

### New Files
```
src/lib/calendar-drag/
├── types.ts              # Drag types and interfaces
├── drag-utils.ts         # Pure drag calculation functions
├── geometry.ts           # Calendar geometry utilities
└── index.ts              # Export all

src/components/calendar-view/
├── drag-context.tsx      # DndContext wrapper (optional)
└── drop-zone.tsx         # Reusable drop zone component (optional)
```

### Modified Files
```
src/components/calendar-view/
├── calendar-day-range.tsx    # Add DndContext, remove custom drag
├── day-column.tsx            # Add useDroppable, remove pointer handlers
├── event-card-content.tsx    # Replace with useDraggable
├── event-card.tsx            # Simplify (remove drag handlers)
└── types.ts                  # Remove old DragState, add new types
```

### Removed/Cleaned Files
- Remove custom drag logic from `onPointerUpColumn`
- Remove `dragProcessingRef` and related hacks
- Clean up unused drag-related state

## Benefits After Migration

### Immediate Fixes
- ✅ **No more duplicate outbox entries** - single `onDragEnd` callback
- ✅ **Cleaner code** - remove complex pointer event handling
- ✅ **Better accessibility** - dnd-kit handles keyboard navigation
- ✅ **More reliable** - battle-tested library vs custom implementation

### Preserved Features
- ✅ **Rubber band selection** - completely unchanged
- ✅ **Ctrl+click multi-select** - completely unchanged
- ✅ **AI time highlights** - completely unchanged
- ✅ **Visual styling** - all CSS classes preserved
- ✅ **Complex calendar behaviors** - all preserved

### Future Opportunities
- 🚀 **Multi-select drag** - drag multiple events at once
- 🚀 **Auto-scroll** - smooth scrolling during drag
- 🚀 **Better collision detection** - smart drop zones
- 🚀 **Keyboard drag** - accessibility improvements
- 🚀 **Touch support** - mobile drag/drop

## Risk Mitigation

### Low Risk Changes
- Phase 1 changes are **additive** - old behaviors preserved
- Can be implemented incrementally
- Easy to rollback if issues arise

### Testing Strategy
1. **Unit tests** for pure drag calculation functions
2. **Integration tests** for database interactions
3. **Manual testing** of all existing behaviors
4. **Performance testing** to ensure no regressions

### Rollback Plan
- Keep old drag handlers commented out during Phase 1
- Feature flag to switch between old/new systems
- Can revert individual components if needed

## Timeline Estimate

- **Phase 1 (Core Migration)**: 3-5 days
  - Day 1: Install dnd-kit, create utilities
  - Day 2-3: Convert EventCard and DayColumn
  - Day 4-5: Test and fix issues

- **Phase 2 (Enhancements)**: 2-3 days (optional)
- **Phase 3 (Testing)**: 2-3 days

**Total**: 1-2 weeks for complete migration

## Success Criteria

1. ✅ **Zero duplicate outbox entries** on any drag operation
2. ✅ **All existing calendar behaviors preserved** (rubber band, ctrl+click, etc.)
3. ✅ **Performance equal or better** than current implementation
4. ✅ **No visual regressions** - calendar looks identical
5. ✅ **Better accessibility** - keyboard navigation works
6. ✅ **Cleaner codebase** - less complex event handling

This migration follows the architectural patterns from the provided example code while preserving all existing calendar functionality. The key insight is using dnd-kit's single callback pattern to eliminate the duplicate outbox issue while keeping everything else unchanged.