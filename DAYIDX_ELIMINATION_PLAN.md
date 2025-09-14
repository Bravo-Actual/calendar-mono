# DayIdx Elimination Plan

## Problem Statement
The current `dayIdx` system conflates "visual column position" with "data identity", causing:
- ❌ Multi-select mode breaks with non-consecutive days (Tue/Fri)
- ❌ Backend integration nightmare - events need mapping from real dates to visual positions
- ❌ Fragile architecture - changing UI layout breaks data model
- ❌ Time selection creates wrong timestamps in multi-select mode

## Solution Architecture
Replace dayIdx-based system with **date-driven columns** and **time-based filtering**.

### Core Principles
1. **Separation of Concerns**: UI positions ≠ Data identity
2. **Data-Driven Columns**: Define visible days via actual dates
3. **Time-Based Operations**: Filter/match using actual timestamps, not indices
4. **Stable Data Model**: Events/ranges keyed by absolute time

## Implementation Plan

### Phase 1: Interface Changes
#### 1.1 Update CalendarWeekProps
```typescript
export interface CalendarWeekProps {
  // ...existing props...
  /** Explicit columns (supports non-consecutive days) */
  columnDates?: (Date | string | number)[];
}
```

#### 1.2 Remove dayIdx from Core Interfaces
```typescript
// REMOVE dayIdx from:
export interface SelectedTimeRange {
  id: string;
  // dayIdx: number; // ❌ DELETE THIS
  startAbs: number;
  endAbs: number;
}

export interface SystemSlot {
  id: string;
  // dayIdx: number; // ❌ DELETE THIS
  startAbs: number;
  endAbs: number;
  reason?: string;
}

// Keep dayIdx only for UI positioning (PositionedEvent)
export interface PositionedEvent {
  id: string;
  dayIdx: number; // ✅ KEEP - this is pure UI positioning
  rect: { top: number; height: number; leftPct: number; widthPct: number };
}
```

### Phase 2: CalendarWeek Refactor

#### 2.1 Column Model
```typescript
// Replace days-based logic with explicit column dates
const colStarts = useMemo(() => {
  const toStartOfDay = (v: Date | string | number) => {
    const d = typeof v === "number" ? new Date(v) : new Date(v);
    return toZDT(d.getTime(), tz)
      .with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
      .epochMilliseconds;
  };

  if (Array.isArray(columnDates) && columnDates.length > 0) {
    return columnDates.map(toStartOfDay);
  }

  // Default: consecutive days from weekStartMs
  return Array.from({ length: days }, (_, i) =>
    toZDT(weekStartMs + i * DAY_MS, tz)
      .with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
      .epochMilliseconds
  );
}, [columnDates, weekStartMs, days, tz]);

const getDayStartMs = (i: number) => colStarts[i];
```

#### 2.2 Multi-Select Integration
```typescript
// For multi-select mode, pass selectedDates as columnDates
const effectiveColumnDates = isMultiSelectMode && selectedDates.length > 0
  ? selectedDates
  : columnDates;
```

#### 2.3 Event Layout
```typescript
// Replace dayIdx-based layoutDay with date-range-based
const positioned = useMemo(() => {
  const arr: PositionedEvent[] = [];
  for (let dayIdx = 0; dayIdx < colStarts.length; dayIdx++) {
    const dayStart00 = colStarts[dayIdx];
    const dayEnd24 = dayStart00 + DAY_MS;
    const laid = layoutDay(events, dayStart00, dayEnd24, pxPerMs)
      .map(p => ({ ...p, dayIdx })); // dayIdx only for UI positioning
    arr.push(...laid);
  }
  return arr;
}, [events, colStarts, pxPerMs]);
```

#### 2.4 Header Rendering
```typescript
// Dynamic header based on actual dates
<div className="grid pr-2.5"
     style={{ gridTemplateColumns: `72px repeat(${colStarts.length}, 1fr)` }}>
  <div />
  {colStarts.map((dayStartMs, i) => {
    const date = toZDT(dayStartMs, tz);
    const dayNumber = date.day;
    const weekday = date.toLocaleString(undefined, { weekday: "short" });
    return (
      <div key={i} className="px-3 py-2 text-left">
        <div className="text-lg font-semibold leading-tight">{dayNumber}</div>
        <div className="text-sm text-muted-foreground">{weekday}</div>
      </div>
    );
  })}
</div>
```

#### 2.5 DayColumn Rendering
```typescript
// Pass actual dates to DayColumns
{colStarts.map((dayStartMs, dayIdx) => (
  <DayColumn
    key={dayIdx}
    dayIdx={dayIdx}
    days={colStarts.length}
    tz={tz}
    dayStartMs={dayStartMs}                    // NEW: actual date
    getDayStartMs={getDayStartMs}              // NEW: mapper for cross-day ops
    // ...other props...
    systemSlots={
      (systemHighlightSlots ?? [])
        .filter(s => s.endAbs > dayStartMs && s.startAbs < dayStartMs + DAY_MS)
        .concat(systemSlots.filter(s => s.endAbs > dayStartMs && s.startAbs < dayStartMs + DAY_MS))
    }
  />
))}
```

### Phase 3: DayColumn Refactor

