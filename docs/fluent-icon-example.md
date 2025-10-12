# Fluent Icons Migration - Real Example

## File: `settings-modal.tsx`

### Current Code (Lucide Icons)

```tsx
import { Bell, Calendar, Clock, Globe, Tag, User, Zap } from 'lucide-react';

const settingsData = {
  nav: [
    { name: 'Profile', icon: User, key: 'profile' },
    { name: 'Dates & Times', icon: Calendar, key: 'dates-times' },
    { name: 'Work Schedule', icon: Clock, key: 'work-schedule' },
    { name: 'Calendars & Categories', icon: Tag, key: 'calendars-categories' },
    { name: 'Notifications', icon: Bell, key: 'notifications' },
    { name: 'Language & region', icon: Globe, key: 'language' },
    { name: 'AI Assistant', icon: Zap, key: 'ai' },
  ],
};

// Usage in JSX:
<SidebarMenuButton>
  <item.icon />  {/* Lucide icon */}
  <span>{item.name}</span>
</SidebarMenuButton>
```

### Converted Code (Fluent Icons)

```tsx
import {
  Alert20Regular,
  Calendar20Regular,
  Clock20Regular,
  Globe20Regular,
  Tag20Regular,
  Person20Regular,
  Flash20Regular
} from '@fluentui/react-icons';

const settingsData = {
  nav: [
    { name: 'Profile', icon: Person20Regular, key: 'profile' },
    { name: 'Dates & Times', icon: Calendar20Regular, key: 'dates-times' },
    { name: 'Work Schedule', icon: Clock20Regular, key: 'work-schedule' },
    { name: 'Calendars & Categories', icon: Tag20Regular, key: 'calendars-categories' },
    { name: 'Notifications', icon: Alert20Regular, key: 'notifications' },
    { name: 'Language & region', icon: Globe20Regular, key: 'language' },
    { name: 'AI Assistant', icon: Flash20Regular, key: 'ai' },
  ],
};

// Usage in JSX (no change needed!):
<SidebarMenuButton>
  <item.icon />  {/* Fluent icon */}
  <span>{item.name}</span>
</SidebarMenuButton>
```

### Icon Mappings Used

| Lucide | Fluent | Reason |
|--------|--------|--------|
| `User` | `Person20Regular` | Fluent uses "Person" terminology |
| `Calendar` | `Calendar20Regular` | ✅ Same name! |
| `Clock` | `Clock20Regular` | ✅ Same name! |
| `Tag` | `Tag20Regular` | ✅ Same name! |
| `Bell` | `Alert20Regular` | Fluent uses "Alert" for notifications |
| `Globe` | `Globe20Regular` | ✅ Same name! |
| `Zap` | `Flash20Regular` | Fluent uses "Flash" for lightning/speed |

### Visual Comparison

The icons will look similar but with Microsoft's Fluent design language:
- Slightly rounder corners
- More consistent stroke weights
- Better alignment in Microsoft 365 context

## Another Example: Button Icons

### Before (Lucide)
```tsx
import { Plus, Trash2, Check } from 'lucide-react';

<Button>
  <Plus className="w-4 h-4" />
  Add Event
</Button>

<Button variant="destructive">
  <Trash2 className="w-4 h-4" />
  Delete
</Button>

<Button variant="outline">
  <Check className="w-4 h-4" />
  Confirm
</Button>
```

### After (Fluent)
```tsx
import { Add20Regular, Delete20Regular, Checkmark20Regular } from '@fluentui/react-icons';

<Button>
  <Add20Regular className="w-4 h-4" />
  Add Event
</Button>

<Button variant="destructive">
  <Delete20Regular className="w-4 h-4" />
  Delete
</Button>

<Button variant="outline">
  <Checkmark20Regular className="w-4 h-4" />
  Confirm
</Button>
```

## TypeScript Type Changes

### Before (Lucide)
```tsx
import { type LucideIcon } from 'lucide-react';

interface NavItem {
  name: string;
  icon: LucideIcon;
  key: string;
}
```

### After (Fluent)
```tsx
import type { FluentIcon } from '@fluentui/react-icons';

interface NavItem {
  name: string;
  icon: FluentIcon;
  key: string;
}
```

## What Stays the Same

✅ **Component usage** - icons are still React components
✅ **ClassName props** - can still use `className="w-4 h-4"`
✅ **Color props** - works with Tailwind text colors
✅ **Tree shaking** - only imported icons are bundled

## What Changes

❌ **Icon names** - many have different names (see mapping table)
❌ **Package name** - `lucide-react` → `@fluentui/react-icons`
❌ **Size suffix** - Fluent requires size suffix (e.g., `20Regular`)
❌ **Type name** - `LucideIcon` → `FluentIcon`

## Migration Checklist for Each File

- [ ] Replace import statement
- [ ] Update icon names using mapping table
- [ ] Add size suffix (usually `20Regular`)
- [ ] Update TypeScript types if used
- [ ] Test visual appearance
- [ ] Verify bundle size (should be similar)
