# Calendar Mono - Claude Development Notes

## Project Overview
Advanced calendar application with AI-powered features, built using a modern TypeScript stack with Mastra AI agents, Next.js frontend, and Supabase backend.

## Architecture
- **Frontend**: Next.js 15 with TypeScript
- **AI Agent**: Mastra framework with persona-based agents
- **UI**: shadcn/ui components with Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand with persistence
- **Database**: Supabase (PostgreSQL) with local development
- **API**: Supabase REST API with AI SDK React for chat
- **Data Layer**: Dexie (IndexedDB) with offline-first sync pattern

## Development Setup
**Package Management**: We use PNPM for package management. Do not install packages with other package managers unless explicitly authorized!

### Prerequisites
- Node.js >=20.9.0 and pnpm
- Docker (for Supabase local development)
- Supabase CLI (available via npx)

### Getting Started
```bash
# Start the development servers (in parallel)
pnpm dev

# Individual services
cd apps/calendar && pnpm dev  # Frontend on :3010
cd apps/agent && pnpm dev    # Mastra agent on :3020

# Start Supabase local instance
npx supabase start

# Apply database migrations
npx supabase db reset

# Stop Supabase
npx supabase stop
```

### Process Management
- **Killing tasks (Windows)**: Use `taskkill //PID 68924 //F` (double slash, not single)
- **Killing tasks (Mac/Linux)**: Use `kill -9 PID`
- **Mastra port conflicts**: If port 3020 is in use, kill the process - don't try to delete lock files
- **Process lookup**: Use `netstat -ano | findstr :3020` (Windows) or `lsof -i :3020` (Mac/Linux) to find PID

### Environment Configuration
- **Frontend**: http://localhost:3010
- **Mastra Agent**: http://localhost:3020
- **Supabase API**: http://127.0.0.1:55321
- **Supabase GraphQL**: http://127.0.0.1:55321/graphql/v1
- **Supabase Studio**: http://127.0.0.1:55323
- **Database**: postgresql://postgres:postgres@127.0.0.1:55322/postgres

