# Clean Migration Plan: Nuke Old Hooks, Wire New System

## Simple Plan

### 1. DELETE OLD HOOKS (Clean Slate)
Delete these 9 conflicting hooks:
```bash
rm src/hooks/use-ai-personas.ts
rm src/hooks/use-user-calendars.ts
rm src/hooks/use-event-categories.ts
rm src/hooks/use-user-profile.ts
rm src/hooks/use-work-schedule.ts
rm src/hooks/use-create-event.ts
rm src/hooks/use-update-event.ts
rm src/hooks/use-delete-event.ts
rm src/hooks/use-update-profile.ts
```

### 2. UPDATE COMPONENTS TO NEW SYSTEM

#### AuthContext
```typescript
// OLD
import { useUserProfile } from '@/hooks/use-user-profile'

// NEW
import { useUserProfile } from '@/lib/data'
```

#### Calendar Page
```typescript
// OLD
import { useCreateEvent } from '@/hooks/use-create-event'
import { useUpdateEvent } from '@/hooks/use-update-event'

// NEW
import { useCreateEvent, useUpdateEvent, useEventsRange } from '@/lib/data'
```

#### Settings Modal
```typescript
// OLD
import { useAIPersonas } from '@/hooks/use-ai-personas'

// NEW
import { useAIPersonas } from '@/lib/data'
```

#### Components with Category References
```typescript
// OLD
import type { UserEventCategory } from "@/hooks/use-event-categories"

// NEW
import type { UserCategory } from '@/lib/data'
```

### 3. FIX BUILD ERRORS ONE BY ONE
Build errors will tell us exactly what needs updating. Fix each error by:
1. Replacing old hook import with `@/lib/data` import
2. Updating types to use our Dexie exports
3. Making sure hook usage matches our new factory patterns

### 4. TEST BASIC FUNCTIONALITY
- User profile loads
- Events display on calendar
- Can create/edit/delete events
- AI personas work in settings

## That's it. No legacy mapping bullshit.