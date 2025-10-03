# Mastra to LangGraph Agent Migration Status

This document tracks the migration of tools and capabilities from the Mastra agent (apps/agent) to the LangGraph agent (apps/calendar-ai).

## Migration Overview

**Status**: In Progress
**Current Focus**: Calendar event CRUD operations completed, memory tools completed
**Next Priority**: Time analysis and navigation tools

---

## Tool Migration Status

### ✅ Completed (LangGraph Has Feature Parity)

#### 1. Calendar Event CRUD Operations
- **Mastra**: `getCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`
- **LangGraph**: ✅ Implemented in `apps/calendar-ai/src/utils/calendar-event-tools.ts`
- **Status**: **COMPLETE** - Enhanced with `events_resolved` view
- **Improvements**:
  - Uses database view for optimized queries (single query vs complex joins)
  - Full-text search support with GIN indexes
  - Supports both date range mode (consecutive) and date array mode (non-consecutive)
  - Comprehensive filtering: categories, calendars, event types, AI-managed, roles, RSVP
  - Bulk update and delete operations
  - Performance optimized with 12+ database indexes

#### 2. Memory Management Tools
- **Mastra**: Built-in memory system with PostgreSQL adapter
- **LangGraph**: ✅ Implemented in `apps/calendar-ai/src/utils/memory-tools.ts`
- **Status**: **COMPLETE**
- **Features**:
  - `save_user_memory`: Save memories with automatic deduplication
  - `search_user_memories`: Full-text search across user memories
  - `delete_user_memory`: Remove specific memories
  - Scoped by user/persona/thread
  - Automatic title/tag generation
  - Support for expiration dates and priorities

#### 3. Current Time
- **Mastra**: `getCurrentDateTime` (removed - passed in runtime context)
- **LangGraph**: ✅ `getCurrentTime` in `apps/calendar-ai/src/utils/tools.ts`
- **Status**: **COMPLETE**
- **Note**: Returns ISO timestamp, simpler implementation

---

### ⏳ Not Yet Migrated (Mastra Has, LangGraph Doesn't)

#### 4. Time Analysis (Priority: HIGH)
- **Mastra**: `findFreeTime` in `apps/agent/src/mastra/tools/time-analysis.ts`
- **LangGraph**: ❌ Not implemented
- **Description**: Find free time slots in user's calendar within work schedule
- **Features to migrate**:
  - Search date range for gaps between events
  - Filter by minimum duration (default 30 minutes)
  - Respect user's work periods
  - Consider user timezone
  - Uses edge function `find-free-time` for complex logic
- **Complexity**: Medium (requires work period logic and edge function)

#### 5. Calendar Navigation (Priority: HIGH)
- **Mastra**: `navigateCalendar` in `apps/agent/src/mastra/tools/calendar-navigation.ts`
- **LangGraph**: ❌ Not implemented
- **Description**: CLIENT-SIDE TOOL - Navigate calendar UI to specific dates
- **Features to migrate**:
  - View types: day, week, workweek, custom-days, dates array
  - Date range mode (consecutive dates)
  - Date array mode (non-consecutive dates)
  - Updates Zustand calendar store
- **Complexity**: Low (schema-only, execution in browser)
- **Note**: Requires client-side tool handler setup in LangGraph

#### 6. User Time Settings (Priority: MEDIUM)
- **Mastra**: `getUserTimeSettingsTool`, `updateUserTimeSettingsTool`
- **LangGraph**: ❌ Not implemented
- **Description**: Get and update user's time preferences and work schedule
- **Features to migrate**:
  - Get: timezone, time_format, week_start_day, work periods
  - Update: timezone, time_format, week_start_day
  - Work periods: separate CRUD operations (array of day/start/end)
- **Complexity**: Low (direct database queries)

#### 7. User Calendars Management (Priority: MEDIUM)
- **Mastra**: `getUserCalendarsTool`, `createUserCalendarTool`, `updateUserCalendarTool`, `deleteUserCalendarTool`
- **LangGraph**: ❌ Not implemented
- **Description**: Manage user's personal calendars
- **Features to migrate**:
  - List all user calendars
  - Create calendar with name/color/type/visibility
  - Update calendar properties
  - Delete calendar (with cascade handling)
