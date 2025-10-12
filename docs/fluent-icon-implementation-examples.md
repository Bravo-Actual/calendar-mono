# Fluent Icons: Implementation Examples

## Standard Convention
- **Default state**: Use `{Icon}20Regular`
- **Active/Selected state**: Use `{Icon}20Filled`

---

## Example 1: Settings Sidebar Navigation

### Before (Lucide)
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

// In JSX
<SidebarMenuButton isActive={activeSection === item.key}>
  <item.icon />
  <span>{item.name}</span>
</SidebarMenuButton>
```

### After (Fluent) - Option A: Dynamic Icon Selection
```tsx
import {
  Alert20Regular, Alert20Filled,
  Calendar20Regular, Calendar20Filled,
  Clock20Regular, Clock20Filled,
  Globe20Regular, Globe20Filled,
  Tag20Regular, Tag20Filled,
  Person20Regular, Person20Filled,
  Flash20Regular, Flash20Filled
} from '@fluentui/react-icons';

const settingsData = {
  nav: [
    {
      name: 'Profile',
      icon: Person20Regular,
      iconFilled: Person20Filled,
      key: 'profile'
    },
    {
      name: 'Dates & Times',
      icon: Calendar20Regular,
      iconFilled: Calendar20Filled,
      key: 'dates-times'
    },
    {
      name: 'Work Schedule',
      icon: Clock20Regular,
      iconFilled: Clock20Filled,
      key: 'work-schedule'
    },
    {
      name: 'Calendars & Categories',
      icon: Tag20Regular,
      iconFilled: Tag20Filled,
      key: 'calendars-categories'
    },
    {
      name: 'Notifications',
      icon: Alert20Regular,
      iconFilled: Alert20Filled,
      key: 'notifications'
    },
    {
      name: 'Language & region',
      icon: Globe20Regular,
      iconFilled: Globe20Filled,
      key: 'language'
    },
    {
      name: 'AI Assistant',
      icon: Flash20Regular,
      iconFilled: Flash20Filled,
      key: 'ai'
    },
  ],
};

// In JSX - dynamically select filled vs regular
<SidebarMenuButton isActive={activeSection === item.key}>
  {activeSection === item.key ? <item.iconFilled /> : <item.icon />}
  <span>{item.name}</span>
</SidebarMenuButton>
```

### After (Fluent) - Option B: Conditional Component (Cleaner)
```tsx
import {
  Alert20Regular, Alert20Filled,
  Calendar20Regular, Calendar20Filled,
  Clock20Regular, Clock20Filled,
  Globe20Regular, Globe20Filled,
  Tag20Regular, Tag20Filled,
  Person20Regular, Person20Filled,
  Flash20Regular, Flash20Filled
} from '@fluentui/react-icons';

const settingsData = {
  nav: [
    {
      name: 'Profile',
      icon: Person20Regular,
      iconFilled: Person20Filled,
      key: 'profile'
    },
    // ... rest same as Option A
  ],
};

