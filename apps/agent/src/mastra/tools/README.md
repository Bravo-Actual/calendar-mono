# Mastra Tools - Domain-Based Organization

Tools are organized by data domain to align with the application's architecture and improve maintainability.

## Directory Structure

```
tools/
├── events/                 # Calendar events domain
│   └── calendar-events.ts  # CRUD operations for calendar events
├── navigation/             # Calendar UI navigation
│   └── calendar-navigation.ts  # Client-side calendar view navigation
├── time/                   # Time analysis and scheduling
│   └── time-analysis.ts    # Find free time, analyze availability
├── user-calendars/         # User calendar management
│   └── index.ts            # CRUD for user's calendar collections
├── user-categories/        # Event categories
│   └── index.ts            # CRUD for event categories
├── user-settings/          # User preferences
│   └── index.ts            # Time zone, work hours, etc.
├── annotations/            # AI-generated highlights (mostly client-side)
│   ├── ai-calendar-highlights.ts
│   ├── highlight-events.ts
│   └── highlight-time-ranges.ts
└── index.ts                # Main export point for all tools
```

## Tool Organization Principles

### 1. Domain Alignment
Each directory corresponds to a data domain from `apps/calendar/src/lib/data-v2/domains/`:
- `events/` → event operations
- `user-calendars/` → user calendar management
- `user-categories/` → category management
- `user-settings/` → user preferences
- `time/` → time-based analysis
- `navigation/` → UI navigation (client-side)
- `annotations/` → AI highlights (mostly client-side)

### 2. Granularity Guidelines
Tools follow mid-level granularity:
- ❌ **Too granular**: `getEventTitle`, `getEventStartTime`, `getEventEndTime`
- ❌ **Too broad**: `manageEvents({ action: 'create' | 'update' | 'delete' })`
- ✅ **Just right**: `getCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`

### 3. Scalability Strategy
Current setup: ~15 tools across 7 domains (optimal for single agent)

When adding more tools:
1. **Stay under 30 tools per agent** - beyond this, consider creating specialized agents
2. **Group related operations** - keep CRUD operations together within a domain
3. **Use clear naming** - prefix with domain when needed (e.g., `getUserCalendarsTool`)
4. **Consider agent specialization** - split into `calendarAgent`, `schedulingAgent`, `analyticsAgent`

## Tool Naming Conventions

- **Events domain**: `{verb}CalendarEvent` (e.g., `getCalendarEvents`, `createCalendarEvent`)
- **User domains**: `{verb}User{Resource}Tool` (e.g., `getUserCalendarsTool`, `updateUserCategoryTool`)
- **Analysis tools**: `{verb}{Analysis}` (e.g., `findFreeTime`)
- **Navigation tools**: `navigate{Target}` (e.g., `navigateCalendar`)

## Adding New Tools

1. Determine the data domain
2. Add tool to the appropriate domain directory
3. Export from domain's `index.ts` (if exists) or directly from file
4. Add to main `tools/index.ts` exports
5. Update agent tool lists in `src/mastra/agents/`

## Removed Tools

- `getCurrentDateTime` - Redundant, datetime provided in runtime context
- `analyzeSchedule` - Stub, not implemented
- `webSearch` - Stub, not implemented
- `client-tools-guide` - Documentation only

## Runtime Context vs Tools

Prefer runtime context for:
- Current datetime/timezone (always passed by client)
- User identity (JWT token)
- Persona configuration
- Calendar UI context (current view, selected events)

Use tools for:
- Database operations
- Data transformations
- External API calls
- Complex business logic
