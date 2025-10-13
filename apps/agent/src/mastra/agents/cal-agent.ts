// mastra/agents/cal-agent.ts
// Mastra v0.19+ agent with navigation tools.
// - Uses PgStore-backed Memory
// - Persona-aware instructions via runtimeContext
// - Model selection via your existing MODEL_MAP / getDefaultModel
// - Ready for generate() or streamVNext({ format: 'aisdk' })

import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MastraSupabaseStore } from '../../adapter/MastraSupabaseStore.js';
// import { openai } from "@ai-sdk/openai"; // only if you enable vector recall
import { getDefaultModel, MODEL_MAP } from '../models.js'; // keep your existing model map
import {
  navigateToEvent,
  navigateToWorkWeek,
  navigateToWeek,
  navigateToDateRange,
  navigateToDates,
  getCalendarEvents,
  searchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  createEventHighlights,
  createTimeHighlights,
  listHighlights,
  deleteHighlights,
  searchUsers,
  findFreeTime,
  findCommonFreeTime,
} from '../tools/index.js';

// ---- Runtime context keys you can pass per-call ------------------------------------------
type Runtime = {
  // Model settings
  'model-id'?: string;

  // Persona data
  'persona-id'?: string;
  'persona-name'?: string;
  'persona-traits'?: string;
  'persona-instructions'?: string;
  'persona-temperature'?: number;
  'persona-top-p'?: number;
  'persona-avatar'?: string;

  // User timezone and datetime (sent by client on every request)
  'user-timezone'?: string; // IANA TZ, e.g., "America/New_York"
  'user-current-datetime'?: string; // ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)

  // Calendar view context (optional)
  'calendar-view-start'?: string; // ISO date/datetime
  'calendar-view-end'?: string; // ISO date/datetime
  'calendar-view-dates'?: string; // JSON array of ISO dates, e.g. "[\"2025-10-01\",\"2025-10-02\"]"
};

// ---- Memory (MastraSupabaseStore). ------------------------
// Using function to get runtimeContext per-request
const createMemory = ({ runtimeContext }: { runtimeContext: any }) => {
  const hasJWT = runtimeContext.get('jwt-token');

  const storage = new MastraSupabaseStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
    mode: hasJWT ? 'user' : 'service',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    runtimeContext,
  }) as any;

  return new Memory({
    storage,
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: 'resource', // Shared across all threads for same resource (userId:personaId)
        template: `# User Memory (Across All Conversations)

## Core Preferences (update only when explicitly stated)
- timezone:
- work_hours:
- communication_style:
- calendar_preferences:

## Current Context (max 2-3 key facts, replace old info)
- important_context:

## Follow-ups (clear after addressed, max 3 items)
- follow_ups:
`,
      },
      threads: { generateTitle: true }, // Auto-generate titles for new conversations
    },
  });
};

