# Event CRUD Consolidation Plan

## Problem Statement
We have multiple event CRUD functions scattered across the codebase instead of using our official data layer. This creates maintenance nightmares, inconsistent behavior, and bugs like the discovery field not saving.

## Current Mess (What We Found)

### 1. Official Data Layer Functions (GOOD - in right place, BUT...)
- **File**: `src/lib/data/queries.ts`
- **Functions**:
  - `useCreateCalendarEvent()` - missing auth context, weird viewing_user_id interface
  - `useUpdateCalendarEvent()` - missing auth context, weird viewing_user_id interface
  - `useDeleteCalendarEvent()` - missing auth context, no owner checks
- **Status**: Properly structured with Dexie integration, but interface issues
- **Usage**: NOT USED ANYWHERE (wtf!)

### 2. Rogue Hooks 🔥 (BAD - shouldn't exist)
- **Files**:
  - `src/hooks/use-create-event.ts` - `useCreateEvent()`
  - `src/hooks/use-update-event.ts` - `useUpdateEvent()`
  - `src/hooks/use-delete-event.ts` - `useDeleteEvent()`
- **Status**: Have good auth/owner logic but bypass official data layer
- **Usage**: All used by `calendar/page.tsx`
- **Problem**: Bypasses official data layer architecture

### 3. Wrapper Functions (need updating)
- **File**: `src/app/calendar/page.tsx`
- **Functions**:
  - `handleEventDetailsUpdate()` - single event updates
  - `handleUpdateEvents()` - bulk updates
  - `handleEventsChange()` - drag & drop updates
- **Status**: Currently call rogue hooks instead of data layer

## Consolidation Strategy

### Phase 1: Audit & Prepare ✅ DONE
- [x] Identify all CRUD functions (found 3x more than expected!)
- [x] Map dependencies
- [x] Check which functions are actually used
- [x] Discover architectural violations
- [x] Create comprehensive audit reports

### Phase 2: Fix Official Data Layer Functions ✅ DONE
**Goal**: Make official functions work properly with auth context and clean interfaces

#### Step 2.1: Add Auth Context & Clean Interfaces
- [x] Add `useAuth()` context to all official functions
- [x] Remove weird `viewing_user_id` interface requirements
- [x] Use authenticated user automatically
- [x] Keep existing Dexie offline-first patterns intact

#### Step 2.2: Add Owner Checks Where Needed
- [x] Add owner checks for delete operations (only owner can delete)
- [x] Add owner checks for core event updates (only owner can update title, agenda, etc.)
- [x] Allow any user to update their personal event details

### Phase 3: Switch Imports (Gradual Migration)
**Goal**: Switch to official function without breaking anything

#### Step 3.1: Update Calendar Page Imports
- [ ] Change `calendar/page.tsx` import from rogue hook to official data layer
- [ ] Test single event updates work
- [ ] Test bulk event updates work
- [ ] Test discovery field saving works

#### Step 3.2: Update Wrapper Functions
- [ ] Modify `handleEventDetailsUpdate()` to work with official function interface
- [ ] Modify `handleUpdateEvents()` to work with official function interface
- [ ] Ensure all field mappings still work

### Phase 4: Test & Verify
**Goal**: Make sure everything still works

#### Step 4.1: Functional Testing
- [ ] Test event details panel saves (discovery, join_model, etc.)
- [ ] Test bulk operations from action bar
- [ ] Test drag & drop updates
- [ ] Test all event fields save properly
- [ ] Test user_option fields save properly

#### Step 4.2: Integration Testing
- [ ] Test real-time updates work
- [ ] Test cache invalidation works
- [ ] Test optimistic updates work
- [ ] Test error handling works

### Phase 5: Cleanup 🧹
**Goal**: Remove all the bullshit

#### Step 5.1: Delete Rogue Files
- [ ] Delete `src/hooks/use-update-event.ts`
- [ ] Remove any imports of deleted hook
- [ ] Update any TypeScript that references old types

#### Step 5.2: Cleanup Wrapper Functions
- [ ] Simplify wrapper functions now that they use official data layer
- [ ] Remove unnecessary field mapping code
- [ ] Add proper error handling

#### Step 5.3: Documentation
- [ ] Update any documentation that referenced old functions
- [ ] Add comments explaining proper data layer usage
- [ ] Document the official update function interface

## Risk Mitigation

### High Risk Items
1. **Breaking event updates during migration**
   - Mitigation: Test each step thoroughly before proceeding
   - Rollback: Keep rogue hook until official one proven working

2. **Field mapping differences between functions**
   - Mitigation: Compare interfaces carefully in Step 2.1
   - Rollback: Fix official function before switching

3. **Cache invalidation issues**
   - Mitigation: Test real-time updates in Step 4.2
   - Rollback: Check onSuccess handlers match

### Testing Strategy
- Test after each step, not just at the end
- Keep browser console open to catch errors
- Test with real events, not just mock data
- Test both successful updates and error cases

## Files That Will Change

### Modified Files
- `src/lib/data/queries.ts` - enhance official function (maybe)
- `src/app/calendar/page.tsx` - switch imports, update wrappers
- Any other files importing the rogue hook (unlikely)

### Deleted Files
- `src/hooks/use-update-event.ts` - the rogue hook

### Files to Check
- `src/components/event-details-panel.tsx` - make sure still works
- `src/components/calendar-day-range.tsx` - bulk operations
- Any other components that update events

## Success Criteria
- [ ] All event fields save properly (including discovery/join_model)
- [ ] Bulk operations still work
- [ ] No duplicate update functions exist
- [ ] All updates go through official data layer
- [ ] No broken imports or TypeScript errors
- [ ] Real-time updates still work
- [ ] Cache invalidation still works

## Rollback Plan
If anything breaks during migration:
1. Restore the rogue hook file
2. Revert import changes in calendar/page.tsx
3. Test that original functionality restored
4. Analyze what went wrong before trying again

---

*This plan ensures we fix the architectural mess without breaking the app. Each step is small and testable.*