### Supabase Keys (Local Development)
```
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## Documentation Resources

### Mastra Documentation
Use the **Mastra MCP server** for accessing Mastra framework documentation:
- Agents, memory, tools, workflows
- Core concepts and API references
- Examples and best practices
- Latest updates and changelogs

### AI SDK Documentation
Reference the **`docs/api/` directory** for AI SDK React documentation:
- `ai_sdk_usechat.md` - useChat hook for streaming conversations
- `ai_sdk_uimessage.md` - Message types and formatting
- `ai_sdk_example_chatbot_with_usechat.md` - Complete chat implementation
- `ai_sdk_example_message_persistance.md` - Message storage patterns
- `ai_sdk_streaming_custom_data.md` - Custom streaming data
- And more comprehensive examples and patterns

### Project Plans
Reference the **`docs/plans/` directory** for architectural decisions:
- `gpt-plan-to-fix-data-v2.md` - Comprehensive offline-first data layer plan
- `calendar-events-offline-first-plan-adapted.md` - Adapted implementation plan
- Architecture decisions and implementation strategies

## Key Features Implemented

### 1. AI Agent System (Mastra v0.20+)
- **Dynamic Persona Agents**: Context-aware agents (calendar-assistant-agent, cal-agent) that adapt behavior based on selected persona
- **Memory Management**: Persistent conversation memory with resource/thread scoping (resourceId = userId:personaId)
- **Working Memory**:
  - calendar-assistant-agent: Disabled to prevent multiple LLM calls
  - cal-agent: Resource-level working memory enabled for user preferences
- **Model Selection**: Support for multiple LLM providers via OpenRouter API
- **Authentication**: Supabase JWT integration with MastraAuthSupabase
- **Custom Storage**: MastraSupabaseStore adapter with RLS enforcement via JWT tokens
- **Message Format**: AI SDK v5 (v2 format) with content.parts structure
- **Streaming Endpoint**: `/api/agents/{agentId}/stream/vnext/ui` for AI SDK v5 compatibility

### 2. AI Assistant Panel
- **Persona Selection**: Dropdown to switch between AI personalities
- **Conversation Management**: Persistent conversations with message history
- **Real-time Streaming**: AI SDK React useChat for smooth message streaming
- **Error Handling**: Graceful error display and recovery
- **Memory Context**: Automatic conversation scoping by user and persona

### 3. Conversation System
- **Conversation Selector**: Dropdown for existing conversations + "+" button for new
- **Message Persistence**: Stored in Mastra memory system
- **Title Generation**: Automatic conversation titles via Mastra
- **Persona Scoping**: Conversations linked to specific personas
- **Smart Switching**: Auto-select most recent conversation when changing personas

### 4. AI Time Highlights
- **Calendar Integration**: AI agents can highlight specific times on the calendar
- **Time Range Support**: Supports single times, ranges, and recurring patterns
- **Visual Indicators**: Colored overlays and badges on calendar grid
- **Interactive**: Click highlights to view AI reasoning and suggestions
- **Context Aware**: Highlights adapt based on user's schedule and preferences
- **Multi-Agent**: Different AI personas can create different types of highlights
- **Persistent Storage**: Highlights stored in database with full CRUD operations
- **Real-time Updates**: Live sync of highlights across sessions

### 5. Calendar Core Components
- **CalendarGrid**: Main calendar grid with timezone-aware rendering
- **DayColumn**: Individual day column with grid lines and events
- **EventCard**: Event display with category colors, meeting types, drag/resize
- **ActionBar**: Event management actions with animations (pack, spread, delete, rename)
- **NowMoment**: Current time indicator
- **TimeHighlights**: AI-generated time overlays and annotations
- **Collaborator Overlay**: Ctrl+Shift to show availability of selected users

### 6. Event Details Panel
- Side panel for editing event details
- All event fields with proper typing from CalEvent interface
- Real-time updates with optimistic UI
- Privacy settings, meeting configuration, AI management

### 7. Expandable Day View
- Click day headers to expand single day to full width
- Smooth framer-motion animations with spring physics
- Flexbox-based layout maintains grid integrity
- Toggle between expanded and collapsed states

### 8. Command Palette
- **Trigger**: Ctrl+/ to open, Escape to close
- **Search**: Filter commands, support for '/' commands and '?'/'ai:' AI queries
- **Built-in Commands**: Create Event, Toggle View, Go Today, Settings
- **State Management**: Zustand store with command palette state
- **Animations**: Smooth scale/fade with framer-motion

### 9. Offline-First Data Layer
- **Dexie (IndexedDB)**: Local-first storage with optimistic updates
- **Outbox Pattern**: Queue operations for eventual server sync
- **Smart Merging**: Automatic deduplication of rapid operations
- **RLS Enforcement**: Server-side row-level security via edge functions
- **Live Queries**: `useLiveQuery` for reactive UI updates

## Timezone Handling (CRITICAL)

### Overview
The calendar application is **timezone-aware** throughout. All date/time operations must respect the user's configured timezone to prevent date shifts and incorrect display.

### Key Utilities (src/components/cal-grid/utils.ts)
```typescript
// Timezone-aware date formatting
fmtDayInTimezone(d: Date, timeZone: string): string

// Timezone-aware time utilities
startOfDayInTimezone(d: Date, timeZone: string): Date
minutesInTimezone(d: Date, timeZone: string): number
fmtTimeInTimezone(t: TimeLike, timeZone: string): string
```

### Common Timezone Bugs
1. **Using `toLocaleDateString()` without timezone**: Always use `fmtDayInTimezone()` instead
2. **Using `.getDay()`, `.getHours()` without timezone**: Use Temporal API conversions
3. **Creating dates at midnight without timezone**: Use `Temporal.PlainDate.toZonedDateTime()`

### Example Fix Pattern
```typescript
// ❌ WRONG - uses browser timezone
const dayOfWeek = date.getDay();
const formatted = date.toLocaleDateString();

