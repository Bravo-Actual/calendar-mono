// mastra/agents/cal-agent.ts
// Mastra v0.19+ minimal agent with **no tools**.
// - Uses PgStore-backed Memory
// - Persona-aware instructions via runtimeContext
// - Model selection via your existing MODEL_MAP / getDefaultModel
// - Ready for generate() or streamVNext({ format: 'aisdk' })

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore /*, PgVector */ } from "@mastra/pg";
// import { openai } from "@ai-sdk/openai"; // only if you enable vector recall
import { MODEL_MAP, getDefaultModel } from "../models.js"; // keep your existing model map

// ---- Runtime context keys you can pass per-call ------------------------------------------
type Runtime = {
  "model-id"?: string;
  "persona-name"?: string;
  "persona-traits"?: string;
  "persona-instructions"?: string;
  "persona-temperature"?: number;
  "persona-top-p"?: number;
  // User/time context
  "user-timezone"?: string;          // IANA TZ, e.g., "America/New_York"
  "user-now-iso"?: string;           // ISO 8601 timestamp (with offset/Z)
  // Calendar view context (choose range OR dates list)
  "calendar-view-start"?: string;    // ISO date/datetime
  "calendar-view-end"?: string;      // ISO date/datetime
  "calendar-view-dates"?: string;    // JSON array of ISO dates, e.g. "[\"2025-10-01\",\"2025-10-02\"]"
};

// ---- Memory (PostgresStore). Optionally enable vector recall if desired. ------------------------
const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  }),
  // vector: new PgVector({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55322/postgres' }),
  // embedder: openai.embedding("text-embedding-3-small"),
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true, // resource-scoped preferences across threads
      scope: "resource",
      template: `# Assistant Memory\n\n## User Preferences\n- timezone:\n- work_hours:\n- communication_style:\n\n## Notes\n- important_context:\n- follow_ups:\n`,
    },
    threads: { generateTitle: true },
    // semanticRecall: { scope: "resource", topK: 3, messageRange: 2 }, // enable iff vector+embedder
  },
});

// ---- Agent (no tools) --------------------------------------------------------------------
export const CalAgent = new Agent<
  "cal-agent",
  {},
  unknown,
  Runtime
>({
  name: "CalAgent",
  memory,

  instructions: ({ runtimeContext }) => {
    const userTz = runtimeContext.get("user-timezone") as string | undefined;
    const userNowIso = runtimeContext.get("user-now-iso") as string | undefined;
    const viewStart = runtimeContext.get("calendar-view-start") as string | undefined;
    const viewEnd = runtimeContext.get("calendar-view-end") as string | undefined;
    const viewDatesJson = runtimeContext.get("calendar-view-dates") as string | undefined;

    const now = userNowIso ? new Date(userNowIso) : new Date();
    const today = (userNowIso ?? now.toISOString()).slice(0, 10);

    let viewDates: string[] | undefined;
    try { viewDates = viewDatesJson ? JSON.parse(viewDatesJson) : undefined; } catch { /* ignore */ }

    const personaName = runtimeContext.get("persona-name");
    const traits = runtimeContext.get("persona-traits");
    const extra = runtimeContext.get("persona-instructions");

    const base = `TODAY: ${today}

USER TIME CONTEXT
- Timezone: ${userTz ?? "unknown"}
- Now: ${userNowIso ?? now.toISOString()}

CURRENT VIEW
${(viewStart || viewEnd) ? `- Range: ${viewStart ?? "?"} → ${viewEnd ?? "?"}` : "- Range: —"}
${(viewDates && viewDates.length) ? `- Dates: ${viewDates.join(", ")}` : "- Dates: —"}


PLAN
1) Parse the user's request and identify the concrete goal (e.g., view, summarize, modify, or plan).
2) If essential info is missing, ask **one concise** clarifying question; otherwise proceed.
3) Think and (when available) use tools **silently**—do not narrate steps or internal reasoning.
4) Prefer **final-only** responses; keep interim updates to a minimum.
5) Calendar-specific rules (even when tools are added later):
   - Resolve relative dates ("today", "next week") from the current timestamp.
   - When the user references selected items ("this event/time"), operate on those; otherwise search by time/title.
   - For updates, only discuss names, dates, and times (never IDs/UUIDs). Batch updates as needed.
   - When suggesting times, propose 2–3 options in **YYYY-MM-DD** with local times and note conflicts.
6) Output style:
   - Default to short bullet points; use tables for multi-item schedules or comparisons.
   - Include absolute dates/times to avoid ambiguity.
   - Avoid filler, process narration, or speculative statements.
7) If blocked by missing data or permissions, state the issue plainly and provide the next actionable step.

GUIDELINES
- Be concise and actionable.
- Avoid narrating internal reasoning or steps. Provide only relevant information and the final answer.
- Ask for missing details only when essential.
`;

    if (personaName || traits || extra) {
      return `You are ${personaName || "Assistant"}.\n\n${traits ? `TRAITS: ${traits}\n\n` : ""}${extra ? `${extra}\n\n` : ""}${base}`;
    }
    return base;
  },

  model: ({ runtimeContext }) => {
    const modelId = (runtimeContext.get("model-id") as string) || getDefaultModel(true);
    const makeModel = MODEL_MAP[modelId] ?? MODEL_MAP[getDefaultModel(true)];
    const model = makeModel();

    const temperature = runtimeContext.get("persona-temperature");
    const topP = runtimeContext.get("persona-top-p");

    return typeof (model as any)?.withConfig === "function"
      ? (model as any).withConfig(
          temperature != null
            ? { temperature }
            : topP != null
            ? { top_p: topP }
            : { temperature: 0.7 }
        )
      : model;
  },

  // No tools registered. You can add server- or client-executed tools later.
  tools: {},
});

// ---- How to call it ----------------------------------------------------------------------
// Final-only (no streaming):
// const res = await CalAgent.generate(messages, {
//   maxSteps: 1,
//   toolChoice: "none",
//   memory: { thread, resource },
//   runtimeContext: new Map([
//     ["model-id", "gpt-4o-mini"],
//     ["persona-name", "Calendar Coach"],
//     ["persona-temperature", 0.3],
//     // pass user context (recommended)
//     ["user-timezone", "America/New_York"],
//     ["user-now-iso", new Date().toISOString()],
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
//     ["user-timezone", "America/Los_Angeles"],
//     ["user-now-iso", new Date().toISOString()],
//     ["calendar-view-dates", JSON.stringify(["2025-10-01","2025-10-02"])],
//   ]),
// });
// stream.processDataStream({
//   onTextPart: (t) => pushToUI(t),
//   onFinish: (f) => pushToUI(f.text ?? ""),
//   // ignore tool/step events (there are none in this clean agent)
// });
