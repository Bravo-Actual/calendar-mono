# Calendar Mono - Claude Development Notes

## Project Overview
Advanced calendar application with AI-powered features, built using a modern TypeScript stack with Mastra AI agents, Next.js frontend, and Supabase backend.

## Architecture
- **Frontend**: Next.js 15 with TypeScript
- **AI Agent**: LangGraph (LangChain-based) on port 3030
- **UI**: shadcn/ui components with Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand with persistence
- **Database**: Supabase (PostgreSQL) with local development
- **API**: Supabase REST API with AI SDK React for chat
- **Data Layer**: TanStack Query with IndexedDB offline persistence

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
cd apps/calendar && pnpm dev     # Frontend on :3010
cd apps/calendar-ai && pnpm dev  # LangGraph agent on :3030

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
- **LangGraph Agent**: http://localhost:3030
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

### 1. AI Agent System (LangGraph)
- **Dynamic Persona Agents**: Context-aware agents that adapt behavior based on selected persona
- **LangGraph Framework**: React-style agent with tool calling and streaming support
- **Memory Management**: Persistent conversation memory with user/persona/thread scoping
- **Model Selection**: Support for multiple LLM providers via OpenRouter API (Claude, GPT-4, etc.)
- **Authentication**: Supabase JWT integration for secure agent and tool access
- **Calendar Tools**: Full CRUD operations on events using events_resolved view
- **Memory Tools**: Save, search, and manage user memories with automatic deduplication

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

### 4. AI Time Highlights (Latest Feature)
- **Calendar Integration**: AI agents can highlight specific times on the calendar
- **Time Range Support**: Supports single times, ranges, and recurring patterns
- **Visual Indicators**: Colored overlays and badges on calendar grid
- **Interactive**: Click highlights to view AI reasoning and suggestions
- **Context Aware**: Highlights adapt based on user's schedule and preferences
- **Multi-Agent**: Different AI personas can create different types of highlights
- **Persistent Storage**: Highlights stored in database with full CRUD operations
- **Real-time Updates**: Live sync of highlights across sessions

### 5. Calendar Core Components
- **CalendarDayRange**: Main calendar container with week/workweek view
- **DayColumn**: Individual day column with grid lines and events
- **EventCard**: Event display with category colors, meeting types, drag/resize
- **ActionBar**: Event management actions with animations
- **NowMoment**: Current time indicator
- **TimeHighlights**: AI-generated time overlays and annotations

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

## Database Schema

### Views for AI Agents

```sql
-- Events Resolved View (for LangGraph agent)
-- Joins events with personal details, calendars, categories, roles, and RSVPs
-- Optimized for AI queries with full-text search support
CREATE VIEW events_resolved AS
SELECT
  -- All event fields (id, owner_id, series_id, title, agenda, times, etc.)
  e.*,
  -- Personal details (calendar_id, category_id, show_time_as, time_defense_level, ai_managed, ai_instructions)
  edp.calendar_id, edp.category_id, edp.show_time_as, edp.time_defense_level, edp.ai_managed, edp.ai_instructions,
  -- Calendar info
  cal.name as calendar_name,
  cal.color as calendar_color,
  -- Category info
  cat.name as category_name,
  cat.color as category_color,
  -- User role
  eu.role as user_role,
  -- RSVP info
  er.rsvp_status,
  er.attendance_type,
  er.note as rsvp_note,
  er.following as rsvp_following,
  -- Computed fields
  CASE WHEN e.owner_id = edp.user_id THEN 'owner'
       WHEN eu.role IS NOT NULL THEN eu.role::text
       ELSE 'viewer' END as computed_role,
  COALESCE(er.following, false) as computed_following,
  edp.user_id,
  -- Full-text search vector
  to_tsvector('english', COALESCE(e.title, '') || ' ' || COALESCE(e.agenda, '') || ' ' ||
              COALESCE(cal.name, '') || ' ' || COALESCE(cat.name, '')) as search_vector
FROM events e
LEFT JOIN event_details_personal edp ON e.id = edp.event_id
LEFT JOIN user_calendars cal ON edp.calendar_id = cal.id
LEFT JOIN user_categories cat ON edp.category_id = cat.id
LEFT JOIN event_users eu ON e.id = eu.event_id AND eu.user_id = edp.user_id
LEFT JOIN event_rsvps er ON e.id = er.event_id AND er.user_id = edp.user_id;

-- Key Benefits:
-- - Single query vs complex client-side joins
-- - Full-text search with GIN indexes on title, agenda, calendar, and category
-- - Filter on any field (dates, categories, calendars, event types, AI-managed, roles, RSVP)
-- - Performance optimized with 12+ indexes
-- - Filter by user_id to get user-specific event data
```

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
  series_id uuid,
  title text NOT NULL,
  agenda text,
  online_event boolean DEFAULT false NOT NULL,
  online_join_link text,
  online_chat_link text,
  in_person boolean DEFAULT false NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  start_time_ms bigint GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM start_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED,
  end_time_ms bigint GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM end_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED,
  all_day boolean DEFAULT false NOT NULL,
  private boolean DEFAULT false NOT NULL,
  request_responses boolean DEFAULT true NOT NULL,
  allow_forwarding boolean DEFAULT true NOT NULL,
  allow_reschedule_request boolean DEFAULT true NOT NULL,
  hide_attendees boolean DEFAULT false NOT NULL,
  history jsonb DEFAULT '[]'::jsonb,
  discovery event_discovery_types DEFAULT 'audience_only' NOT NULL,
  join_model event_join_model_types DEFAULT 'invite_only' NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Event RSVPs