// ✅ CORRECT - uses user's timezone
const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
const zdt = instant.toZonedDateTimeISO(timezone);
const dayOfWeek = zdt.dayOfWeek === 7 ? 0 : zdt.dayOfWeek;
const formatted = fmtDayInTimezone(date, timezone);
```

### Agent Tool Integration
AI agent tools like `navigateToDates` parse date strings using Temporal API:
```typescript
const [year, month, day] = dateString.split('-').map(Number);
const plainDate = Temporal.PlainDate.from({ year, month, day });
const zonedDateTime = plainDate.toZonedDateTime({
  timeZone: timezone,
  plainTime: '00:00'
});
const date = new Date(zonedDateTime.epochMilliseconds);
```

## Database Schema

### Core Tables
```sql
-- AI Personas
CREATE TABLE ai_personas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text,
  traits text,
  instructions text,
  greeting text,
  agent_id text DEFAULT 'dynamicPersonaAgent',
  model_id text,
  temperature numeric,
  top_p numeric,
  is_default boolean DEFAULT false,
  properties_ext jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Events
CREATE TABLE events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  series_id uuid,
  title text NOT NULL,
  agenda text,
  online_event boolean DEFAULT false NOT NULL,
  online_join_link text,
  online_chat_link text,
  in_person boolean DEFAULT false NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean DEFAULT false NOT NULL,
  private boolean DEFAULT false NOT NULL,
  request_responses boolean DEFAULT false NOT NULL,
  allow_forwarding boolean DEFAULT true NOT NULL,
  invite_allow_reschedule_proposals boolean DEFAULT true NOT NULL,
  hide_attendees boolean DEFAULT false NOT NULL,
  history jsonb DEFAULT '[]'::jsonb,
  discovery event_discovery_types DEFAULT 'audience_only',
  join_model event_join_model_types DEFAULT 'invite_only',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Annotations (AI Time Highlights)
CREATE TABLE user_annotations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type annotation_type NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean DEFAULT false,
  recurrence_rule text,
  color colors DEFAULT 'blue',
  metadata jsonb DEFAULT '{}',
  ai_generated boolean DEFAULT false,
  ai_persona_id uuid REFERENCES ai_personas(id) ON DELETE SET NULL,
  ai_reasoning text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Event Details Personal
