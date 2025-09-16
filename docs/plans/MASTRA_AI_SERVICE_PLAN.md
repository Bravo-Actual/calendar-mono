# Calendar Mastra AI Service Implementation Plan

## Overview
Create a complete Mastra AI service for the calendar monorepo based on the coincrew agent project. This service will provide AI-powered calendar assistance with full persona management, authentication, and calendar-specific tools.

## Key Requirements
- **Full auth integration**: JWT handling and persona management from coincrew
- **Calendar-focused MCP server**: Calendar operations, scheduling tools
- **Standalone service**: Independent Node.js server on separate port
- **Production deployment**: Designed for standalone node server deployment

## Research Findings

### Coincrew Agent Endpoint Pattern
From `apps/app/src/config/api.ts`:
```typescript
AI_CHAT: `${AI_SERVICE_URL}/api/agents/dynamicPersonaAgent/stream/vnext/ui`
```

Where:
- **Development**: `http://localhost:3002`
- **Production**: `https://agent.coincrew.ai`

### Calendar Service Endpoint Pattern
- **Development**: `http://localhost:3001/api/agents/calendarAssistantAgent/stream/vnext/ui`
- **Production**: `https://calendar-agent.yourdomain.com/api/agents/calendarAssistantAgent/stream/vnext/ui`

## Project Structure

```
apps/agent/
├── package.json                    # Mastra dependencies from coincrew
├── .env.example                    # Environment configuration
├── .env.local                      # Local development config
├── .gitignore                      # Git ignore rules
├── src/mastra/
│   ├── index.ts                    # Main Mastra instance with middleware
│   ├── models.ts                   # AI model configuration
│   ├── agents/
│   │   └── calendar-assistant-agent.ts  # Calendar-focused agent
│   ├── auth/                       # Complete auth system from coincrew
│   │   ├── persona-manager.ts      # Full persona integration
│   │   └── jwt-storage.ts          # JWT handling utilities
│   ├── mcp-servers/
│   │   ├── calendar-mcp.ts         # NEW: Calendar operations MCP
│   │   └── web-search-mcp.ts       # Port from coincrew
│   ├── tools/
│   │   ├── calendar-events.ts      # CRUD operations
│   │   ├── time-analysis.ts        # Time conflict detection
│   │   ├── scheduling-suggestions.ts # AI-powered scheduling
│   │   └── index.ts                # Tool exports
│   └── workflows/
│       └── calendar-workflow.ts    # Calendar workflow
```

## Implementation Steps

### Phase 1: Project Setup and Core Infrastructure

#### 1.1 Create Project Structure
```bash
# Create apps/agent directory
mkdir -p apps/agent/src/mastra/{agents,auth,mcp-servers,tools,workflows}
```

#### 1.2 Package.json Setup
Port exact dependencies from coincrew agent:
```json
{
  "name": "@calendar/agent",
  "version": "1.0.0",
  "description": "Calendar AI Service using Mastra",
  "main": "index.js",
  "type": "module",
  "engines": {
    "node": ">=20.9.0"
  },
  "scripts": {
    "dev": "mastra dev --env .env.local",
    "build": "mastra build",
    "start": "mastra start"
  },
  "dependencies": {
    "@ai-sdk/openai": "^2.0.28",
    "@mastra/auth-supabase": "^0.10.5",
    "@mastra/core": "^0.16.3",
    "@mastra/libsql": "^0.14.1",
    "@mastra/loggers": "^0.10.11",
    "@mastra/mcp": "latest",
    "@mastra/memory": "^0.15.1",
    "@openrouter/ai-sdk-provider": "^1.2.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^24.3.1",
    "dotenv": "^17.2.2",
    "mastra": "^0.12.3",
    "typescript": "^5.9.2"
  }
}
```

#### 1.3 Environment Configuration
Create `.env.example`:
```env
# Agent Service Configuration
NODE_ENV=development
PORT=3001

# OpenRouter AI Configuration
OPENROUTER_API_KEY=your-openrouter-key

# Supabase Configuration (same as calendar app)
VITE_SUPABASE_URL=http://127.0.0.1:55321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_JWT_SECRET=your-jwt-secret

# Service URLs
APP_URL=http://localhost:3010
AGENT_URL=http://localhost:3001
```

### Phase 2: Complete Auth System Migration