// In JSX - use ternary inline
{settingsData.nav.map((item) => {
  const Icon = activeSection === item.key ? item.iconFilled : item.icon;

  return (
    <SidebarMenuItem key={item.name}>
      <SidebarMenuButton isActive={activeSection === item.key}>
        <Icon />
        <span>{item.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
})}
```

---

## Example 2: Calendar View Buttons

### Before (Lucide)
```tsx
import { Plus, Trash2 } from 'lucide-react';

<Button>
  <Plus className="w-4 h-4" />
  Add Event
</Button>

<Button variant="destructive">
  <Trash2 className="w-4 h-4" />
  Delete
</Button>
```

### After (Fluent)
```tsx
import { Add20Regular, Delete20Regular } from '@fluentui/react-icons';

<Button>
  <Add20Regular className="w-4 h-4" />
  Add Event
</Button>

<Button variant="destructive">
  <Delete20Regular className="w-4 h-4" />
  Delete
</Button>
```

**Note:** No Filled variant needed here - these are action buttons, not toggle states.

---

## Example 3: Toggle States (Checkbox, Favorite, etc.)

### Checkbox Component
```tsx
import { Checkmark20Regular, Checkmark20Filled } from '@fluentui/react-icons';

function Checkbox({ checked, onChange, label }) {
  return (
    <button onClick={onChange} className="flex items-center gap-2">
      {checked ? (
        <Checkmark20Filled className="text-blue-600" />
      ) : (
        <Checkmark20Regular className="text-gray-400" />
      )}
      <span>{label}</span>
    </button>
  );
}
```

### Favorite/Star Toggle
```tsx
import { Star20Regular, Star20Filled } from '@fluentui/react-icons';

function FavoriteButton({ isFavorited, onToggle }) {
  return (
    <button onClick={onToggle}>
      {isFavorited ? (
        <Star20Filled className="text-yellow-500" />
      ) : (
        <Star20Regular className="text-gray-400" />
      )}
    </button>
  );
}
```

---

## Example 4: Calendar Sidebar (Calendars/Categories)

### Before (Lucide)
```tsx
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';

// In render
<Button size="sm">
  <Plus />
</Button>

<Button size="sm" variant="ghost">
  {calendar.visible ? <Eye /> : <EyeOff />}
</Button>

<Button size="sm" variant="ghost">
  <Trash2 />
</Button>
```

### After (Fluent)
```tsx
import {
  Add20Regular,
  Eye20Regular,
  EyeOff20Regular,
  Delete20Regular
} from '@fluentui/react-icons';

// In render
<Button size="sm">
  <Add20Regular />
</Button>

<Button size="sm" variant="ghost">
  {calendar.visible ? <Eye20Regular /> : <EyeOff20Regular />}
</Button>

<Button size="sm" variant="ghost">
  <Delete20Regular />
</Button>
```

**Note:** Eye/EyeOff doesn't need Filled variant - they're different icons representing different states.

---

## Example 5: AI Assistant Panel

### Before (Lucide)
```tsx
import { Bot, Sparkles, Send } from 'lucide-react';

<div className="flex items-center gap-2">
  <Bot className="w-5 h-5" />
  <span>AI Assistant</span>
</div>

<Button>
  <Sparkles className="w-4 h-4" />
  Generate
</Button>

<Button>
  <Send className="w-4 h-4" />
</Button>
```

### After (Fluent)
```tsx
import {
  Bot20Regular,
  Sparkle20Regular,
  Send20Regular
} from '@fluentui/react-icons';

<div className="flex items-center gap-2">
  <Bot20Regular className="w-5 h-5" />
  <span>AI Assistant</span>
</div>

<Button>
  <Sparkle20Regular className="w-4 h-4" />
  Generate
</Button>

<Button>
  <Send20Regular className="w-4 h-4" />
</Button>
```

---

## Example 6: Dropdown/Select Components

### Before (Lucide)
```tsx
import { ChevronDown, Check } from 'lucide-react';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select timezone" />
    <ChevronDown className="w-4 h-4" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="utc">
      {isSelected && <Check className="w-4 h-4" />}
      UTC
    </SelectItem>
  </SelectContent>
</Select>
```

### After (Fluent)
```tsx
import { ChevronDown20Regular, Checkmark20Filled } from '@fluentui/react-icons';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select timezone" />
    <ChevronDown20Regular className="w-4 h-4" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="utc">
      {isSelected && <Checkmark20Filled className="w-4 h-4 text-blue-600" />}
      UTC
    </SelectItem>
  </SelectContent>
</Select>
```

**Note:** Use `Checkmark20Filled` for selected items to emphasize the active selection.

---

## Example 7: Loading Spinner

### Before (Lucide)
```tsx
import { Loader2 } from 'lucide-react';

<Button disabled>
  <Loader2 className="w-4 h-4 animate-spin" />
  Loading...
</Button>
```

### After (Fluent)
```tsx
import { Spinner20Regular } from '@fluentui/react-icons';

<Button disabled>
  <Spinner20Regular className="w-4 h-4 animate-spin" />
  Loading...
</Button>
```

**Or use Fluent's built-in Spinner component:**
```tsx
import { Spinner } from '@fluentui/react-components'; // If using full Fluent UI

<Button disabled>
  <Spinner size="tiny" />
  Loading...
</Button>
```

---

## Icon TypeScript Types

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
  iconFilled?: FluentIcon; // Optional filled variant for active states
  key: string;
}
```

---

## Migration Checklist Per Component

- [ ] Identify all Lucide icon imports
- [ ] Map each icon to Fluent equivalent (see mapping table)
- [ ] Add `20Regular` suffix for default state
- [ ] Add `20Filled` import if component has active/selected states
- [ ] Update icon usage in JSX
- [ ] Update TypeScript types (`LucideIcon` → `FluentIcon`)
- [ ] Test visual appearance
- [ ] Verify active/selected states work correctly

---

## When to Use Filled vs Regular

### ✅ Use Filled for:
- Active navigation items
- Selected tabs
- Pressed/toggled buttons
- Checked checkboxes
- Current page indicators
- Favorited items
- Selected dropdown items

### ❌ Don't use Filled for:
- Default button states
- Action buttons (Add, Delete, Save)
- Static icons (labels, headers)
- Dropdown chevrons
- Loading spinners
- Icons that don't represent state

---

## Quick Reference: Most Common Replacements

| Lucide | Default (Regular) | Active (Filled) |
|--------|------------------|-----------------|
| `Plus` | `Add20Regular` | - |
| `Trash2` | `Delete20Regular` | - |
| `X` | `Dismiss20Regular` | - |
| `Check` | `Checkmark20Regular` | `Checkmark20Filled` |
| `ChevronDown` | `ChevronDown20Regular` | - |
| `Calendar` | `Calendar20Regular` | `Calendar20Filled` |
| `User` | `Person20Regular` | `Person20Filled` |
| `Users` | `People20Regular` | `People20Filled` |
| `Clock` | `Clock20Regular` | `Clock20Filled` |
| `Tag` | `Tag20Regular` | `Tag20Filled` |
| `Bell` | `Alert20Regular` | `Alert20Filled` |
| `Zap` | `Flash20Regular` | `Flash20Filled` |
| `Bot` | `Bot20Regular` | `Bot20Filled` |
| `Search` | `Search20Regular` | - |
| `Video` | `Video20Regular` | `Video20Filled` |

**Rule of thumb:** If the icon represents a toggleable state or selection, import both Regular and Filled variants. Otherwise, just use Regular.
