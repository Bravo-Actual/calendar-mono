import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Factory function to create calendar events tool
 * JWT is extracted from RunnableConfig at call time (not factory time)
 */
export function createCalendarEventsTool() {
  return tool(async (input, config) => {
    console.log('[get_calendar_events] Called with input:', JSON.stringify(input));

    // Extract JWT from custom auth (LangGraph SDK Auth)
    const authUser = (config?.configurable as any)?.langgraph_auth_user;
    const userJwt = authUser?.jwt ?? authUser?.identity ?? "";

    console.log('[get_calendar_events] JWT from auth:', userJwt ? `${userJwt.substring(0, 20)}...` : 'MISSING');

    if (!userJwt) {
      console.error('[get_calendar_events] CRITICAL: No JWT in config.configurable.langgraph_auth_user');
      return JSON.stringify({
        success: false,
        error: 'Authentication required - no JWT token provided',
        events: []
      });
    }

    try {
      // Decode JWT to get user ID
      const tokenParts = userJwt.split(".");
      if (tokenParts.length !== 3) {
        console.error('[get_calendar_events] Invalid JWT format - expected 3 parts, got:', tokenParts.length);
        return JSON.stringify({
          success: false,
          error: 'Invalid JWT format',
          events: []
        });
      }

      const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
      const currentUserId = payload.sub;
      console.log('[get_calendar_events] Decoded user ID:', currentUserId);

      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

      const filters: string[] = [`user_id=eq.${currentUserId}`];

      // Date filtering
      if (input.startDate && input.endDate) {
        filters.push(`start_time=gte.${input.startDate}`);
        filters.push(`start_time=lte.${input.endDate}`);
      } else if (input.dates && input.dates.length > 0) {
        const dateConditions = input.dates.map((date: string) => {
          const dayStart = `${date.split('T')[0]}T00:00:00.000Z`;
          const dayEnd = `${date.split('T')[0]}T23:59:59.999Z`;
          return `and(start_time.gte.${dayStart},start_time.lte.${dayEnd})`;
        }).join(',');
        filters.push(`or=(${dateConditions})`);
      }

      // Additional filters
      if (input.categoryId) filters.push(`category_id=eq.${input.categoryId}`);
      if (input.calendarId) filters.push(`calendar_id=eq.${input.calendarId}`);
      if (input.onlineEvent !== undefined) filters.push(`online_event=eq.${input.onlineEvent}`);
      if (input.inPerson !== undefined) filters.push(`in_person=eq.${input.inPerson}`);
      if (input.allDay !== undefined) filters.push(`all_day=eq.${input.allDay}`);

      const queryString = filters.join('&');
      const limit = Math.min(input.limit || 100, 1000);
      const fields = ['id', 'title', 'start_time', 'end_time', 'all_day', 'calendar_name', 'category_name', 'computed_role'].join(',');
      const url = `${supabaseUrl}/rest/v1/events_resolved?${queryString}&select=${fields}&order=start_time.asc&limit=${limit}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${userJwt}`,
          "apikey": supabaseAnonKey,
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({ success: false, error: `Failed to fetch: ${response.status} ${errorText}`, events: [] });
      }

      const events = await response.json();
      console.log(`[get_calendar_events] Found ${events.length} events`);

      return JSON.stringify({ success: true, count: events.length, events });

    } catch (error: any) {
      console.error('[get_calendar_events] Error:', error);
      return JSON.stringify({ success: false, error: error.message, events: [] });
    }
  }, {
    name: "get_calendar_events",
    description: `List calendar events for specific date ranges or dates.

Use when user asks about their schedule:
- "What's on my calendar this week?"
- "Show me my schedule for tomorrow"
- "What do I have on Monday and Wednesday?"

Supports two date modes:
1. Date Range: startDate + endDate for consecutive dates
2. Date Array: dates array for non-consecutive specific dates`,
    schema: z.object({
      startDate: z.string().optional().describe("Start date in ISO format (use with endDate)"),
      endDate: z.string().optional().describe("End date in ISO format (use with startDate)"),
      dates: z.array(z.string()).optional().describe("Array of specific dates in ISO format"),

      categoryId: z.string().optional().describe("Filter by category ID"),
      calendarId: z.string().optional().describe("Filter by calendar ID"),
      onlineEvent: z.boolean().optional().describe("Filter online events"),
      inPerson: z.boolean().optional().describe("Filter in-person events"),
      allDay: z.boolean().optional().describe("Filter all-day events"),
      limit: z.number().optional().describe("Max results (default: 100)"),
    }).refine(
      (data) => (data.startDate && data.endDate) || (data.dates && data.dates.length > 0),
      { message: "Must provide either startDate+endDate OR dates array" }
    ),
  });
}