#### 2.1 Port Auth Files from Coincrew
**Copy exactly from coincrew agent:**
- `src/mastra/auth/persona-manager.ts` - Full persona system with caching
- `src/mastra/auth/jwt-storage.ts` - JWT utilities and management

#### 2.2 Key Auth Features to Preserve
- Supabase integration for persona fetching
- Persona caching mechanism
- JWT token validation
- Runtime context management
- User authentication flow

### Phase 3: Core Mastra Configuration

#### 3.1 Models Configuration
Port from coincrew `src/mastra/models.ts`:
- OpenRouter model configuration
- Model selection logic
- Temperature and parameter settings
- Default model fallbacks

#### 3.2 Main Mastra Instance
Port from coincrew `src/mastra/index.ts`:
- Mastra core setup
- Complete middleware stack:
  - Development logging
  - JWT extraction middleware
  - Model and persona selection
  - Error handling
- Server configuration with OpenAPI docs

### Phase 4: Calendar Assistant Agent

#### 4.1 Create Calendar Assistant Agent
Adapt `dynamic-persona-agent.ts` → `calendar-assistant-agent.ts`:

**Key Changes:**
- **Agent Name**: `'CalendarAssistant'` (for Mastra routing)
- **Base Instructions**: Calendar and productivity focused
- **Tools**: Calendar operations instead of crypto tools
- **Context**: Calendar-specific user context

**Base Instructions Pattern:**
```typescript
const BASE_INSTRUCTIONS = `
You are a professional calendar and productivity assistant.

YOUR EXPERTISE:
- Calendar management and scheduling optimization
- Time blocking and productivity strategies
- Meeting coordination and conflict resolution
- Event organization and categorization
- Work-life balance and schedule analysis

TOOL USAGE:
You have comprehensive calendar tools for:
- Creating, updating, and managing events
- Finding optimal meeting times
- Analyzing schedule conflicts
- Providing productivity insights
- Suggesting time blocks and organization

RESPONSE GUIDELINES:
- Always respond according to your persona
- Keep responses concise and actionable
- Provide specific scheduling suggestions
- Help users optimize their time management
`;
```

#### 4.2 Calendar-Specific Tools Integration
Replace crypto tools with calendar tools:
- Calendar CRUD operations
- Time analysis and conflict detection
- Scheduling suggestions and optimization
- Productivity insights and recommendations

### Phase 5: Calendar MCP Server and Tools

#### 5.1 Calendar MCP Server
Create `src/mastra/mcp-servers/calendar-mcp.ts`:
- Calendar event CRUD operations
- Supabase database integration
- Event query and filtering
- Time range analysis
- Conflict detection algorithms

#### 5.2 Calendar Tools Development
Create individual tool files:

**`tools/calendar-events.ts`:**
- `getCalendarEvents`: Fetch events with date/category filters
- `createCalendarEvent`: Create events with smart defaults
- `updateCalendarEvent`: Modify existing events
- `deleteCalendarEvent`: Remove events with confirmation

**`tools/time-analysis.ts`:**
- `findFreeTime`: Analyze calendar for available slots
- `detectConflicts`: Identify scheduling conflicts
- `analyzeWorkload`: Assess schedule density and balance

**`tools/scheduling-suggestions.ts`:**
- `suggestMeetingTimes`: AI-powered optimal scheduling
- `recommendTimeBlocks`: Productivity-focused time blocking
- `optimizeSchedule`: Schedule reorganization suggestions

#### 5.3 Tool Integration Pattern
Follow coincrew pattern:
- Runtime context for JWT access
- Proper error handling and logging
- Zod schema validation
- Supabase client integration

### Phase 6: Service Integration

#### 6.1 Update Calendar App Endpoint
**Modify `apps/calendar/src/components/ai-assistant-panel.tsx`:**
```typescript
const transport = new DefaultChatTransport({
  api: 'http://localhost:3001/api/agents/calendarAssistantAgent/stream/vnext/ui',
  // Keep existing headers and body configuration
});
```

#### 6.2 Request/Response Format
**Request Body:**
```json
{
  "modelId": "openrouter/gpt-5-chat-latest",
  "personaId": "user-persona-id",
  "personaName": "Calendar Assistant",
  "personaTraits": "...",
  "personaTemperature": 0.7,
  "personaAvatar": "...",
  "messages": [...],
  "stream": true
}
```

