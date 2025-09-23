# AI Calendar Highlighting Feature - Implementation Plan

## Overview
Enable the AI agent to visually highlight specific events and time slots on the calendar surface using client-side tools. This creates an interactive experience where the AI can direct user attention to relevant calendar elements during conversations.

**Key Principle**: AI highlights (`aiHighlightedEvents`, `aiHighlightedTimeRanges`) are completely separate from user selections (`selectedEvents`, `selectedTimeRanges`). Both systems coexist independently with different visual treatments.

## Feature Requirements

### Visual Highlights
- **aiEventHighlight**: Yellow highlight overlay on specific events
- **aiTimeHighlight**: Yellow highlight overlay on specific time slots
- **Visual Style**: Same transparency and border style as current user selections, but **yellow color**
- **User Selections**: Keep existing blue/current color scheme
- **Coexistence**: AI highlights and user selections can both be active simultaneously
- **Layering**: Both highlights should be visible when overlapping
- **Persistence**: AI highlights remain until explicitly cleared or replaced by AI

### Interaction Model
- **AI Control**: AI manages `aiHighlightedEvents` and `aiHighlightedTimeRanges` via client-side tools
- **User Control**: Users manage `selectedEvents` and `selectedTimeRanges` via existing UI interactions
- **Independence**: Neither system affects the other
- **Visual Distinction**: Color differentiation makes it clear what's AI vs user controlled

## Technical Architecture

### 1. State Management (Zustand Store)
**File**: `apps/calendar/src/store/app.ts`

Add new state properties alongside existing user selection state:
```typescript
export interface AppState {
  // Existing user selection state (unchanged)
  currentCalendarContext: CalendarContext; // contains selectedEvents, selectedTimeRanges

  // NEW: AI Highlights state (completely separate)
  aiHighlightedEvents: Set<string>; // Event IDs highlighted by AI
  aiHighlightedTimeRanges: Array<{
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
    description?: string; // Optional context for the highlight
  }>;

  // ... rest of existing state
}
```

Add new actions (separate from existing user selection actions):
```typescript
// NEW: AI Highlight actions
setAiHighlightedEvents: (eventIds: string[]) => void;
addAiHighlightedEvent: (eventId: string) => void;
removeAiHighlightedEvent: (eventId: string) => void;
clearAiHighlightedEvents: () => void;

setAiHighlightedTimeRanges: (ranges: TimeRange[]) => void;
addAiHighlightedTimeRange: (range: TimeRange) => void;
removeAiHighlightedTimeRange: (index: number) => void;
clearAiHighlightedTimeRanges: () => void;
clearAllAiHighlights: () => void;

// Existing user selection actions remain unchanged
```

### 2. Visual Components - Dual Highlight System

#### Event Highlighting
**File**: `apps/calendar/src/components/event-card.tsx`

Modifications needed:
- Add `isAiHighlighted` prop alongside existing `isSelected` prop
- Support both highlights simultaneously
- Layer highlights appropriately when both are active

```typescript
interface EventCardProps {
  // Existing props
  isSelected: boolean; // User selection (existing blue highlight)

  // NEW props
  isAiHighlighted: boolean; // AI highlight (new yellow highlight)

  // ... other existing props
}
```

#### Time Range Highlighting
**File**: `apps/calendar/src/components/day-column.tsx`

Modifications needed:
- Render both user selections AND AI highlights
- Different visual treatments for each type
- Handle overlapping ranges gracefully

Rendering order (bottom to top):
1. Grid background
2. AI time highlights (yellow)
3. User time selections (existing color)
4. Events
5. AI event highlights (yellow overlay)
6. User event selections (existing color overlay)

#### CSS Styles - Dual Color System
**File**: `apps/calendar/src/styles/globals.css`

