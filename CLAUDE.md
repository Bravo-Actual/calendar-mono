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

## Key Features Implemented

### 1. AI Agent System (Mastra)
- **Dynamic Persona Agents**: Context-aware agents that adapt behavior based on selected persona
- **Memory Management**: Persistent conversation memory with resource/thread scoping
- **Working Memory**: Disabled to prevent multiple LLM calls and improve performance
- **Model Selection**: Support for multiple LLM providers via OpenRouter API
- **Authentication**: Supabase JWT integration for secure agent access

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

### 4. Calendar Core Components
- **CalendarDayRange**: Main calendar container with week/workweek view (renamed from CalendarWeek)
- **DayColumn**: Individual day column with grid lines and events
- **EventCard**: Event display with category colors, meeting types, drag/resize
- **ActionBar**: Event management actions with animations
- **NowMoment**: Current time indicator

### 5. Event Details Panel
- Side panel for editing event details
- All event fields with proper typing from CalEvent interface
- Real-time updates with optimistic UI
- Privacy settings, meeting configuration, AI management

### 6. Expandable Day View
- Click day headers to expand single day to full width
- Smooth framer-motion animations with spring physics
- Flexbox-based layout maintains grid integrity
- Toggle between expanded and collapsed states

### 7. Command Palette
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

-- Chat Conversations are now managed by Mastra threads, not in Supabase

-- Events
CREATE TABLE events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  ai_suggested boolean DEFAULT false,
  show_time_as show_time_as DEFAULT 'busy',
  category event_category DEFAULT 'neutral',
  is_online_meeting boolean DEFAULT false,
  is_in_person boolean DEFAULT false,
  meta jsonb DEFAULT '{}',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Enums
```sql
CREATE TYPE event_category AS ENUM (
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
);

CREATE TYPE show_time_as AS ENUM ('busy', 'tentative', 'free');
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
│   │   │   │   └── conversation-selector.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-ai-personas.ts
│   │   │   │   ├── use-chat-conversations.ts
│   │   │   │   └── use-conversation-messages.ts
│   │   │   ├── store/
│   │   │   │   └── chat.ts     # Zustand chat state
│   │   │   └── contexts/
│   │   │       └── AuthContext.tsx
│   │   └── package.json
│   └── agent/                  # Mastra AI service
│       ├── src/
│       │   └── mastra/
│       │       ├── index.ts    # Main Mastra config
│       │       ├── agents/
│       │       │   └── calendar-assistant-agent.ts
│       │       ├── tools/
│       │       └── auth/
│       └── package.json
├── docs/
│   ├── api/                    # AI SDK documentation
│   │   ├── ai_sdk_usechat.md
│   │   ├── ai_sdk_example_chatbot_with_usechat.md
│   │   └── ...
│   └── resources/
└── supabase/
    ├── config.toml
    └── migrations/
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

// Calendar Event (full type in src/components/types.ts)
interface CalEvent {
  id: EventId;
  owner: string;
  creator: string;
  title: string;
  agenda?: string;
  online_event: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person: boolean;
  start_time: string; // ISO timestamp
  duration: number; // minutes
  all_day: boolean;
  private: boolean;
  request_responses: boolean;
  allow_forwarding: boolean;
  hide_attendees: boolean;
  show_time_as: ShowTimeAs;
  user_category_id?: string;
  time_defense_level: TimeDefenseLevel;
  ai_managed: boolean;
  ai_instructions?: string;
  start: number; // epoch ms UTC (computed)
  end: number;   // epoch ms UTC (computed)
}
```

## Performance Optimizations

### Caching Strategy
- **AI Personas**: 24-hour cache with invalidation on mutations
- **Conversations**: Real-time updates with optimistic UI
- **Messages**: Hybrid approach - stored messages + live useChat messages

### Memory Management
- **Working Memory**: Disabled in Mastra agents to prevent multiple LLM calls
- **Memory Scope**: Resource-level persistence across threads for same user
- **Message Limit**: Last 10 messages retained for context

### State Management
- **Zustand**: Persisted conversation/persona selection
- **TanStack Query**: Server state with proper caching
- **React**: Refs to prevent stale closures in event handlers

## Development Notes

### Important Gotchas
- **Mastra Types**: `StorageThreadType` is not exported from `@mastra/client-js`. We define our own interface in `mastra-api.ts`
- **Conversations**: Only fetch when a persona is selected (conversations are persona-scoped)
- **Process Management**: Use `taskkill //PID` (double slash) on Windows, not `/PID`
- **Port Conflicts**: Kill processes, don't try to delete lock files
- **Memory Configuration**: Working memory disabled to prevent multiple LLM responses

### Best Practices
- Use `docker exec` for checking DB tables locally, not direct connections
- Mastra streams responses - use AI SDK React useChat for proper handling
- Persona data is pre-fetched and sent with requests to avoid DB calls during streaming
- All animations use framer-motion with spring physics
- Always check for `selectedPersonaId` before making conversation API calls

## Package Dependencies
### Frontend (apps/calendar)
- `@ai-sdk/react` - Chat functionality and streaming
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `@supabase/supabase-js` - Database client
- `framer-motion` - Animations
- `tailwindcss` + `@shadcn/ui` - Styling and components

### Agent (apps/agent)
- `@mastra/core` - AI agent framework
- `@mastra/memory` - Conversation memory
- `@mastra/auth-supabase` - Authentication
- `@mastra/pg` - PostgreSQL storage
- `@ai-sdk/openai` - LLM provider
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