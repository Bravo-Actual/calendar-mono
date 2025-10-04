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
│   └── agent/                  # Mastra AI service
│       ├── src/
│       │   ├── mastra/
│       │   │   ├── index.ts    # Main Mastra config with middleware
│       │   │   ├── agents/
│       │   │   │   ├── calendar-assistant-agent.ts # Main agent
│       │   │   │   ├── cal-agent.ts                # Alternate agent
│       │   │   │   ├── simple-test-agent.ts        # Test agent
│       │   │   │   └── mastra-example-dynamic-agent.ts
│       │   │   ├── tools/      # Calendar tools
│       │   │   ├── mcp-servers/ # MCP server configs
│       │   │   └── auth/       # Persona management
│       │   └── adapter/
│       │       ├── MastraSupabaseStore.ts # Custom storage adapter
│       │       └── mapping.ts  # ResourceId helpers
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
  resourceId: string;  // Format: "userId:personaId"
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
- **Working Memory**:
  - calendar-assistant-agent: Disabled to prevent multiple LLM calls
  - cal-agent: Resource-level enabled for user preferences across conversations
- **Memory Scope**: Resource-level persistence (resourceId = userId:personaId)
- **Message Limit**: Last 10 messages retained for context
- **Storage**: Custom MastraSupabaseStore with JWT-based RLS enforcement
- **Message Format**: AI SDK v5 (v2) with type determined by format parameter

### State Management
- **Zustand**: Persisted conversation/persona selection and calendar state
- **TanStack Query**: Server state with proper caching and offline support
- **React**: Refs to prevent stale closures in event handlers

## Development Notes

### Important Gotchas
- **Mastra v0.20+**: Breaking changes to memory API - now uses `memory.resource` and `memory.thread` format
- **Runtime Context**: Uses kebab-case keys (`user-id`, `persona-id`, `model-id`) in `data` block
- **ResourceId Format**: Always `userId:personaId` for conversation scoping
- **Storage Adapter**: MastraSupabaseStore requires runtimeContext to extract userId/personaId for RLS
- **Message Type**: Determined by `format` parameter ('v1' or 'v2'), not hardcoded
- **Conversations**: Only fetch when a persona is selected (conversations are persona-scoped)
- **Process Management**: Use `taskkill //PID` (double slash) on Windows, not `/PID`
- **Port Conflicts**: Kill processes, don't try to delete lock files
- **Data Layer**: Current system works - avoid breaking changes without careful planning

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

### Current State
- **AI Highlights**: Fully implemented and working
- **Calendar UI**: Stable with expandable days, time highlights, events
- **AI Assistant**: Full chat system with personas and conversations
- **Memory System**: Mastra v0.20+ with custom Supabase storage adapter
- **Data Layer**: Current system stable - future offline-first improvements planned
- **Database**: Performance indexes added, schema supports all features

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
    "user-current-datetime": "2025-10-04T..."
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
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `@supabase/supabase-js` - Database client
- `framer-motion` - Animations
- `tailwindcss` + `@shadcn/ui` - Styling and components

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
- **AI Agent**: Check `/api/docs` for Mastra API documentation