Add new AI highlight classes while preserving existing user selection styles:
```css
/* NEW: AI Highlights (Yellow) */
.ai-event-highlight {
  background-color: rgba(255, 235, 59, 0.3);
  border: 2px solid rgba(255, 235, 59, 0.6);
  transition: all 0.2s ease-in-out;
}

.ai-time-highlight {
  background-color: rgba(255, 235, 59, 0.2);
  border: 1px solid rgba(255, 235, 59, 0.4);
  pointer-events: none;
  transition: opacity 0.3s ease-in-out;
}

/* Existing user selection styles remain unchanged */
.user-event-selected {
  /* Existing blue/current color treatment */
}

.user-time-selected {
  /* Existing blue/current color treatment */
}

/* Combined state when both AI and user highlights are active */
.event-dual-highlighted {
  /* Visual treatment for when event is both AI highlighted AND user selected */
  /* Could be gradient, double border, or other creative solution */
}
```

### 3. Client-Side Agent Tools

#### Event Highlighting Tool
**File**: `apps/calendar/src/tools/highlight-events.ts`

```typescript
import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { useAppStore } from '@/store/app';

export const highlightEventsToolool = createTool({
  id: 'highlightEvents',
  description: 'Highlight specific events on the calendar to draw user attention. This is separate from user selections.',
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe('Array of event IDs to highlight with yellow AI highlight'),
    action: z.enum(['add', 'replace', 'clear']).default('replace').describe('How to apply AI highlights'),
    description: z.string().optional().describe('Context for why these events are highlighted')
  }),
  execute: async ({ context }) => {
    const {
      setAiHighlightedEvents,
      addAiHighlightedEvent,
      clearAiHighlightedEvents
    } = useAppStore.getState();

    switch (context.action) {
      case 'add':
        context.eventIds.forEach(addAiHighlightedEvent);
        break;
      case 'replace':
        setAiHighlightedEvents(context.eventIds);
        break;
      case 'clear':
        clearAiHighlightedEvents();
        break;
    }

    return {
      success: true,
      highlightedCount: context.action === 'clear' ? 0 : context.eventIds.length,
      message: context.description || `AI highlighted ${context.eventIds.length} events`,
      type: 'ai-highlight' // Distinguish from user selections
    };
  }
});
```

#### Time Range Highlighting Tool
**File**: `apps/calendar/src/tools/highlight-time-ranges.ts`

```typescript
import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { useAppStore } from '@/store/app';

export const highlightTimeRangesTool = createTool({
  id: 'highlightTimeRanges',
  description: 'Highlight specific time ranges on the calendar to draw user attention. This is separate from user selections.',
  inputSchema: z.object({
    timeRanges: z.array(z.object({
      start: z.string().describe('ISO timestamp for start of AI highlight'),
      end: z.string().describe('ISO timestamp for end of AI highlight'),
      description: z.string().optional().describe('Context for this time range')
    })),
    action: z.enum(['add', 'replace', 'clear']).default('replace').describe('How to apply AI highlights'),
    description: z.string().optional().describe('Overall context for the AI highlights')
  }),
  execute: async ({ context }) => {
    const {
      setAiHighlightedTimeRanges,
      addAiHighlightedTimeRange,
      clearAiHighlightedTimeRanges
    } = useAppStore.getState();

    switch (context.action) {
      case 'add':
        context.timeRanges.forEach(addAiHighlightedTimeRange);
        break;
      case 'replace':
        setAiHighlightedTimeRanges(context.timeRanges);
        break;
      case 'clear':
        clearAiHighlightedTimeRanges();
        break;
    }

    return {
      success: true,
      highlightedRanges: context.action === 'clear' ? 0 : context.timeRanges.length,
      message: context.description || `AI highlighted ${context.timeRanges.length} time ranges`,
      type: 'ai-highlight' // Distinguish from user selections
    };
  }
});
```

### 4. Component Integration - Dual System Support

#### Event Card Updates
**File**: `apps/calendar/src/components/event-card.tsx`

```typescript
// Component needs to handle both highlight types
const EventCard = ({
  event,
  isSelected, // User selection (existing)
  isAiHighlighted, // AI highlight (new)
  // ... other props
}) => {
  const highlightClasses = cn(
    'event-card',
    {
      'user-event-selected': isSelected,
      'ai-event-highlight': isAiHighlighted,
      'event-dual-highlighted': isSelected && isAiHighlighted
    }
  );

  return (
    <div className={highlightClasses}>
      {/* Event content */}
    </div>
  );
};
```

#### Day Column Updates
**File**: `apps/calendar/src/components/day-column.tsx`

