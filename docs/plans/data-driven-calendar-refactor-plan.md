# Data-Driven Calendar Components Refactor Plan

## 🎯 Goals

### Primary Goals
1. **Eliminate Prop Drilling**: Remove callback props and use data layer hooks directly
2. **Fix TypeScript Build**: Resolve `onUpdateEvent` type mismatch causing build failures
3. **Improve Reactivity**: Components automatically update when data changes
4. **Simplify Architecture**: Reduce complexity by 30%+ lines of prop-passing code

### Secondary Goals
1. **Align with Universal Calendar Vision**: Components become self-contained, reusable
2. **Better Performance**: Fewer re-renders from prop changes
3. **Easier Testing**: Components can be tested in isolation
4. **Future-Proof**: Foundation for universal time-based object host

## 📊 Current State Analysis

### Problems
- **Type Mismatch**: `CalendarDayRange` receives `onUpdateEvent?` (optional) but `DayColumn` expects `onUpdateEvent` (required)
- **Prop Drilling**: 8+ callback props passed through multiple component layers
- **Coupling**: Components tightly coupled to parent's callback implementations
- **Build Failure**: TypeScript compilation errors blocking deployment

### Existing Assets
- ✅ **Data Layer**: Complete with `useEventsRange`, `useUpdateEvent`, etc.
- ✅ **React Query**: Proper caching and invalidation setup
- ✅ **Optimistic Updates**: Already implemented in mutation hooks
- ✅ **Type Safety**: Strong TypeScript types for all data operations

## 🛠 Implementation Plan

### Phase 1: Update Type Definitions (5 minutes)

**File**: `apps/calendar/src/components/calendar-view/types.ts`

**Changes**:
```typescript
// REMOVE these callback props from CalendarDayRangeProps:
- onEventsChange?: (next: CalendarEvent[]) => void;
- onSelectChange?: (ids: EventId[]) => void;
- onCreateEvents?: (ranges: SelectedTimeRange[]) => void;
- onDeleteEvents?: (ids: EventId[]) => void;
- onUpdateEvents?: (ids: EventId[], updates: Partial<CalendarEvent>) => void;
- onUpdateEvent?: (updates: { id: string; start_time: string; end_time: string }) => void;

// KEEP these essential props:
- events?: CalendarEvent[]; // still support controlled mode
- userCategories?: ClientCategory[];
- userCalendars?: ClientCalendar[];
- onEventDoubleClick?: (event: CalendarEvent) => void; // UI interaction, not data mutation
```

### Phase 2: Refactor DayColumn Component (10 minutes)

**File**: `apps/calendar/src/components/calendar-view/day-column.tsx`

**Changes**:
1. **Add Data Hooks**:
```typescript
import { useUpdateEvent } from '@/lib/data/domains/events';
import { useAuth } from '@/contexts/AuthContext';

// Inside component:
const { user } = useAuth();
const updateEvent = useUpdateEvent(user?.id);
```

2. **Replace Callback Usage**:
```typescript
// BEFORE:
onUpdateEvent({
  id: evt.id,
  start_time: new Date(nextStart).toISOString(),
  end_time: new Date(nextEnd).toISOString(),
});

// AFTER:
updateEvent.mutate({
  id: evt.id,
  event: {
    start_time: new Date(nextStart).toISOString(),
    end_time: new Date(nextEnd).toISOString(),
  }
});
```

3. **Remove Props**:
```typescript
// REMOVE from props interface and destructuring:
- onUpdateEvent: (updates: { id: string; start_time: string; end_time: string }) => void;
```

### Phase 3: Refactor CalendarDayRange Component (15 minutes)

**File**: `apps/calendar/src/components/calendar-view/calendar-day-range.tsx`

**Changes**:
1. **Add Data Hooks**:
```typescript
import {
  useUpdateEvent,
  useDeleteEvent,
  useCreateEvent,
  useUpdateEventCategory,
  useUpdateEventCalendar,
  useUpdateEventShowTimeAs,
  useUpdateEventOnlineMeeting,
  useUpdateEventInPerson
} from '@/lib/data/domains/events';

// Inside component:
const updateEvent = useUpdateEvent(user?.id);
const deleteEvent = useDeleteEvent(user?.id);
const createEvent = useCreateEvent(user?.id);
const updateEventCategory = useUpdateEventCategory(user?.id);
const updateEventCalendar = useUpdateEventCalendar(user?.id);
const updateEventShowTimeAs = useUpdateEventShowTimeAs(user?.id);
const updateEventOnlineMeeting = useUpdateEventOnlineMeeting(user?.id);
const updateEventInPerson = useUpdateEventInPerson(user?.id);
```

2. **Update Handler Functions**:
```typescript
// BEFORE:
const handleUpdateCategory = (categoryId: string) => {
  if (onUpdateEvents) {
    onUpdateEvents(Array.from(selectedEventIds), { category: { id: categoryId } });
  }
};

// AFTER:
const handleUpdateCategory = (categoryId: string) => {
  selectedEventIds.forEach(eventId => {
    updateEventCategory.mutate({ eventId, categoryId });
  });
};
```

3. **Remove Callback Props**:
```typescript
// REMOVE from props destructuring:
- onEventsChange,
- onSelectChange,
- onCreateEvents,
- onDeleteEvents,
- onUpdateEvents,
- onUpdateEvent,

// REMOVE from DayColumn props:
- onUpdateEvent={onUpdateEvent}
```

4. **Update Event Creation**:
```typescript
const handleCreateEvents = (ranges: SelectedTimeRange[]) => {
  ranges.forEach(range => {
    createEvent.mutate({
      title: "New Event",
      start_time: new Date(range.start).toISOString(),
      end_time: new Date(range.end).toISOString(),
    });
  });
};
```

