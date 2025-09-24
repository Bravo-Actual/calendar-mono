# Phase 1 Audit Results - Event Update Functions

## Executive Summary
We found **4 main event update functions** plus several wrapper/helper functions. The architecture is fucked because we have functions doing the same thing in different places.

## Main Event Update Functions

### 1. `useUpdateEvent()` 🔥 ROGUE HOOK
- **File**: `src/hooks/use-update-event.ts`
- **Purpose**: Update events (both events table + event_details_personal)
- **Used by**: `src/app/calendar/page.tsx` (main calendar)
- **Interface**: `UpdateEventInput` (custom interface)
- **Status**: Currently active, recently patched to include discovery/join_model
- **Problem**: Bypasses official data layer

### 2. `useUpdateCalendarEvent()` ✅ OFFICIAL DATA LAYER
- **File**: `src/lib/data/queries.ts`
- **Purpose**: Update events (same as above)
- **Used by**: NOBODY! (dead code)
- **Interface**: `{ id: string; updates: Partial<CalendarEvent> }`
- **Status**: Complete, handles all fields correctly
- **Problem**: Not being used despite being in official data layer

### 3. `useUpdateEventCalendar()` ✅ LEGITIMATE
- **File**: `src/hooks/use-user-calendars.ts`
- **Purpose**: Update user calendars (NOT events - confusing name)
- **Used by**: `src/components/user-calendars-settings.tsx`
- **Status**: This one is fine, just confusing name

### 4. `useUpdateEventCategory()` ✅ LEGITIMATE
- **File**: `src/hooks/use-event-categories.ts`
- **Purpose**: Update user categories (NOT events - confusing name)
- **Used by**: Various settings components
- **Status**: This one is fine, just confusing name

## Wrapper Functions in Calendar Page

### 1. `handleEventDetailsUpdate()`
- **File**: `src/app/calendar/page.tsx:302`
- **Purpose**: Convert CalendarEvent updates to UpdateEventInput format
- **Calls**: `useUpdateEvent()` (the rogue one)
- **Status**: Needs to be updated to call official data layer

### 2. `handleUpdateEvents()`
- **File**: `src/app/calendar/page.tsx` (around line 260)
- **Purpose**: Bulk update multiple events
- **Calls**: `useUpdateEvent()` (the rogue one)
- **Status**: Needs to be updated to call official data layer

### 3. `handleEventsChange()`
- **File**: `src/app/calendar/page.tsx` (around line 178)
- **Purpose**: Handle drag & drop updates
- **Calls**: `useUpdateEvent()` (the rogue one)
- **Status**: Needs to be updated to call official data layer

## Helper/Local Functions (OK)
These are legitimate helper functions, not main update functions:

- `updateSelectedEventsContext()` in calendar-day-range.tsx
- `updateSelection()` in calendar-day-range.tsx
- Various local `updated = events.map()` transformations

## Import Dependency Map

```
calendar/page.tsx
├── imports useUpdateEvent from hooks/use-update-event.ts ❌ WRONG
├── calls handleEventDetailsUpdate()
├── calls handleUpdateEvents()
└── calls handleEventsChange()

user-calendars-settings.tsx
└── imports useUpdateEventCalendar from hooks/use-user-calendars.ts ✅ OK

lib/data/queries.ts
└── exports useUpdateCalendarEvent() ✅ OFFICIAL BUT UNUSED

hooks/use-update-event.ts
└── exports useUpdateEvent() ❌ ROGUE HOOK
```

## Key Problems Identified

### 1. Wrong Import Path
- Main calendar imports from `hooks/` instead of `lib/data/`
- This bypasses our official data layer architecture

### 2. Duplicate Functionality
- `useUpdateEvent()` and `useUpdateCalendarEvent()` do the same thing
- Both handle event table + user_details_personal table updates
- Both have similar but slightly different interfaces

### 3. Dead Code
- `useUpdateCalendarEvent()` in data layer is never used
- This is our official function but it's orphaned

### 4. Confusing Names
- `useUpdateEventCalendar()` sounds like it updates events, but it updates calendars
- `useUpdateEventCategory()` sounds like it updates events, but it updates categories

## Risk Assessment

### High Risk
- **Main calendar functionality** depends on rogue hook
- **All event updates** currently go through wrong path
- **Discovery field bug** was caused by this architecture

### Medium Risk
- Bulk operations might have different behavior
- Cache invalidation might work differently between functions

### Low Risk
- Calendar/category updates are working fine (using correct hooks)

## Migration Complexity

### Easy to Fix
- Switch import in calendar/page.tsx
- Update wrapper function interfaces

### Medium Complexity
- Ensure both functions handle cache invalidation the same way
- Verify both functions handle optimistic updates correctly
- Test all edge cases work the same

### Hard to Fix
- If the interfaces are significantly different
- If the official function is missing key features

## Next Steps for Phase 2
1. Compare the two main update function interfaces in detail
2. Ensure official function can handle everything rogue function does
3. Test official function with simple update first
4. Plan the migration strategy

---

**CONCLUSION**: We have clear architectural violation. Main app uses rogue hook instead of official data layer. Need to migrate to official function and delete the rogue one.