```typescript
// Component needs to render both user selections AND AI highlights
const DayColumn = ({ date, events, /* ... */ }) => {
  const {
    // Existing user selection state
    currentCalendarContext: { selectedTimeRanges },
    // NEW: AI highlight state
    aiHighlightedTimeRanges,
    aiHighlightedEvents
  } = useAppStore();

  return (
    <div className="day-column">
      {/* Background grid */}

      {/* AI time highlights (yellow, behind user selections) */}
      {aiHighlightedTimeRanges.map((range, index) => (
        <TimeHighlight
          key={`ai-${index}`}
          range={range}
          type="ai"
          className="ai-time-highlight"
        />
      ))}

      {/* User time selections (existing color, above AI highlights) */}
      {selectedTimeRanges.ranges.map((range, index) => (
        <TimeHighlight
          key={`user-${index}`}
          range={range}
          type="user"
          className="user-time-selected"
        />
      ))}

      {/* Events with dual highlight support */}
      {events.map(event => (
        <EventCard
          key={event.id}
          event={event}
          isSelected={selectedEvents.events.some(e => e.id === event.id)}
          isAiHighlighted={aiHighlightedEvents.has(event.id)}
        />
      ))}
    </div>
  );
};
```

### 5. Chat Integration

#### Tool Registration
**File**: `apps/calendar/src/components/ai-assistant-panel.tsx`

```typescript
import { highlightEventsToolool, highlightTimeRangesTool } from '@/tools';

const { messages, sendMessage, status, stop } = useChat({
  id: activeConversationId,
  transport,
  clientTools: {
    highlightEventsToolool,
    highlightTimeRangesTool
  },
  onToolCallPart: (toolCall) => {
    // Handle AI tool execution feedback
    if (toolCall.toolName === 'highlightEvents' || toolCall.toolName === 'highlightTimeRanges') {
      // Provide visual feedback that AI has highlighted something
      console.log('AI highlighted:', toolCall.result);
    }
  },
  // ... other config
});
```

## Implementation Strategy & Progress

### Phase 1: Dual State System ✅ COMPLETED
1. ✅ Add AI highlight state to Zustand store (alongside existing user selection state)
2. ✅ Implement AI highlight actions (separate from user selection actions)
3. ✅ Ensure both systems can coexist without conflicts

### Phase 2: Dual Visual System 🔄 IN PROGRESS
1. ✅ Create yellow AI highlight CSS classes (OKLCH values with transparency)
2. ✅ Update EventCard to support both `isSelected` AND `isAiHighlighted`
3. 🔄 Update DayColumn to render both user selections AND AI highlights
4. ⏳ Test visual layering when both systems are active

### Phase 3: Client-Side Tools ⏳ PENDING
1. ⏳ Implement AI highlighting tools (separate from user selection logic)
2. ⏳ Add comprehensive error handling
3. ⏳ Test tool execution affects only AI state, not user state

### Phase 4: Integration & Polish ⏳ PENDING
1. ⏳ Register tools with chat system
2. ⏳ Add clear visual feedback for AI tool execution
3. ⏳ Test coexistence scenarios (AI highlights + user selections)
4. ⏳ Ensure no interference between the two systems

## Key Research Discoveries

### Infrastructure Already Exists
- **DayColumn Component**: Already accepts `aiHighlights: TimeHighlight[]` prop and filters to `aiForDay` (line 363-366)
- **CalendarDayRange Component**: Already passes `aiHighlights={aiHighlights}` to DayColumn (line 540)
- **Calendar Page**: Has placeholder `const [aiHighlights] = useState<TimeHighlight[]>([])` (line 330)

### Missing Implementation Pieces
1. **AI Time Highlight Rendering**: The `aiForDay` variable is computed in DayColumn but never rendered
2. **Store Connection**: Calendar page uses empty useState instead of Zustand store AI highlight state
3. **EventCardContent Props**: Missing `isAiHighlighted` prop to enable dual event highlighting

### Completed Work
- ✅ **Zustand Store**: Complete dual state management with AI highlight actions
- ✅ **Colors**: Yellow OKLCH values (`oklch(0.858 0.158 93.329)`) with proper transparency
- ✅ **EventCard**: Dual highlight support with proper visual layering and ring effects