### Phase 4: Refactor ActionBar Component (5 minutes)

**File**: `apps/calendar/src/components/action-bar.tsx`

**Changes**:
1. **Remove Unused Imports**: ActionBar already imports the data hooks but doesn't use them
2. **Use Direct Hooks**: Replace any callback-based operations with direct hook usage
3. **Clean Up Props**: Remove any callback props that are no longer needed

### Phase 5: Update Calendar Page (5 minutes)

**File**: `apps/calendar/src/app/calendar/page.tsx`

**Changes**:
```typescript
// REMOVE callback prop passing:
<CalendarDayRange
  // Remove all these:
  - onEventsChange={handleEventsChange}
  - onSelectChange={handleSelectChange}
  - onCreateEvents={handleCreateEvents}
  - onDeleteEvents={handleDeleteEvents}
  - onUpdateEvents={handleUpdateEvents}
  - onUpdateEvent={handleUpdateEvent}

  // Keep essential props:
  userCategories={userCategories}
  userCalendars={userCalendars}
  onEventDoubleClick={handleEventDoubleClick}
/>
```

## 🔍 Testing Strategy

### Unit Tests
1. **DayColumn**: Test drag/drop operations trigger correct mutations
2. **CalendarDayRange**: Test bulk operations use correct hooks
3. **ActionBar**: Test all actions use data layer directly

### Integration Tests
1. **Event Updates**: Verify UI updates when data changes
2. **Optimistic Updates**: Confirm immediate UI feedback
3. **Error Handling**: Test mutation failures and rollbacks

### Manual Testing Checklist
- [ ] Drag event to new time → event updates in database
- [ ] Select multiple events → bulk operations work
- [ ] Change category via action bar → UI updates immediately
- [ ] Create new event → appears in calendar instantly
- [ ] Delete event → removes from UI and database
- [ ] Online meeting toggle → saves correctly

## 📋 Implementation Checklist

### Phase 1: Types (5 min)
- [ ] Remove callback props from `CalendarDayRangeProps`
- [ ] Keep essential UI props
- [ ] Update JSDoc comments

### Phase 2: DayColumn (10 min)
- [ ] Add data hook imports
- [ ] Add `useUpdateEvent` hook usage
- [ ] Replace `onUpdateEvent` calls with mutation
- [ ] Remove callback props from interface
- [ ] Test drag/drop functionality

### Phase 3: CalendarDayRange (15 min)
- [ ] Add all necessary data hook imports
- [ ] Update all handler functions to use hooks
- [ ] Remove callback prop destructuring
- [ ] Remove callback props from DayColumn
- [ ] Update event creation logic
- [ ] Test bulk operations

### Phase 4: ActionBar (5 min)
- [ ] Clean up unused imports
- [ ] Ensure direct hook usage
- [ ] Remove callback props

### Phase 5: Calendar Page (5 min)
- [ ] Remove callback prop passing
- [ ] Keep essential props only
- [ ] Test full integration

### Phase 6: Final Verification
- [ ] TypeScript compilation passes
- [ ] All tests pass
- [ ] Manual testing complete
- [ ] Performance check (fewer re-renders)

## 🎉 Expected Outcomes

### Immediate Benefits
- ✅ **Build Success**: TypeScript compilation errors resolved
- ✅ **Simpler Code**: ~100 lines of prop-passing code removed
- ✅ **Better Performance**: Fewer unnecessary re-renders
- ✅ **Type Safety**: Consistent typing throughout

### Long-term Benefits
- ✅ **Universal Calendar Ready**: Components are self-contained and reusable
- ✅ **Easier Maintenance**: Direct data layer usage is more predictable
- ✅ **Better Testing**: Components can be tested in isolation
- ✅ **Future Extensibility**: Easy to add new event types and behaviors

### Metrics
- **Code Reduction**: ~30% fewer lines in component prop interfaces
- **Coupling Reduction**: Components no longer depend on parent callbacks
- **Build Time**: Faster TypeScript compilation
- **Developer Experience**: Clearer data flow and debugging

## 🚀 Rollout Strategy

### Step 1: Feature Branch
```bash
git checkout -b refactor/data-driven-components
```

### Step 2: Incremental Implementation
- Implement phases 1-2 first (types + DayColumn)
- Test basic functionality works
- Continue with phases 3-5
- Full integration testing

### Step 3: Quality Gates
- [ ] TypeScript compilation passes
- [ ] All existing tests pass
- [ ] Manual testing complete
- [ ] Performance regression check

### Step 4: Merge & Deploy
- Create PR with comprehensive testing evidence
- Code review focusing on data flow
- Merge to main and deploy

## 📝 Risk Mitigation

### Potential Risks
1. **Breaking Changes**: Component API changes might affect consumers
2. **Data Inconsistency**: Race conditions in concurrent mutations
3. **Performance**: Multiple hooks might cause over-fetching

### Mitigation Strategies
1. **Backward Compatibility**: Keep essential props for external consumers
2. **Optimistic Updates**: Existing React Query setup handles race conditions
3. **Query Optimization**: Data hooks already implement proper caching

### Rollback Plan
- Keep feature branch until confirmed stable
- Original callback-based system preserved in git history
- Can revert individual phases if needed

---

**Total Estimated Time: 40 minutes implementation + 20 minutes testing = 1 hour**

**Risk Level: Low** (existing data layer is proven, just changing how it's consumed)

**Impact Level: High** (fixes build, simplifies architecture, enables future features)