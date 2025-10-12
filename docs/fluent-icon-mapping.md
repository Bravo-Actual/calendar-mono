# Lucide to Fluent Icons Migration Guide

## Package Installed
✅ `@fluentui/react-icons` v2.0.312

## Icon Convention (IMPORTANT)

**Default Standard:**
- **20Regular** - Use for ALL default icon states (equivalent to Lucide's default)
- **20Filled** - Use ONLY for selected/pressed/active states

This provides consistent sizing and visual hierarchy across the app.

### Most Common Icons (Top 20)

| Lucide Icon | Fluent Regular | Fluent Filled | Notes |
|-------------|----------------|---------------|-------|
| `ChevronDown` / `ChevronDownIcon` | `ChevronDown20Regular` | `ChevronDown20Filled` | Size: 20 (can also use 16, 24, 28) |
| `Trash2` | `Delete20Regular` | `Delete20Filled` | Fluent uses "Delete" instead of "Trash" |
| `Plus` | `Add20Regular` | `Add20Filled` | Fluent uses "Add" instead of "Plus" |
| `Loader2` | `Spinner20Regular` | - | Use `<Spinner>` component or rotating icon |
| `X` / `XIcon` | `Dismiss20Regular` | `Dismiss20Filled` | Fluent uses "Dismiss" instead of "X" |
| `Check` / `CheckIcon` | `Checkmark20Regular` | `Checkmark20Filled` | |
| `ChevronRight` / `ChevronRightIcon` | `ChevronRight20Regular` | `ChevronRight20Filled` | |
| `Video` | `Video20Regular` | `Video20Filled` | |
| `PersonStanding` | `Person20Regular` | `Person20Filled` | Use "Person" instead |
| `Circle` / `CircleIcon` | `Circle20Regular` | `Circle20Filled` | |
| `Sparkles` | `Sparkle20Regular` | `Sparkle20Filled` | Singular "Sparkle" |
| `GalleryVerticalEnd` | `AppsList20Regular` | `AppsList20Filled` | Use AppsList or Grid |
| `ChevronsUpDown` | `ChevronUpDown20Regular` | - | Or use `ArrowSort20Regular` |
| `ChevronLeft` / `ChevronLeftIcon` | `ChevronLeft20Regular` | `ChevronLeft20Filled` | |
| `Search` / `SearchIcon` | `Search20Regular` | `Search20Filled` | |
| `MessageSquare` | `Comment20Regular` | `Comment20Filled` | Or `ChatBubble20Regular` |
| `Clock` | `Clock20Regular` | `Clock20Filled` | |
| `Zap` | `Flash20Regular` | `Flash20Filled` | Fluent uses "Flash" |
| `Bot` | `Bot20Regular` | `Bot20Filled` | ✅ Same name! |
| `Brain` / `BrainIcon` | `Brain20Regular` | - | Or `ThinkingBubble20Regular` |

### All Other Icons

| Lucide Icon | Fluent Regular | Fluent Filled | Notes |
|-------------|----------------|---------------|-------|
| `ArrowRight` / `ArrowRightIcon` | `ArrowRight20Regular` | `ArrowRight20Filled` | |
| `ArrowLeft` / `ArrowLeftIcon` | `ArrowLeft20Regular` | `ArrowLeft20Filled` | |
| `ArrowDown` / `ArrowDownIcon` | `ArrowDown20Regular` | `ArrowDown20Filled` | |
| `Bell` | `Alert20Regular` | `Alert20Filled` | Or `AlertBadge20Regular` |
| `Book` / `BookIcon` | `Book20Regular` | `Book20Filled` | |
| `Box` | `Box20Regular` | `Box20Filled` | |
| `Calendar` | `Calendar20Regular` | `Calendar20Filled` | ✅ Same name! |
| `Camera` | `Camera20Regular` | `Camera20Filled` | |
| `ChevronUp` / `ChevronUpIcon` | `ChevronUp20Regular` | `ChevronUp20Filled` | |
| `Command` | `Keyboard20Regular` | - | No direct equivalent, use Keyboard |
| `Copy` / `CopyIcon` | `Copy20Regular` | `Copy20Filled` | |
| `Dot` / `DotIcon` | `CircleSmall20Regular` | `CircleSmall20Filled` | |
| `Edit` | `Edit20Regular` | `Edit20Filled` | |
| `ExternalLink` / `ExternalLinkIcon` | `ArrowUpRight20Regular` | - | Or `Open20Regular` |
| `Eye` | `Eye20Regular` | - | |
| `EyeOff` | `EyeOff20Regular` | - | |
| `Globe` | `Globe20Regular` | `Globe20Filled` | |
| `GripVertical` / `GripVerticalIcon` | `ReOrder20Regular` | - | Or `DragHandle20Regular` |
| `MessageCircle` / `MessageCircleIcon` | `ChatBubble20Regular` | `ChatBubble20Filled` | |
| `Minus` / `MinusIcon` | `Subtract20Regular` | `Subtract20Filled` | |
| `Moon` | `WeatherMoon20Regular` | `WeatherMoon20Filled` | |
| `MoreHorizontal` / `MoreHorizontalIcon` | `MoreHorizontal20Regular` | `MoreHorizontal20Filled` | ✅ Same name! |
| `PanelLeft` / `PanelLeftIcon` | `PanelLeft20Regular` | `PanelLeft20Filled` | ✅ Same name! |
| `RotateCw` | `ArrowClockwise20Regular` | `ArrowClockwise20Filled` | |
| `Sun` | `WeatherSunny20Regular` | `WeatherSunny20Filled` | |
| `Tag` | `Tag20Regular` | `Tag20Filled` | ✅ Same name! |
| `Target` | `Target20Regular` | - | |
| `Upload` | `ArrowUpload20Regular` | `ArrowUpload20Filled` | |
| `User` | `Person20Regular` | `Person20Filled` | Fluent uses "Person" |
| `UserCheck` | `PeopleCheckmark20Regular` | `PeopleCheckmark20Filled` | Note: "People" not "Person" |
| `Users` | `People20Regular` | `People20Filled` | Fluent uses "People" |
| `ZoomIn` | `ZoomIn20Regular` | - | |

## Import Syntax Changes

### Before (Lucide)
```tsx
import { Plus, Trash2, Check, ChevronDown } from 'lucide-react';
```

### After (Fluent)
```tsx
import {
  Add20Regular,
  Delete20Regular,
  Checkmark20Regular,
  ChevronDown20Regular
} from '@fluentui/react-icons';
```

## Usage Examples

### Example 1: Simple Icon Replacement

**Before:**
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

**After:**
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

### Example 2: Icon Types (for TypeScript)

**Before:**
```tsx
import { type LucideIcon, Calendar, User } from 'lucide-react';

interface NavItem {
  icon: LucideIcon;
  label: string;
}
```

**After:**
```tsx
import type { FluentIcon } from '@fluentui/react-icons';
import { Calendar20Regular, Person20Regular } from '@fluentui/react-icons';

interface NavItem {
  icon: FluentIcon;
  label: string;
}
```

### Example 3: Using Icon Sizes

Fluent icons come in multiple sizes: 16, 20, 24, 28, 32, 48

**Common size mapping:**
- Lucide `className="w-4 h-4"` (16px) → `Icon16Regular`
- Lucide `className="w-5 h-5"` (20px) → `Icon20Regular` ← **Most common**
- Lucide `className="w-6 h-6"` (24px) → `Icon24Regular`

```tsx
// Small icon (16px)
import { Add16Regular } from '@fluentui/react-icons';
<Add16Regular />

// Default icon (20px) - recommended
import { Add20Regular } from '@fluentui/react-icons';
<Add20Regular />

// Large icon (24px)
import { Add24Regular } from '@fluentui/react-icons';
<Add24Regular />
```

### Example 4: Active/Selected States (Regular → Filled)

**Pattern: Use Filled variant for active/selected states**

```tsx
import { Calendar20Regular, Calendar20Filled } from '@fluentui/react-icons';

// Navigation item (inactive vs active)
function NavItem({ isActive, label }) {
  const Icon = isActive ? Calendar20Filled : Calendar20Regular;
  return (
    <button className={isActive ? "text-blue-600" : "text-gray-600"}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

// Settings sidebar (from settings-modal.tsx)
<SidebarMenuButton isActive={activeSection === item.key}>
  <item.icon />  {/* Use Regular for default, Filled for active */}
  <span>{item.name}</span>
</SidebarMenuButton>
```

**Common Use Cases for Filled Variant:**
- Active navigation items
- Selected tabs
- Pressed button states
- Checked checkboxes
- Current page indicators
- Favorited/starred items

## Icon Naming Patterns

### Lucide → Fluent Naming Conventions

1. **Action verbs:**
   - `Plus` → `Add`
   - `Trash2` → `Delete`
   - `X` → `Dismiss`
   - `Zap` → `Flash`
   - `Minus` → `Subtract`

2. **Pluralization:**
   - `User` → `Person`
   - `Users` → `People`

3. **Specificity:**
   - `Sparkles` → `Sparkle` (singular)
   - `ExternalLink` → `Open` or `ArrowUpRight`
   - `GripVertical` → `ReOrder` or `DragHandle`

4. **Weather/Time:**
   - `Moon` → `WeatherMoon`
   - `Sun` → `WeatherSunny`

## Size Suffix Format

All Fluent icons follow: `{IconName}{Size}{Variant}`

Examples:
- `Add20Regular`
- `Calendar24Filled`
- `Person16Regular`

## Migration Strategy

### Option A: Global Find/Replace (Fastest)
1. Use find/replace for each icon mapping
2. Update all imports in one pass
3. Test thoroughly

### Option B: File-by-File (Safest)
1. Start with most-used components
2. Update imports + usage
3. Test each file
4. Gradually remove lucide-react dependency

### Option C: Gradual Migration
1. Keep both packages temporarily
2. New code uses Fluent icons
3. Refactor old code over time
4. Remove lucide-react when complete

## Browser Compatibility

Fluent icons work in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Bundle Size Impact

- **Lucide**: ~1.5KB per icon (tree-shaken)
- **Fluent**: ~1.8KB per icon (tree-shaken)
- **Difference**: Negligible (~300 bytes per icon)

Tree-shaking works perfectly - only imported icons are bundled.

## Additional Resources

- [Fluent Icons Gallery](https://react.fluentui.dev/?path=/docs/icons-catalog--page)
- [Icon Sizes Guide](https://react.fluentui.dev/?path=/docs/concepts-developer-icons-icons--page)
- [Migration Examples](https://github.com/microsoft/fluentui/tree/master/packages/react-icons)

## Next Steps

1. ✅ **Package installed** - `@fluentui/react-icons` ready to use
2. ⏳ **Choose migration strategy** (recommend Option B for safety)
3. ⏳ **Start with high-traffic components** (nav, buttons, forms)
4. ⏳ **Update TypeScript types** (`LucideIcon` → `FluentIcon`)
5. ⏳ **Remove lucide-react** when complete