## Detailed Remaining Tasks

### 1. Add AI Time Highlight Rendering to DayColumn
**File**: `apps/calendar/src/components/day-column.tsx`
**Location**: After system slots section (around line 452)
**Task**: Add rendering section for the computed `aiForDay` variable
```typescript
{/* AI time highlights (yellow, behind user selections) */}
<AnimatePresence>
  {aiForDay.map((h, index) => (
    <motion.div
      key={`ai-${index}`}
      className="absolute inset-x-0 rounded border pointer-events-none"
      style={{
        top: yForAbs(h.startAbs),
        height: Math.max(4, yForAbs(h.endAbs) - yForAbs(h.startAbs)),
        background: DEFAULT_COLORS.aiTimeHighlight,
        borderColor: DEFAULT_COLORS.aiTimeHighlightBorder,
        opacity: 0.8,
      }}
      // ... animation props
    />
  ))}
</AnimatePresence>
```

### 2. Connect Zustand Store to Calendar Page
**File**: `apps/calendar/src/app/calendar/page.tsx`
**Location**: Line 330 - replace useState with Zustand store
**Task**:
- Import `useAppStore` and get `aiHighlightedTimeRanges`
- Transform Zustand format to TimeHighlight format
- Replace `const [aiHighlights] = useState<TimeHighlight[]>([])` with actual store data

### 3. Add isAiHighlighted Prop to EventCardContent
**File**: `apps/calendar/src/components/event-card-content.tsx`
**Task**:
- Add `isAiHighlighted?: boolean` to EventCardContentProps interface
- Update className logic to support dual highlights (similar to EventCard)
- Pass from DayColumn: `isAiHighlighted={aiHighlightedEvents.has(e.id)}`

### 4. Create Client-Side Mastra Tools
**Files**:
- `apps/calendar/src/tools/highlight-events.ts`
- `apps/calendar/src/tools/highlight-time-ranges.ts`
- `apps/calendar/src/tools/index.ts`

**Schema Design**:
```typescript
// highlightEvents tool
{
  eventIds: string[];
  action: 'add' | 'replace' | 'clear';
  description?: string;
}

// highlightTimeRanges tool
{
  timeRanges: Array<{
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
    description?: string;
  }>;
  action: 'add' | 'replace' | 'clear';
  description?: string;
}
```

### 5. Register Tools with AI Assistant
**File**: `apps/calendar/src/components/ai-assistant-panel.tsx`
**Task**:
- Import tools from `@/tools`
- Add to `clientTools` prop in useChat configuration
- Add tool execution feedback handling

### 6. End-to-End Testing
- Test AI can highlight events by ID using client-side tools
- Test AI can highlight time ranges
- Test dual system coexistence (user selections + AI highlights)
- Test visual distinction (yellow AI vs blue user selections)
- Test proper layering when both systems are active simultaneously

## Success Criteria

### Functional Requirements
- ✅ AI can highlight events/times via client-side tools
- ✅ User can continue to select events/times via existing UI
- ✅ Both systems work simultaneously without interference
- ✅ AI highlights are visually distinct (yellow) from user selections
- ✅ Both highlight types are clearly visible when overlapping

### Independence Requirements
- ✅ AI actions don't affect user selection state
- ✅ User actions don't affect AI highlight state
- ✅ Each system can be cleared independently
- ✅ Visual treatments are distinct and recognizable

## Files to Create/Modify

### New Files
- `docs/ai-calendar-highlighting-plan.md` (this file)
- `apps/calendar/src/tools/highlight-events.ts`
- `apps/calendar/src/tools/highlight-time-ranges.ts`
- `apps/calendar/src/tools/index.ts`

### Modified Files
- `apps/calendar/src/store/app.ts` (add AI highlight state alongside user selection state)
- `apps/calendar/src/components/ai-assistant-panel.tsx` (integrate AI tools)
- `apps/calendar/src/components/event-card.tsx` (support dual highlights)
- `apps/calendar/src/components/day-column.tsx` (render both highlight systems)
- `apps/calendar/src/styles/globals.css` (add yellow AI highlight styles)

This plan ensures AI highlights and user selections remain completely independent while providing a cohesive visual experience.