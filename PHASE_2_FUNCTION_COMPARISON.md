# Phase 2: Function Comparison Analysis

## Interface Comparison

### Rogue Hook: `useUpdateEvent()`
```typescript
interface UpdateEventInput {
  id: string
  // Event table fields
  title?: string
  start_time?: string
  duration?: number
  all_day?: boolean
  agenda?: string
  online_event?: boolean
  online_join_link?: string
  online_chat_link?: string
  in_person?: boolean
  private?: boolean
  request_responses?: boolean
  allow_forwarding?: boolean
  hide_attendees?: boolean
  discovery?: string
  join_model?: string
  invite_allow_reschedule_proposals?: boolean
  // User option fields
  calendar_id?: string
  show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere'
  category_id?: string
  time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block'
  ai_managed?: boolean
  ai_instructions?: string
}
```

### Official Data Layer: `useUpdateCalendarEvent()`
```typescript
function({ id: string; updates: Partial<CalendarEvent> })
// Uses full CalendarEvent interface - much more flexible!
```

## Database Operations Comparison

### Rogue Hook Database Operations ✅ GOOD
1. **Events Table Update**:
   - Uses `supabase.from('events').update(eventUpdates)`
   - Includes owner check: `.eq('owner_id', user.id)`
   - Properly separates event vs user option fields

2. **User Options Update**:
   - Uses `supabase.from('event_details_personal').upsert()`
   - Handles user-specific settings properly

3. **Response**:
   - Fetches from `calendar_events_view`
   - Returns complete CalendarEvent object

### Official Data Layer Database Operations ⚠️ ISSUES FOUND
1. **Events Table Update**:
   - Uses `supabase.from('events').update(eventUpdates)`
   - **MISSING OWNER CHECK** - security issue!
   - Has all field mappings including discovery/join_model

2. **User Options Update**:
   - Uses `supabase.from('event_details_personal').upsert()`
   - **REQUIRES `viewing_user_id`** in updates object - weird interface!

3. **Response**:
   - Fetches from `calendar_events_view`
   - Uses `cleanCalendarEvent()` helper
   - **REQUIRES `viewing_user_id`** for fetch - weird interface!

## Key Differences Found

### ✅ Rogue Hook Advantages
1. **Better Security**: Has owner check on events table update
2. **Cleaner Interface**: Custom interface, no weird required fields
3. **Better User Context**: Gets user from auth context automatically

### ✅ Official Function Advantages
1. **More Flexible**: Uses full CalendarEvent interface
2. **Better Architecture**: In correct data layer location
3. **Complete Field Support**: Has all fields including discovery/join_model

### 🔥 Official Function Issues
1. **Security Gap**: Missing owner check on events update
2. **Weird Interface**: Requires `viewing_user_id` in updates object
3. **Inconsistent**: Sometimes uses auth context, sometimes requires explicit user ID

## Field Support Comparison

| Field | Rogue Hook | Official Function |
|-------|------------|-------------------|
| title | ✅ | ✅ |
| agenda | ✅ | ✅ |
| online_event | ✅ | ✅ |
| discovery | ✅ | ✅ |
| join_model | ✅ | ✅ |
| calendar_id | ✅ | ✅ |
| show_time_as | ✅ | ✅ |
| ai_managed | ✅ | ✅ |
| **Owner Security** | ✅ | ❌ |
| **Clean Interface** | ✅ | ❌ |

## Migration Strategy Decision

### Option A: Fix Official Function (RECOMMENDED)
- Add owner security check
- Fix weird `viewing_user_id` interface
- Use auth context like rogue hook does
- Then migrate to official function

### Option B: Move Rogue Function to Data Layer
- Move `useUpdateEvent` to `lib/data/queries.ts`
- Delete `hooks/use-update-event.ts`
- Update imports

### Option C: Hybrid Approach
- Keep both but make official one the primary
- Gradually migrate pieces

## Recommendation: Option A

The official function has better architecture and is in the right place, but has security and interface issues. We should:

1. **Fix the official function** to match security and interface of rogue hook
2. **Test the fixed official function**
3. **Migrate calendar page** to use fixed official function
4. **Delete the rogue hook**

This maintains our data layer architecture while keeping the good parts of the rogue hook.

## Next Steps for Phase 2.2
1. Fix security issue in official function (add owner check)
2. Fix interface issue (remove weird viewing_user_id requirement)
3. Test that fixed official function works correctly
4. Prepare for migration in Phase 3

---

**DECISION**: Official function is the right place but needs security and interface fixes before migration.