CREATE TABLE event_details_personal (
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id uuid REFERENCES user_calendars(id) ON DELETE SET NULL,
  category_id uuid REFERENCES user_categories(id) ON DELETE SET NULL,
  show_time_as show_time_as_extended DEFAULT 'busy',
  time_defense_level time_defense_level DEFAULT 'normal',
  ai_managed boolean DEFAULT false NOT NULL,
  ai_instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
```

### Enums
```sql
CREATE TYPE colors AS ENUM (
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
);

CREATE TYPE show_time_as_extended AS ENUM ('free', 'tentative', 'busy', 'oof', 'working_elsewhere');
CREATE TYPE time_defense_level AS ENUM ('flexible', 'normal', 'high', 'hard_block');
CREATE TYPE annotation_type AS ENUM ('highlight', 'note', 'reminder', 'suggestion', 'analysis');
CREATE TYPE event_discovery_types AS ENUM ('audience_only', 'tenant_only', 'public');
CREATE TYPE event_join_model_types AS ENUM ('invite_only', 'request_to_join', 'open_join');
CREATE TYPE calendar_type AS ENUM ('default', 'archive', 'user');
```

## File Structure
```
calendar-mono/
├── apps/
│   ├── calendar/               # Next.js frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn/ui components
│   │   │   │   ├── ai-chat-panel-v2/  # AI assistant panel
│   │   │   │   ├── cal-grid/   # Calendar grid component
│   │   │   │   ├── cal-schedule/  # Schedule view component
│   │   │   │   └── cal-extensions/  # Action bar, event cards, etc.
│   │   │   ├── hooks/
│   │   │   │   └── use-drag-time-suggestions.ts
│   │   │   ├── lib/
│   │   │   │   └── data-v2/    # Data layer (CURRENT STABLE VERSION)
│   │   │   │       ├── base/   # Core types, Dexie, sync, outbox
│   │   │   │       ├── domains/  # Domain-specific operations
│   │   │   │       └── index.ts  # Main export point
│   │   │   ├── store/
│   │   │   │   ├── app.ts      # Zustand app state (calendar view, selections)
│   │   │   │   └── chat.ts     # Zustand chat state
│   │   │   ├── ai-client-tools/  # Client-side AI tool handlers
│   │   │   └── contexts/
│   │   │       └── AuthContext.tsx
│   │   └── package.json
│   └── agent/                  # Mastra AI service
│       ├── src/
│       │   ├── mastra/
│       │   │   ├── index.ts    # Main Mastra config with middleware
│       │   │   ├── agents/
│       │   │   │   ├── calendar-assistant-agent.ts # Main agent
│       │   │   │   ├── cal-agent.ts                # Alternate agent
│       │   │   │   └── simple-test-agent.ts        # Test agent
│       │   │   ├── tools/      # Calendar tools (navigation, events, etc.)
│       │   │   ├── mcp-servers/  # MCP server configs
│       │   │   └── auth/       # Persona management
│       │   └── adapter/
│       │       ├── MastraSupabaseStore.ts # Custom storage adapter
│       │       └── mapping.ts  # ResourceId helpers
│       └── package.json
├── docs/
│   ├── api/                    # AI SDK documentation
│   ├── plans/                  # Architectural plans
│   └── resources/
└── supabase/
    ├── config.toml
    └── migrations/
        └── 20240924130000_calendar_events.sql
```

## Key TypeScript Types
```typescript
// AI Persona
interface AIPersona {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string | null;
  traits?: string | null;
  instructions?: string | null;
  greeting?: string | null;
  agent_id?: string | null;
  model_id?: string | null;
  temperature?: number | null;
  top_p?: number | null;
  is_default: boolean;
  properties_ext?: Json;
  created_at: string;
  updated_at: string;
}

// Event Resolved (combines event + personal details + role)
interface EventResolved {
  id: string;
  owner_id: string;
  title: string;
  start_time: Date;
  end_time: Date;
  all_day: boolean;
  private: boolean;
  // ... all event fields
  personal_details: ClientEDP | null;
  user_role: ClientEventUser | null;
  rsvp: ClientEventRsvp | null;
  calendar: { id: string; name: string; color: string } | null;
  category: { id: string; name: string; color: string } | null;
  role: 'owner' | 'organizer' | 'attendee' | 'viewer';
  following: boolean;
}

// Chat Conversation (from Mastra threads)
interface ChatConversation {
  id: string;
  title?: string | null;
  resourceId: string;  // Format: "userId:personaId"
  createdAt: string;
  metadata?: Record<string, any>;
  latest_message?: {
    content: unknown;
    role: string;
    createdAt: string;
  };
  isNew?: boolean;
}
```

## Performance Optimizations

### Caching Strategy
- **AI Personas**: 24-hour cache with invalidation on mutations
- **Conversations**: Real-time updates with optimistic UI
- **Messages**: Hybrid approach - stored messages + live useChat messages
- **Time Highlights**: Cached with range-based invalidation
- **Events**: Dexie with useLiveQuery for reactive updates

### Outbox Pattern (src/lib/data-v2/base/outbox-utils.ts)
**Smart Operation Merging**:
- New item → Merge subsequent updates into INSERT
- Updated items → Merge subsequent updates into single UPDATE
- Deleting existing items → Remove updates, keep DELETE
- Deleting new items → Remove INSERT/UPDATEs, don't add DELETE (never existed)

**Sync Optimization**:
```typescript
// Track pending pushes to prevent duplicate syncs
const pendingPushes = new Map<string, Promise<void>>();

// Debounce timers to batch rapid-fire operations
const debouncedPushTimers = new Map<string, NodeJS.Timeout>();
const PUSH_DEBOUNCE_MS = 50;

// Early return check in pushOutbox()
const count = await db.outbox.where('user_id').equals(userId).count();
if (count === 0) return; // Avoid lock acquisition
```

### Calendar Grid Performance
**Synchronous Ref Access**: Use `gridApi.current.getSelectedItemIds()` instead of state to avoid stale closures
```typescript
// ✅ CORRECT - synchronous, always up-to-date
const selectedIds = gridApi.current.getSelectedItemIds();
const selectedEvents = selectedIds
  .map(id => visibleEvents.find(e => e.id === id))
  .filter((e): e is EventResolved => e !== undefined);

// ❌ WRONG - async state, may be stale
const selectedEvents = gridSelections.items
  .filter((item) => item.type === 'event' && item.data);
```

**Batch Operations**: Use `Promise.all()` for parallel updates
```typescript
// Phase 1: Calculate all placements sequentially
const updates: Array<{ event: EventResolved; start_time: Date; end_time: Date }> = [];
for (const event of selectedEvents) {
  // ... calculate placement
  updates.push({ event, start_time, end_time });
}

// Phase 2: Apply all updates in parallel
await Promise.all(
  updates.map(({ event, start_time, end_time }) =>
    updateEventResolved(userId, event.id, { start_time, end_time })
  )
);
```

**Optimistic UI**: Clear selections/update UI immediately, then persist to Dexie
```typescript
// Clear selections immediately for instant visual feedback
if (gridApi.current) {
  gridApi.current.clearSelections();
}

// Then create events in parallel
const createdEvents = await Promise.all(...);
```

### Memory Management
- **Working Memory**:
  - calendar-assistant-agent: Disabled to prevent multiple LLM calls
  - cal-agent: Resource-level enabled for user preferences across conversations
- **Memory Scope**: Resource-level persistence (resourceId = userId:personaId)
- **Message Limit**: Last 10 messages retained for context
- **Storage**: Custom MastraSupabaseStore with JWT-based RLS enforcement
- **Message Format**: AI SDK v5 (v2) with type determined by format parameter

### State Management
- **Zustand**: Persisted conversation/persona selection and calendar state
- **Dexie useLiveQuery**: Reactive queries that auto-update on data changes
- **React Refs**: To prevent stale closures in event handlers

## Data Layer Architecture (data-v2)

### Core Files
- **dexie.ts**: IndexedDB schema and singleton
- **sync.ts**: Bidirectional sync (pull from server, push outbox)
- **outbox-utils.ts**: Outbox operations with smart merging
- **mapping.ts**: Server ↔ Client data transformation
- **client-types.ts**: TypeScript types for Dexie tables

### Domain Operations Pattern
```typescript
// Domain file: events-resolved.ts
export function useEventsResolvedRange(
  uid: string | undefined,
  range: { from: number; to: number }
): EventResolved[] {
  return useLiveQuery(
    async () => {
      if (!uid) return [];

      // Get event IDs where user has access
      const eventUsers = await db.event_users.where('user_id').equals(uid).toArray();
      const eventIds = eventUsers.map((eu) => eu.event_id);

      // Get events in range
      const events = await db.events.bulkGet(eventIds);
      const validEvents = events
        .filter((e): e is ClientEvent => e !== undefined)
        .filter((event) => event.start_time_ms < range.to && event.end_time_ms > range.from)
        .sort((a, b) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

      // Resolve with related data
      return resolveEvents(validEvents, uid);
    },
    [uid, range.from, range.to],
    []
  ) as EventResolved[];
}

export async function updateEventResolved(
  uid: string,
  eventId: string,
  input: { start_time?: Date; end_time?: Date; /* ... */ }
): Promise<void> {
  // 1. Get existing from Dexie
  const existing = await db.events.get(eventId);

  // 2. Update in Dexie first (optimistic)
  await db.events.put({ ...existing, ...updates });

  // 3. Enqueue in outbox for server sync
  await addToOutboxWithMerging(uid, 'events', 'update', serverPayload, eventId);
}
```

### Critical Update Pattern Fix
**IMPORTANT**: When updating only `start_time`/`end_time`, ensure Dexie update happens:
```typescript
// ✅ CORRECT - checks for time fields OR other fields
if (isOwner && (Object.keys(eventFields).length > 0 || start_time || end_time)) {
  await db.events.put(updated);
}

// ❌ WRONG - skips update when only time fields change
if (isOwner && Object.keys(eventFields).length > 0) {
  await db.events.put(updated);
}
```

## Development Notes

### Important Gotchas
- **Timezone Awareness**: ALWAYS use timezone-aware utilities, never `toLocaleDateString()` or `.getDay()` directly
- **Mastra v0.20+**: Breaking changes to memory API - now uses `memory.resource` and `memory.thread` format
- **Runtime Context**: Uses kebab-case keys (`user-id`, `persona-id`, `model-id`) in `data` block
- **ResourceId Format**: Always `userId:personaId` for conversation scoping
- **Storage Adapter**: MastraSupabaseStore requires runtimeContext to extract userId/personaId for RLS
- **Message Type**: Determined by `format` parameter ('v1' or 'v2'), not hardcoded
- **Conversations**: Only fetch when a persona is selected (conversations are persona-scoped)
- **Process Management**: Use `taskkill //PID` (double slash) on Windows, not `/PID`
- **Port Conflicts**: Kill processes, don't try to delete lock files
- **Synchronous vs Async State**: Use refs (`gridApi.current`) for up-to-date selection state, not React state
- **Outbox Merging**: Understand insert/update/delete merging behavior to avoid duplicate operations
- **Dexie Update Conditionals**: Always check for time field changes, not just eventFields object

### Best Practices
- Use `docker exec` for checking DB tables locally, not direct connections
- Mastra streams responses - use AI SDK React useChat with DefaultChatTransport for proper handling
- Persona data is pre-fetched and sent in `data` block to avoid DB calls during streaming
- All animations use framer-motion with spring physics
- Always check for `selectedPersonaId` before making conversation API calls
- Client payload structure:
  - `memory: { resource: "userId:personaId", thread: { id } }` for Mastra memory
  - `data: { "user-id", "persona-id", "model-id", ... }` for runtime context
- Test thoroughly before implementing data layer changes
- Use `Promise.all()` for parallel independent operations
- Clear UI optimistically, then persist to database
- Use Temporal API for all timezone-aware date operations

### Current State
- **AI Highlights**: Fully implemented and working
- **Calendar UI**: Stable with timezone-aware rendering, expandable days, time highlights
- **AI Assistant**: Full chat system with personas and conversations
- **Memory System**: Mastra v0.20+ with custom Supabase storage adapter
- **Data Layer**: Offline-first with Dexie + outbox pattern (STABLE)
- **Database**: Performance indexes added, schema supports all features
- **Timezone Handling**: Comprehensive Temporal API integration throughout

## Mastra Integration Details

### Client Request Format (AI SDK v5)
```typescript
// Request payload structure
{
  memory: {
    resource: "userId:personaId",           // Mastra resource scoping
    thread: {                               // Optional for existing conversations
      id: "thread-uuid"
    }
  },
  data: {
    "user-id": "user-uuid",                 // Runtime context (kebab-case)
    "persona-id": "persona-uuid",
    "model-id": "anthropic/claude-3.5-sonnet",
    "persona-name": "Assistant",
    "persona-traits": "...",
    "persona-instructions": "...",
    "persona-temperature": 0.7,
    "persona-top-p": null,
    "user-timezone": "America/Chicago",
    "user-current-datetime": "2025-10-10T..."
  },
  calendarContext: { /* optional */ }
}
```

### Middleware Processing (mastra/index.ts)
1. **JWT Extraction**: Authorization header → `runtime.set('jwt-token', jwt)`
2. **Memory Extraction**: `body.memory.thread.id` → `runtime.set('threadId', id)`
3. **Data Extraction**: All `body.data` fields → runtime context (kebab-case keys)
4. **Calendar Context**: `body.calendarContext` → stringified in runtime

### Storage Adapter (MastraSupabaseStore)
- **Initialization**: Requires `runtimeContext` for per-request JWT extraction
- **Mode Selection**: 'user' mode (with JWT) for RLS enforcement, 'service' mode for global operations
- **UserId/PersonaId**: Extracted from runtime context using kebab-case keys (`user-id`, `persona-id`)
- **Message Type**: Determined by `format` parameter ('v1' or 'v2'), defaults to v2
- **Resource Methods**: getResourceById, saveResource, updateResource for working memory
- **Thread/Message Storage**: Stores in `ai_threads` and `ai_messages` tables with user_id and persona_id columns

### Agent Configuration
Both agents use dynamic memory configuration via runtimeContext:
- **calendar-assistant-agent**: Working memory disabled, last 10 messages
- **cal-agent**: Resource-level working memory enabled for user preferences

## Package Dependencies
### Frontend (apps/calendar)
- `@ai-sdk/react` - Chat functionality and streaming
- `@tanstack/react-query` - Server state management (limited use)
- `zustand` - Client state management
- `@supabase/supabase-js` - Database client
- `framer-motion` - Animations
- `tailwindcss` + `@shadcn/ui` - Styling and components
- `dexie` + `dexie-react-hooks` - IndexedDB with React integration
- `@js-temporal/polyfill` - Timezone-aware date operations

### Agent (apps/agent)
- `@mastra/core` - AI agent framework (v0.20+)
- `@mastra/memory` - Conversation memory
- `@mastra/auth-supabase` - Authentication with JWT
- Custom `MastraSupabaseStore` - Supabase storage adapter with RLS
- `@ai-sdk/openai` - LLM provider (v5 models)
- `@ai-sdk/openai-compatible` - OpenRouter integration
- `zod` - Schema validation

## Testing & Debugging

### Build Commands
```bash
# Build frontend for production
pnpm build

# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

### Service URLs
- **Frontend**: http://localhost:3010
- **Agent API**: http://localhost:3020/api/docs (Swagger UI)
- **Database**: Supabase Studio at http://127.0.0.1:55323
- **GraphQL**: http://127.0.0.1:55321/graphql/v1

### Debugging Tips
- **Logs**: Check terminal outputs for both services
- **Process checking**: `netstat -ano | findstr :PORT` then `taskkill //PID XXXX //F`
- **Cache clearing**: Stop dev server, clear .next folder, restart
- **Type errors**: Run `npx tsc --noEmit` to check TypeScript compilation
- **Database**: Use Supabase Studio for data inspection
- **Dexie Debugging**: Use browser DevTools → Application → IndexedDB
- **AI Agent**: Check `/api/docs` for Mastra API documentation
- **Timezone Issues**: Check browser console for date formatting, verify Temporal API usage

## Common Issues & Solutions

### Issue: Events not updating visually after drag/drop
**Cause**: Dexie update conditional not checking for time-only changes
**Solution**: Ensure `updateEventResolved` checks `start_time || end_time` in addition to `eventFields`

### Issue: Calendar displays wrong weekdays (e.g., Sundays instead of Mondays)
**Cause**: Using `toLocaleDateString()` which uses browser timezone instead of user timezone
**Solution**: Use `fmtDayInTimezone(date, timezone)` instead

### Issue: Collaborator overlay shows wrong work hours
**Cause**: Using `.getDay()`, `.getHours()` which return browser local time
**Solution**: Use Temporal API to convert to user's timezone before checking hours

### Issue: Outbox draining too frequently
**Cause**: Each operation triggers immediate sync
**Solution**: Implement debouncing with 50ms delay to batch rapid-fire operations

### Issue: Pack/spread only moving first event
**Cause**: Not awaiting database operations before next event
**Solution**: Use `Promise.all()` to batch all updates in parallel

### Issue: Quick create has visual "jitter"
**Cause**: Selections clearing after database operations complete
**Solution**: Clear selections immediately (optimistic), then create events in parallel