**Headers:**
- `Authorization: Bearer {jwt}`
- `Content-Type: application/json`

### Phase 7: Monorepo Integration

#### 7.1 Update Root Configuration
**Root `package.json` scripts:**
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "dev:agent": "turbo run dev --filter=@calendar/agent",
    "build:agent": "turbo run build --filter=@calendar/agent"
  }
}
```

**Update `turbo.json`:**
```json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".mastra/**", "dist/**"]
    }
  }
}
```

#### 7.2 Development Workflow
- Calendar app: `pnpm dev` (port 3010)
- Agent service: `pnpm dev:agent` (port 3001)
- Both services can run simultaneously

### Phase 8: Testing and Validation

#### 8.1 Integration Testing
- Verify JWT token passing from calendar to agent
- Test persona selection and switching
- Validate calendar tool operations
- Confirm streaming responses work correctly

#### 8.2 Functional Testing
- Create/update/delete calendar events via AI
- Test scheduling suggestions and conflict detection
- Verify persona behavior changes based on selection
- Test error handling and recovery

### Phase 9: Production Configuration

#### 9.1 Production Environment
```env
NODE_ENV=production
PORT=3001

# Production Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=production-anon-key
SUPABASE_JWT_SECRET=production-jwt-secret

# Production URLs
APP_URL=https://calendar.yourdomain.com
AGENT_URL=https://calendar-agent.yourdomain.com
```

#### 9.2 Deployment Strategy
- **Calendar App**: Static deployment (Vercel/Netlify)
- **Agent Service**: Node.js server deployment (Railway/Render/Fly.io)
- **Database**: Production Supabase instance
- **Domain**: `calendar-agent.yourdomain.com`

## Key Files to Port from Coincrew

### Exact Copies (No Modification)
1. `src/mastra/auth/persona-manager.ts` - Complete persona system
2. `src/mastra/auth/jwt-storage.ts` - JWT utilities
3. `src/mastra/models.ts` - AI model configuration

### Adaptations Required
1. `src/mastra/index.ts` - Main Mastra instance (update agent references)
2. `src/mastra/agents/dynamic-persona-agent.ts` → `calendar-assistant-agent.ts`
3. `package.json` - Update name and remove crypto dependencies
4. `.env.example` - Update for calendar context

### New Calendar-Specific Files
1. `src/mastra/mcp-servers/calendar-mcp.ts`
2. `src/mastra/tools/calendar-events.ts`
3. `src/mastra/tools/time-analysis.ts`
4. `src/mastra/tools/scheduling-suggestions.ts`
5. `src/mastra/workflows/calendar-workflow.ts`

## API Endpoints

### Development
- **Health Check**: `http://localhost:3001/health`
- **API Docs**: `http://localhost:3001/api/docs`
- **Chat Endpoint**: `http://localhost:3001/api/agents/calendarAssistantAgent/stream/vnext/ui`

### Production
- **Health Check**: `https://calendar-agent.yourdomain.com/health`
- **API Docs**: `https://calendar-agent.yourdomain.com/api/docs`
- **Chat Endpoint**: `https://calendar-agent.yourdomain.com/api/agents/calendarAssistantAgent/stream/vnext/ui`

## Success Criteria

1. **Agent Service Running**: Mastra service starts on port 3001
2. **Auth Integration**: JWT tokens properly validated from calendar app
3. **Persona System**: Persona selection and behavior changes work
4. **Calendar Tools**: Can perform CRUD operations on calendar events
5. **AI Responses**: Streaming responses work in calendar AI panel
6. **Error Handling**: Graceful error handling and logging
7. **Documentation**: Swagger UI accessible for API testing

## Timeline Estimate

- **Phase 1-2**: Project setup and auth migration (2-3 hours)
- **Phase 3-4**: Core Mastra and agent configuration (3-4 hours)
- **Phase 5**: Calendar tools and MCP server (4-5 hours)
- **Phase 6-7**: Integration and testing (2-3 hours)
- **Phase 8-9**: Production configuration (1-2 hours)

**Total Estimated Time**: 12-17 hours

## Notes

- Preserve exact auth architecture from coincrew for consistency
- Focus on calendar-specific functionality while maintaining proven patterns
- Ensure proper error handling and logging throughout
- Design for production deployment from the start
- Test integration thoroughly before considering complete