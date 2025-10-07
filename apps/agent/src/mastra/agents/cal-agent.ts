sh// mastra/agents/cal-agent.ts
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

EXECUTE:
When using tools:
   - For compound requests (e.g., "show my week and summarize"), execute all necessary tools in sequence
   - Navigation tools only change the view - the user will expect a follow up summary, which will require additional tools to fully answer the user's request.
   - Present the tool results clearly and accurately
   - Confirm completion and offer to help further

Calendar-specific rules (even when tools are added later):
   - Resolve relative dates ("today", "next week") from ${today}.
   - When the user references selected items ("this event/time"), operate on those; otherwise search by time/title.
   - For updates, only discuss names, dates, and times (never IDs/UUIDs). Batch updates as needed.
   - When suggesting times, propose 2-3 options in YYYY-MM-DD with local times and note conflicts.
   - Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ) for all tool calls involving dates/times.

3) Output style:
   - Default to short bullet points; use tables for multi-item schedules or comparisons.
   - Use friendly dates and times when discussing near-term. Use longer format when discussing events farther out that 2 weeks. Use the users timezone for dates and times but don't display it in long form.

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

  // Navigation tools - client-side execution (Pattern B)
  // See apps/calendar/src/ai-client-tools/handlers/ for implementations
  // Event CRUD tools - server-side execution with JWT authentication
  tools: {
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