CREATE TABLE event_rsvps (
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rsvp_status rsvp_status DEFAULT 'tentative' NOT NULL,
  attendance_type attendance_type DEFAULT 'unknown' NOT NULL,
  note text,
  following boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Event Users (roles)
CREATE TABLE event_users (
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role DEFAULT 'attendee' NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
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

CREATE TYPE show_time_as AS ENUM ('free', 'tentative', 'busy', 'oof', 'working_elsewhere');
CREATE TYPE time_defense_level AS ENUM ('flexible', 'normal', 'high', 'hard_block');
CREATE TYPE annotation_type AS ENUM ('highlight', 'note', 'reminder', 'suggestion', 'analysis');
CREATE TYPE event_discovery_types AS ENUM ('audience_only', 'tenant_only', 'public');
CREATE TYPE event_join_model_types AS ENUM ('invite_only', 'request_to_join', 'open_join');
CREATE TYPE calendar_type AS ENUM ('default', 'archive', 'user');
CREATE TYPE rsvp_status AS ENUM ('tentative', 'accepted', 'declined');
CREATE TYPE attendance_type AS ENUM ('in_person', 'virtual', 'unknown');
CREATE TYPE user_role AS ENUM ('viewer', 'contributor', 'owner', 'delegate_full', 'attendee');
```

## File Structure
```
calendar-mono/
├── apps/
│   ├── calendar/               # Next.js frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn/ui components
│   │   │   │   ├── ai/         # AI chat components
│   │   │   │   ├── calendar-day-range.tsx
│   │   │   │   ├── ai-assistant-panel.tsx
│   │   │   │   ├── conversation-selector.tsx
│   │   │   │   └── time-highlights.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-ai-personas.ts
│   │   │   │   ├── use-chat-conversations.ts
│   │   │   │   ├── use-conversation-messages.ts
│   │   │   │   └── use-annotations.ts
│   │   │   ├── lib/
│   │   │   │   └── data/       # Data layer
│   │   │   │       ├── base/   # Core types, mapping, persistence
│   │   │   │       ├── domains/ # Domain-specific hooks
│   │   │   │       └── queries.ts # Main export point
│   │   │   ├── store/
│   │   │   │   ├── chat.ts     # Zustand chat state
│   │   │   │   └── calendar.ts # Calendar view state
│   │   │   └── contexts/
│   │   │       └── AuthContext.tsx
│   │   └── package.json
│   └── calendar-ai/            # LangGraph AI service
│       ├── src/
│       │   ├── agent.ts        # Agent graph creation
│       │   ├── server.ts       # Express server
│       │   ├── routes/
│       │   │   ├── chat.ts     # Chat streaming endpoint
│       │   │   └── threads.ts  # Conversation management
│       │   ├── utils/
│       │   │   ├── tools.ts    # Tool exports
│       │   │   ├── calendar-event-tools.ts  # Event CRUD
│       │   │   └── memory-tools.ts          # Memory management
│       │   ├── storage/
│       │   │   └── supabase.ts # Database operations
│       │   └── middleware/
│       │       └── auth.ts     # JWT authentication
│       └── package.json
├── docs/
│   ├── api/                    # AI SDK documentation
│   ├── plans/                  # Architectural plans
│   │   ├── gpt-plan-to-fix-data-v2.md
│   │   └── calendar-events-offline-first-plan-adapted.md
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

// AI Time Highlight
interface UserAnnotation {
  id: string;
  user_id: string;
  type: 'highlight' | 'note' | 'reminder' | 'suggestion' | 'analysis';
  title: string;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day: boolean;
  recurrence_rule?: string | null;
  color: string;
  metadata?: Json;
  ai_generated: boolean;
  ai_persona_id?: string | null;
  ai_reasoning?: string | null;
  created_at: string;
  updated_at: string;
}

// Chat Conversation (from Mastra threads)
interface ChatConversation {
  id: string;
  title?: string | null;
  resourceId: string;  // User ID
  createdAt: string;
  metadata?: Record<string, any>;
  latest_message?: {
    content: unknown;
    role: string;
    createdAt: string;
  };
  isNew?: boolean; // Client-side flag for "new conversation" entry
}
```

## Performance Optimizations

### Caching Strategy
- **AI Personas**: 24-hour cache with invalidation on mutations
- **Conversations**: Real-time updates with optimistic UI
- **Messages**: Hybrid approach - stored messages + live useChat messages
- **Time Highlights**: Cached with range-based invalidation
- **Events**: TanStack Query with IndexedDB persistence

### Memory Management
- **Working Memory**: Disabled in Mastra agents to prevent multiple LLM calls
- **Memory Scope**: Resource-level persistence across threads for same user
- **Message Limit**: Last 10 messages retained for context

### State Management
- **Zustand**: Persisted conversation/persona selection and calendar state
- **TanStack Query**: Server state with proper caching and offline support
- **React**: Refs to prevent stale closures in event handlers

## Development Notes

### Important Gotchas
- **Mastra Types**: `StorageThreadType` is not exported from `@mastra/client-js`. We define our own interface in `mastra-api.ts`
- **Conversations**: Only fetch when a persona is selected (conversations are persona-scoped)
- **Process Management**: Use `taskkill //PID` (double slash) on Windows, not `/PID`
- **Port Conflicts**: Kill processes, don't try to delete lock files
- **Memory Configuration**: Working memory disabled to prevent multiple LLM responses
- **Data Layer**: Current system works - avoid breaking changes without careful planning

### Best Practices
- Use `docker exec` for checking DB tables locally, not direct connections
- Mastra streams responses - use AI SDK React useChat for proper handling
- Persona data is pre-fetched and sent with requests to avoid DB calls during streaming
- All animations use framer-motion with spring physics
- Always check for `selectedPersonaId` before making conversation API calls
- Test thoroughly before implementing data layer changes

### Current State
- **AI Highlights**: Fully implemented and working
- **Calendar UI**: Stable with expandable days, time highlights, events
- **AI Assistant**: Full chat system with personas and conversations
- **Data Layer**: Current system stable - future offline-first improvements planned
- **Database**: Performance indexes added, schema supports all features
- **LangGraph Migration**: In progress - calendar event CRUD tools completed

## LangGraph Agent Tools (New Service)

### Implemented Tools
**Calendar Event CRUD** - All using `events_resolved` view:
- `get_calendar_events`: Query with comprehensive filtering
  - Date modes: range (startDate/endDate) OR array (dates[])
  - Filters: categories, calendars, event types, AI-managed, roles, RSVP
  - Full-text search across title, agenda, calendar, category
  - Limit: up to 1000 events per query
- `create_calendar_event`: Create events via edge function
- `update_calendar_event`: Bulk updates with owner/attendee permissions
- `delete_calendar_event`: Bulk deletes with ownership validation

### Remaining Tools to Migrate from Mastra
1. Time analysis (`findFreeTime`)
2. Calendar navigation (`navigateCalendar`)
3. User time settings (get/update)
4. User calendars management (CRUD)
5. User categories management (CRUD)

## Package Dependencies
### Frontend (apps/calendar)
- `@ai-sdk/react` - Chat functionality and streaming
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `@supabase/supabase-js` - Database client
- `framer-motion` - Animations
- `tailwindcss` + `@shadcn/ui` - Styling and components

### Mastra Agent (apps/agent) - Legacy
- `@mastra/core` - AI agent framework
- `@mastra/memory` - Conversation memory
- `@mastra/auth-supabase` - Authentication
- `@mastra/pg` - PostgreSQL storage
- `@ai-sdk/openai` - LLM provider
- `zod` - Schema validation

### LangGraph Agent (apps/calendar-ai) - New
- `@langchain/core` - LangChain core framework
- `@langchain/langgraph` - Graph-based agent orchestration
- `@langchain/openai` - OpenAI LLM integration
- `@supabase/supabase-js` - Database client
- `express` - Web server
- `zod` - Schema validation
- `ai` - Vercel AI SDK for streaming

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
- **AI Agent**: Check `/api/docs` for Mastra API documentation