- **Complexity**: Low (CRUD operations on user_calendars table)

#### 8. User Categories Management (Priority: MEDIUM)
- **Mastra**: `getUserCategoriesTool`, `createUserCategoryTool`, `updateUserCategoryTool`, `deleteUserCategoryTool`
- **LangGraph**: ❌ Not implemented
- **Description**: Manage user's event categories
- **Features to migrate**:
  - List all user categories
  - Create category with name/color/is_default
  - Update category properties
  - Delete category (with cascade handling)
- **Complexity**: Low (CRUD operations on user_categories table)

---

### 🗑️ Removed (Not Needed in LangGraph)

#### 9. Stub/Placeholder Tools
- **Mastra**: `analyzeSchedule`, `webSearch`
- **Status**: Removed from Mastra, never fully implemented
- **Reason**: Were stubs, not production tools

#### 10. AI Calendar Highlights
- **Mastra**: `highlight-time-ranges.ts`, `highlight-events.ts`, `ai-calendar-highlights.ts`
- **Status**: Functionality replaced by user_annotations table and UI
- **Reason**: Highlights now managed through database and client-side UI, not agent tools

---

## Architecture Differences

### Mastra Agent (Legacy - Port 3020)
- Framework: Mastra v0.19+
- Memory: Custom PostgreSQL adapter with working memory
- Tools: Mastra tool system with createTool()
- Streaming: Mastra's built-in streaming
- Auth: Custom JWT storage in runtime context

### LangGraph Agent (Current - Port 3030)
- Framework: LangChain + LangGraph (React agent pattern)
- Memory: Direct Supabase integration for threads and memories
- Tools: LangChain DynamicStructuredTool with Zod schemas
- Streaming: AI SDK v5 UIMessageStream with streamEvents
- Auth: JWT passed via configurable parameter to tools
- Performance: Uses events_resolved view for optimized queries

---

## Client-Side Tool Pattern

Both agents support client-side tools (Pattern B) where:
- **Schema defined in agent**: Tells LLM what the tool does and its parameters
- **Execution in browser**: Actual logic runs in React app with access to Zustand, UI state
- **Handler registration**: Frontend maps tool names to handler functions

**Mastra**: `apps/calendar/src/ai-client-tools/handlers/`
**LangGraph**: Need to implement similar pattern (likely same handlers can be reused)

---

## Migration Priorities

### Phase 1: Core Calendar Features ✅ COMPLETE
1. ✅ Calendar event CRUD
2. ✅ Memory management
3. ✅ Current time

### Phase 2: Essential Tools (CURRENT)
4. ⏳ Time analysis (findFreeTime)
5. ⏳ Calendar navigation
6. ⏳ User time settings

### Phase 3: Configuration Management
7. ⏳ User calendars CRUD
8. ⏳ User categories CRUD

---

## Technical Notes

### Database Views
The LangGraph implementation uses `events_resolved` view which simplifies queries:
- Joins events, personal details, calendars, categories, roles, RSVPs
- Full-text search with tsvector
- 12+ performance indexes
- Filters by user_id for RLS-style security

### Tool Authentication
**Mastra**: JWT stored in runtime context via custom storage
**LangGraph**: JWT passed in `config?.configurable?.jwt` parameter to each tool

### Streaming Implementation
**Mastra**: Uses Mastra's streamText with custom streaming handlers
**LangGraph**: Uses LangGraph's `streamEvents` with AI SDK v5 protocol (text-start, text-delta, text-end)

---

## Migration Checklist

For each tool migration:
- [ ] Review Mastra tool implementation
- [ ] Create equivalent DynamicStructuredTool with Zod schema
- [ ] Implement execute function with JWT authentication
- [ ] Test with events_resolved view if applicable
- [ ] Add to tools array in `apps/calendar-ai/src/utils/tools.ts`
- [ ] Update this document
- [ ] Test with actual agent conversations

---

## Next Steps

1. **Implement findFreeTime** - High priority, users need to find free time slots
2. **Implement navigateCalendar** - High priority, essential for calendar UX
3. **Implement user settings tools** - Medium priority, needed for personalization
4. **Implement calendars/categories CRUD** - Medium priority, configuration management
5. **Update CLAUDE.md** with final tool list when migration complete
