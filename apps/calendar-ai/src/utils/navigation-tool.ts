import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Calendar navigation tool - instructs client to navigate the calendar view
 * This is a server-side tool that returns navigation instructions for the client to execute
 */
export function createNavigationTool() {
  return new DynamicStructuredTool({
    name: "navigate_calendar",
    description: `Navigate the user's calendar view to display specific dates.

WHEN TO USE THIS TOOL:
- User asks to view/show/display a specific date or time period
- User says "show me next week", "go to tomorrow", "display this Monday"
- User wants to see their schedule for a specific time period
- ALWAYS call this tool BEFORE calling get_calendar_events when user asks to view a time period

Examples that require navigation:
- "Show me next week" → navigate_calendar THEN get_calendar_events
- "What's on my calendar tomorrow?" → navigate_calendar THEN get_calendar_events
- "Display this Friday" → navigate_calendar THEN get_calendar_events

How to use:
- Single day: { "startDate": "2025-10-06" }
- Week range: { "startDate": "2025-10-06", "endDate": "2025-10-12" }
- Specific dates: { "dates": ["2025-10-06", "2025-10-08", "2025-10-10"] }

Returns: Success confirmation. The calendar UI will update automatically.`,

    schema: z.object({
      // Date array mode - specific dates (max 14)
      dates: z.array(z.string()).optional().describe("Array of specific dates in YYYY-MM-DD format (for non-consecutive dates)"),

      // Date range mode - consecutive dates
      startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().optional().describe("End date in YYYY-MM-DD format (omit for single day)"),

      // View type hints
      viewType: z.enum(['day', 'week', 'workweek', 'custom-days', 'dates']).optional()
        .describe("Explicit view type (auto-detected if not provided)"),

      // Settings
      timezone: z.string().optional().describe("Timezone (e.g., 'America/New_York')"),
      weekStartDay: z.number().min(0).max(6).optional().describe("Week start day: 0=Sunday, 1=Monday, etc."),
    }).refine(
      (data) => data.dates || data.startDate,
      { message: "Must provide either dates array OR startDate" }
    ),

    func: async (input: any) => {
      // This tool is CLIENT-SIDE only - server just validates and passes through
      console.log('[navigate_calendar] Server received call - forwarding to client:', JSON.stringify(input));

      // Return a marker that tells the streaming handler this is a client-side tool call
      // The actual execution happens in the browser via onToolCall
      return JSON.stringify({
        __client_side_tool__: true,
        toolName: "navigate_calendar",
        params: input,
      });
    },
  });
}
