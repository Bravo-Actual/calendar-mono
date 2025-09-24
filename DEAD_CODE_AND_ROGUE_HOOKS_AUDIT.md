# Dead Code & Rogue Hooks Audit Report

## Summary: Same Architectural Fuckup Repeated!

We have **3 sets of rogue hooks** all bypassing the official data layer:

## 🔥 ROGUE HOOKS (Need to be eliminated)

### 1. Event Update Hook ✅ ALREADY FIXED
- **Rogue**: `hooks/use-update-event.ts` → `useUpdateEvent()`
- **Official**: `lib/data/queries.ts` → `useUpdateCalendarEvent()`
- **Status**: ✅ Official function fixed and ready for migration

### 2. Event Create Hook 🔥 ACTIVE ISSUE
- **Rogue**: `hooks/use-create-event.ts` → `useCreateEvent()`
- **Official**: `lib/data/queries.ts` → `useCreateCalendarEvent()`
- **Used by**: `calendar/page.tsx` (imports rogue hook)
- **Status**: ❌ Rogue hook actively used, official function unused

### 3. Event Delete Hook 🔥 ACTIVE ISSUE
- **Rogue**: `hooks/use-delete-event.ts` → `useDeleteEvent()`
- **Official**: `lib/data/queries.ts` → `useDeleteCalendarEvent()`
- **Used by**: `calendar/page.tsx` (imports rogue hook)
- **Status**: ❌ Rogue hook actively used, official function unused

## Import Analysis - calendar/page.tsx

```typescript
// CURRENT IMPORTS (ALL WRONG!)
import { useUpdateEvent } from "@/hooks/use-update-event";    // 🔥 ROGUE
import { useCreateEvent } from "@/hooks/use-create-event";    // 🔥 ROGUE
import { useDeleteEvent } from "@/hooks/use-delete-event";    // 🔥 ROGUE

// SHOULD BE (OFFICIAL DATA LAYER)
import {
  useUpdateCalendarEvent,
  useCreateCalendarEvent,
  useDeleteCalendarEvent
} from "@/lib/data/queries";  // ✅ OFFICIAL
```

## Dead Code Analysis

### ✅ Official Functions (GOOD - in right place but unused)
- `lib/data/queries.ts::useCreateCalendarEvent()` - NOT USED ANYWHERE
- `lib/data/queries.ts::useDeleteCalendarEvent()` - NOT USED ANYWHERE
- `lib/data/queries.ts::useUpdateCalendarEvent()` - NOT USED ANYWHERE (but we fixed it)

### 🔥 Rogue Hook Files (BAD - should not exist)
- `hooks/use-create-event.ts` - DELETE AFTER MIGRATION
- `hooks/use-delete-event.ts` - DELETE AFTER MIGRATION
- `hooks/use-update-event.ts` - DELETE AFTER MIGRATION

### ✅ Legitimate Hook Files (GOOD - different purpose)
- `hooks/use-event-categories.ts` - User categories (not events)
- `hooks/use-user-calendars.ts` - User calendars (not events)

## Files That Import Rogue Hooks

### Main Calendar Page (Primary Issue)
- **File**: `app/calendar/page.tsx`
- **Imports**: All 3 rogue hooks (update, create, delete)
- **Impact**: All event CRUD operations bypass data layer

### No Other Files Import Rogue Hooks
✅ Only calendar/page.tsx imports them - easy to fix!

## Confusing Naming (Lower Priority)

### These Have Confusing Names But Are Legitimate:
- `useCreateEventCategory()` - Creates user categories (not events)
- `useDeleteEventCategory()` - Deletes user categories (not events)
- `useCreateEventCalendar()` - Creates user calendars (not events)
- `useDeleteEventCalendar()` - Deletes user calendars (not events)

These should probably be renamed to avoid confusion:
- `useCreateEventCategory()` → `useCreateUserCategory()`
- `useDeleteEventCategory()` → `useDeleteUserCategory()`
- etc.

## Migration Strategy

### Phase 3A: Update (Already Planned)
1. ✅ Fix official `useUpdateCalendarEvent()` (DONE)
2. Switch calendar/page.tsx import
3. Delete `hooks/use-update-event.ts`

### Phase 3B: Create (New)
1. Review/fix official `useCreateCalendarEvent()`
2. Switch calendar/page.tsx import
3. Delete `hooks/use-create-event.ts`

### Phase 3C: Delete (New)
1. Review/fix official `useDeleteCalendarEvent()`
2. Switch calendar/page.tsx import
3. Delete `hooks/use-delete-event.ts`

## Risk Assessment

### High Risk
- **All event CRUD** currently bypasses official data layer
- **Inconsistent behavior** across create/update/delete operations
- **Maintenance nightmare** - same functionality in multiple places

### Medium Risk
- Confusing naming of category/calendar hooks
- Potential interface differences between rogue and official functions

### Low Risk
- Only one file imports rogue hooks (easy to fix)
- Official functions exist and are in right place

## Immediate Action Required

The architectural violation is **3x worse than we thought**! We need to:

1. **Extend current plan** to include create/delete hooks
2. **Review official create/delete functions** for same issues we found in update
3. **Migrate all 3 operations** to official data layer
4. **Delete all 3 rogue hook files**

## Files to Eventually Delete

```bash
# Rogue hooks (after migration)
rm hooks/use-update-event.ts
rm hooks/use-create-event.ts
rm hooks/use-delete-event.ts
```

---

**CONCLUSION**: The rogue hook problem is **3x bigger** than initially thought. All event CRUD operations bypass the official data layer. Need comprehensive migration plan for all three operations.