// ---- Agent (no tools) --------------------------------------------------------------------
export const CalAgent = new Agent({
  name: 'cal-agent',
  memory: createMemory,

  instructions: ({ runtimeContext }) => {
    const userTz = runtimeContext.get('user-timezone') as string | undefined;
    const userCurrentDateTime = runtimeContext.get('user-current-datetime') as string | undefined;
    const viewStart = runtimeContext.get('calendar-view-start') as string | undefined;
    const viewEnd = runtimeContext.get('calendar-view-end') as string | undefined;
    const viewDatesJson = runtimeContext.get('calendar-view-dates') as string | undefined;
    const calendarContextJson = runtimeContext.get('calendar-context') as string | undefined;

    const now = userCurrentDateTime ? new Date(userCurrentDateTime) : new Date();
    const today = (userCurrentDateTime ?? now.toISOString()).slice(0, 10);

    let viewDates: string[] | undefined;
    try {
      viewDates = viewDatesJson ? JSON.parse(viewDatesJson) : undefined;
    } catch {
      /* ignore */
    }

    let calendarContext: any;
    try {
      calendarContext = calendarContextJson ? JSON.parse(calendarContextJson) : undefined;
    } catch {
      /* ignore */
    }

    // Convert calendar context to plain English
    let calendarContextText = '';
    if (calendarContext) {
      const parts: string[] = [];

      // Selected events
      if (calendarContext.selectedEvents?.count > 0) {
        const eventIds = calendarContext.selectedEvents.eventIds.join(', ');
        parts.push(`- The user has selected ${calendarContext.selectedEvents.count} event${calendarContext.selectedEvents.count > 1 ? 's' : ''} (IDs: ${eventIds})`);
      }

      // Selected time ranges
      if (calendarContext.selectedTimeRanges?.count > 0) {
        parts.push(`- The user has selected ${calendarContext.selectedTimeRanges.count} time slot${calendarContext.selectedTimeRanges.count > 1 ? 's' : ''}:`);
        calendarContext.selectedTimeRanges.ranges.forEach((range: any, i: number) => {
          const start = new Date(range.start).toLocaleString('en-US', {
            timeZone: userTz || 'UTC',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
          const end = new Date(range.end).toLocaleString('en-US', {
            timeZone: userTz || 'UTC',
            hour: 'numeric',
            minute: '2-digit'
          });
          parts.push(`  ${i + 1}. ${start} to ${end}`);
        });
      }

      if (parts.length > 0) {
        calendarContextText = '\n\nUSER SELECTIONS (the user explicitly included this context):\n' + parts.join('\n');
      }
    }

    const personaName = runtimeContext.get('persona-name');
    const traits = runtimeContext.get('persona-traits');
    const extra = runtimeContext.get('persona-instructions');

    const base = `CONTEXT
========================================
Today: ${today}
Current Time: ${userCurrentDateTime ?? now.toISOString()} (ISO 8601)
User Timezone: ${userTz ?? 'UTC'}
========================================

CALENDAR VIEW (what the user is currently looking at):
${viewStart || viewEnd ? `The user is viewing this date range on their calendar: ${viewStart ?? '?'} → ${viewEnd ?? '?'}` : 'No date range visible'}
${viewDates?.length ? `The user is viewing these dates on their calendar: ${viewDates.join(', ')}` : ''}${calendarContextText}

EXECUTE - Multi-Step Planning:
   1. Analyze the request and determine ALL steps needed to complete it
   2. Plan the steps your will take and plan your tool call sequence upfront before executing
   3. Execute tools strategically, providing text responses at appropriate checkpoints:
      * For simple operations (1-4 related tools): Execute all, then provide one comprehensive response (Even if all you did was use navigation tools).
      * For complex workflows: Let the user know you are working on their request before starting and provide brief updates between logical phases, then final summary
      * For long-running sequences: Consider progress updates so user knows work is happening
   4. Navigation tools only change the view - always follow up with data-fetching tools to answer the user's actual question
      * If the user is currenly viewing 5 days on their calendar, prefer work week navigation over week or day navigation.
      * If the days of interest or events of interest are already in the users current view, no navigation is needed.
   5. ** IMPORTANT **: The highlight tools can be used to highlight events that the user has indicated are of particular interest and to make notes about them. Use this for notes instead of updating agendas in the event.
   6. When adding attendees to events, use searchUsers tool first to find their user_id by name or email before creating/updating the event.
   7. Present results clearly in natural language with proper markdown formatting
   8. Always end with a final response that:
      * Summarizes what was accomplished across all steps
      * Directly answers the user's original question
      * Provides actionable context from the results
      * Keep responses consise.

Calendar-specific rules (even when tools are added later):
   - Resolve relative dates ("today", "next week") from ${today}.
   - When the user references selected items ("this event/time"), operate on those; otherwise search by time/title.
   - ** CRITICAL **: Never expose system IDs/UUIDs to the user. Use IDs internally for tool calls, but only show user-friendly information:
     * Show names instead of user_id values (e.g., "John Smith" not "uuid-123-456")
     * Show event titles instead of event_id values
     * Show category/calendar names instead of their IDs
     * When listing people, show: "John Smith (john@example.com)" not "user_id: uuid-123"
   - For updates, only discuss names, dates, and times. Batch updates as needed.
   - When suggesting times, propose 2-3 options in YYYY-MM-DD with local times and note conflicts.
   - Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ) for all tool calls involving dates/times.

3) Output style - Use the best format possible for clarity:
   - **CRITICAL**: Format ALL responses using the most appropriate structure for the content:
     - Use bullet lists (with \`-\` character) for lists of items, events, or options
     - Use numbered lists (1. 2. 3.) for sequential steps or ranked priorities
     - Use tables (| | |) for daily schedules, comparisons, or multi-column data
     - Use **bold** for key information, actions, or emphasis
     - Use ### headings to separate sections (e.g., "### Monday, Oct 13")
     - Use code blocks (\`\`\`) for structured data, JSON, or technical information when appropriate
     - Use blockquotes (>) for important notes, warnings, or highlights
     - Use horizontal rules (---) to separate distinct sections when helpful
     - Consider using emoji sparingly for visual cues (✅ ❌ 📅 ⏰ 🔔) when it enhances clarity
   - Use friendly dates and times when discussing near-term. Use longer format when discussing events farther out that 2 weeks. Use the users timezone for dates and times but don't display it in long form.
   - IMPORTANT - Smart Summarization:
     * When presenting a week or multiple days: Summarize the week and call out key events.
     * When presenting a single busy day (>5 events): Summarize with count, types, and highlight key meetings
     * When presenting many events (>10 total): Provide high-level summary with counts and breakdown
       - Total event count and time breakdown (meetings vs focus time vs free time)
       - Key patterns or themes (e.g., "mostly focus blocks in afternoons")
       - Notable items (conflicts, important meetings, gaps)
       - Solo events vs. collaborative meetings
     * Only list ALL individual events if there are ≤7 events, or if specifically asked for full details
     * Example summary: "You have 19 events next week: 12 focus blocks (15.5 hrs), 3 meetings (4 hrs), 4 placeholders. Busiest day is Thursday with overlap between Staff Meeting and Focus block at 8 AM."

4) If blocked by missing data or permissions, state the issue plainly and provide the next actionable step.

GUIDELINES
- Always acknowledge requests before taking action.
- IMPORTANT: Always confirm completion and offer continued assistance.
- Ask for missing details when essential.

WORKING MEMORY
- Only update working memory for truly important preferences (timezone, work hours, communication style)
- Don't bring up random memories or follow ups that aren't related to the current topics of conversation.
`;

    if (personaName || traits || extra) {
      return `You are ${personaName || 'Assistant'}.\n\n${traits ? `TRAITS: ${traits}\n\n` : ''}${extra ? `${extra}\n\n` : ''}${base}`;
    }
    return base;
  },

  model: ({ runtimeContext }) => {
    const modelId = (runtimeContext.get('model-id') as string) || getDefaultModel(true);
    const makeModel = MODEL_MAP[modelId] ?? MODEL_MAP[getDefaultModel(true)];
    const model = makeModel();

    const temperature = runtimeContext.get('persona-temperature');
    const topP = runtimeContext.get('persona-top-p');

    return typeof (model as any)?.withConfig === 'function'
      ? (model as any).withConfig(
          temperature != null
            ? { temperature }
            : topP != null
              ? { top_p: topP }
              : { temperature: 0.7 }
        )
      : model;
  },

  // Tools: Navigation tools (client-side, no execute) + Server-side tools (with execute)
  // Client-side tools are executed via onToolCall handler, server-side tools execute automatically
  tools: {
    // Navigation tools - client-side execution (no execute function)
    navigateToEvent,
    navigateToWorkWeek,
    navigateToWeek,
    navigateToDateRange,
    navigateToDates,
    // Server-side tools - automatic execution with JWT authentication
    getCalendarEvents,
    searchCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    createEventHighlights,
    createTimeHighlights,
    listHighlights,
    deleteHighlights,
    searchUsers,
    findFreeTime,
    findCommonFreeTime,
  },
});

// ---- How to call it ----------------------------------------------------------------------
// IMPORTANT: This agent has tools enabled. When calling with streaming, you MUST handle tool execution.
//
// For production use, use AI SDK's DefaultChatTransport which handles the tool roundtrip automatically:
// - Agent streams tool calls to client
// - Transport executes tools (server-side tools run automatically, client-side via onToolCall)
// - Tool results are sent back to agent
// - Agent produces final response with tool results
//
// See: apps/calendar/src/components/ai-chat-panel-v2/ai-assistant-panel-v2.tsx for full implementation
//
// Example with DefaultChatTransport (recommended):
// const { messages, sendMessage } = useChat({
//   transport: new DefaultChatTransport({
//     api: `/api/agents/cal-agent/stream/vnext/ui`,
//     body: () => ({
//       memory: { resource: "userId:personaId", thread: { id: threadId } },
//       data: {
//         "model-id": "gpt-4o-mini",
//         "persona-id": "persona-uuid",
//         "user-timezone": "America/New_York",
//         "user-current-datetime": new Date().toISOString(),
//       },
//     }),
//   }),
//   onToolCall: async ({ toolCall }) => {
//     // Handle client-side tools (navigation tools)
//     if (toolCall.toolName === 'navigateToWeek') {
//       // Execute navigation, return result
//       return { success: true };
//     }
//   },
// });
//
// Manual streaming (advanced, NOT recommended - use DefaultChatTransport instead):
// const stream = await CalAgent.streamVNext(messages, {
//   format: "aisdk",
//   maxSteps: 10,  // Allow multiple tool calls
//   memory: { thread, resource },
//   runtimeContext: new Map([...]),
// });
// // You must handle tool calls yourself - see AI SDK v5 docs for tool execution patterns