#### 3.1 Update Props
```typescript
function DayColumn(props: {
  dayIdx: number;                              // Keep for UI positioning
  days: number;
  tz: string;
  dayStartMs: number;                          // NEW: actual day start
  getDayStartMs: (index: number) => number;    // NEW: mapper for multi-day ops
  // ...other props (unchanged)...
}) {
```

#### 3.2 Remove dayIdx Calculations
```typescript
// BEFORE: Broken calculation
const dayStart00 = toZDT(weekStartMs + dayIdx * DAY_MS, tz)
  .with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;

// AFTER: Use provided actual date
const dayStart00 = props.dayStartMs;
const dayEnd24 = dayStart00 + DAY_MS;
```

#### 3.3 Fix Cross-Day Operations
```typescript
// Rubber band selection with correct dates
for (let i = a; i <= b; i++) {
  const base = props.getDayStartMs(i); // Use mapper instead of calculation
  // ...rest of logic unchanged...
}

// Cross-day drag with correct dates
const targetDayStart00 = props.getDayStartMs(targetDayIdx);
```

#### 3.4 Time-Based Filtering
```typescript
// BEFORE: Filter by dayIdx (broken)
const rangesForDay = (props.timeRanges ?? []).filter((r) => r.dayIdx === dayIdx);
const aiForDay = (aiHighlights ?? []).filter((h) => h.dayIdx === dayIdx);

// AFTER: Filter by time overlap
const rangesForDay = (props.timeRanges ?? [])
  .filter(r => r.endAbs > dayStart00 && r.startAbs < dayEnd24);

const aiForDay = (aiHighlights ?? [])
  .filter(h => {
    // Support both new absolute format and legacy dayIdx format
    if (h.startAbs != null && h.endAbs != null) {
      return h.endAbs > dayStart00 && h.startAbs < dayEnd24;
    }
    // Fallback for legacy format
    return h.dayIdx === dayIdx;
  })
  .map(h => {
    if (h.startAbs != null && h.endAbs != null) {
      return h; // Already absolute
    }
    // Convert legacy format to absolute
    return {
      ...h,
      startAbs: dayStart00 + h.start,
      endAbs: dayStart00 + h.end
    };
  });
```

### Phase 4: Integration Points

#### 4.1 Multi-Select Mode
```typescript
// In your app component, pass selected dates as columnDates
<CalendarWeek
  // ...other props...
  columnDates={isMultiSelectMode ? selectedDates : undefined}
/>
```

#### 4.2 Backend Integration
```typescript
// Events from backend (already have real timestamps)
const backendEvents = [
  { id: "1", title: "Meeting", start: 1705392000000, end: 1705395600000 }, // Jan 16 9-10am
  { id: "2", title: "Call", start: 1705478400000, end: 1705482000000 },    // Jan 17 9-10am
];

// Time ranges to backend (already have real timestamps)
const timeRangesToSave = timeRanges.map(r => ({
  start: new Date(r.startAbs).toISOString(),
  end: new Date(r.endAbs).toISOString()
}));
```

## Migration Strategy

### Step 1: Add New Props (Non-Breaking)
- Add `columnDates` prop to CalendarWeek
- Add `dayStartMs` and `getDayStartMs` to DayColumn
- Keep existing dayIdx logic as fallback

### Step 2: Update Filtering Logic
- Replace dayIdx filtering with time-based filtering
- Support both formats during transition

### Step 3: Remove dayIdx Dependencies
- Remove dayIdx from SelectedTimeRange and SystemSlot interfaces
- Remove dayIdx calculations in DayColumn
- Clean up dead code

### Step 4: Integration Testing
- Test regular week view (should work exactly as before)
- Test multi-select mode (should work correctly now)
- Test cross-day selections (Ctrl+Shift+drag)
- Test backend integration scenarios

## Benefits After Implementation

### ✅ Fixed Issues
- Multi-select mode works with non-consecutive days
- Backend integration is trivial (no mapping needed)
- Stable data model that doesn't break when UI changes
- Time selections create correct timestamps

### ✅ New Capabilities
- Custom date ranges (Mon/Wed/Fri, sprint views, etc.)
- Flexible calendar layouts
- Easy backend binding
- Scalable architecture

### ✅ Preserved Features
- All existing functionality (drag, resize, multi-day select)
- Same UI/UX behavior
- Same performance characteristics
- Backward compatibility during transition

## File Changes Required

### Core Files
- `src/components/types.ts` - Remove dayIdx from interfaces
- `src/components/calendar-week.tsx` - Column model + rendering
- `src/components/day-column.tsx` - Props + filtering logic

### Test Files
- Add tests for non-consecutive date scenarios
- Add tests for time-based filtering
- Verify backward compatibility

## Risk Assessment

### Low Risk ✅
- Well-defined interfaces
- Clear separation of concerns
- Incremental migration path
- Extensive testing plan

### Mitigation
- Keep dayIdx for UI positioning (PositionedEvent)
- Support legacy format during transition
- Comprehensive test coverage
- Rollback plan if needed

## Timeline Estimate
- **Phase 1**: 2-3 hours (Interface changes)
- **Phase 2**: 3-4 hours (CalendarWeek refactor)
- **Phase 3**: 2-3 hours (DayColumn refactor)
- **Phase 4**: 1-2 hours (Integration testing)
- **Total**: 8-12 hours

This refactor will solve the fundamental architectural issues and enable proper backend integration while preserving all existing functionality.