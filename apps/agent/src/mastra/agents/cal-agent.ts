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

    const now = userCurrentDateTime ? new Date(userCurrentDateTime) : new Date();
    const today = (userCurrentDateTime ?? now.toISOString()).slice(0, 10);

    let viewDates: string[] | undefined;
    try {
      viewDates = viewDatesJson ? JSON.parse(viewDatesJson) : undefined;
    } catch {
      /* ignore */
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

CURRENT VIEW:
${viewStart || viewEnd ? `- Range: ${viewStart ?? '?'} → ${viewEnd ?? '?'}` : '- Range: —'}
${viewDates?.length ? `- Dates: ${viewDates.join(', ')}` : '- Dates: —'}

PLAN:
1) Parse the user's request and identify the tasks or jobs you have been give.
2) Build a plan, including which tools make be relevant, what additional information you may need to ask the user about, and what the order of operations should be.
3) Let the user briefly know that you are working on their request and briefly summarize your plan.

EXECUTE:
1) When using tools:
   - For compound requests (e.g., "show my week and summarize"), execute all necessary tools in sequence
   - Navigation tools only change the view - to see/summarize events, you MUST also call getCalendarEvents or searchCalendarEvents
   - Execute each tool and WAIT for the result before proceeding
   - Use the ACTUAL data returned from the tools in your response (never make up or hallucinate data)
   - Present the tool results clearly and accurately
   - Confirm completion and offer to help further
2) Calendar-specific rules (even when tools are added later):
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
// Final-only (no streaming):
// const res = await CalAgent.generate(messages, {
//   maxSteps: 1,
//   toolChoice: "none",
//   memory: { thread, resource },
//   runtimeContext: new Map([
//     ["model-id", "gpt-4o-mini"],
//     ["persona-id", "some-persona-uuid"],  // IMPORTANT: Store persona ID with thread for correct message retrieval
//     ["persona-name", "Calendar Coach"],
//     ["persona-temperature", 0.3],
//     // pass user context (recommended)
//     ["user-timezone", "America/New_York"],
//     ["user-current-datetime", new Date().toISOString()],
//     ["calendar-view-start", "2025-10-01T00:00:00-04:00"],
//     ["calendar-view-end",   "2025-10-07T23:59:59-04:00"],
//     ["calendar-view-dates", JSON.stringify(["2025-10-01","2025-10-02","2025-10-03"])],
//   ]),
// });
// return res.text;

// Streaming (AI SDK v5 compatible). Only render text parts + final to avoid noise:
// const stream = await CalAgent.streamVNext(messages, {
//   format: "aisdk",
//   maxSteps: 1,
//   toolChoice: "none",
//   memory: { thread, resource },
//   runtimeContext: new Map([
//     ["model-id", "gpt-4o-mini"],
//     ["persona-id", "some-persona-uuid"],  // IMPORTANT: Store persona ID with thread for correct message retrieval
//     ["user-timezone", "America/Los_Angeles"],
//     ["user-current-datetime", new Date().toISOString()],
//     ["calendar-view-dates", JSON.stringify(["2025-10-01","2025-10-02"])],
//   ]),
// });
// stream.processDataStream({
//   onTextPart: (t) => pushToUI(t),
//   onFinish: (f) => pushToUI(f.text ?? ""),
//   // ignore tool/step events (there are none in this clean agent)
// });
