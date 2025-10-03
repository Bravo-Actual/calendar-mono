import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { Database } from "@repo/supabase/database.types";

// Supabase database types
type EventResolvedRow = Database['public']['Views']['events_resolved']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];

/**
 * Create calendar event tools with JWT token bound via closure
 */
export function createCalendarEventTools(userJwt: string) {

  /**
   * TOOL 1: Get calendar events by date range or specific dates
   */
  const getCalendarEvents = new DynamicStructuredTool({
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

    func: async (input: any) => {
      console.log('[get_calendar_events] Called with input:', JSON.stringify(input));

      if (!userJwt) {
        return JSON.stringify({ success: false, error: "Authentication required", events: [] });
      }

      try {
        const tokenParts = userJwt.split(".");
        const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
        const currentUserId = payload.sub;

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

        const events = await response.json() as EventResolvedRow[];
        return JSON.stringify({ success: true, events, count: events.length });
      } catch (error) {
        return JSON.stringify({ success: false, error: `Error: ${error instanceof Error ? error.message : "Unknown"}`, events: [] });
      }
    },
  });

  /**
   * TOOL 2: Search calendar events by keyword
   */
  const searchCalendarEvents = new DynamicStructuredTool({
    name: "search_calendar_events",
    description: `Search for events by keyword across title, description, calendar name, and category.

Use when user searches for specific events:
- "Do I have any coffee meetings?"
- "Find my dentist appointment"
- "Show me all team standups"

Optionally scope search to specific date range or dates.`,

    schema: z.object({
      search: z.string().describe("Search keywords (e.g., 'coffee', 'dentist', 'standup')"),

      startDate: z.string().optional().describe("Optional: limit to events after this date"),
      endDate: z.string().optional().describe("Optional: limit to events before this date"),
      dates: z.array(z.string()).optional().describe("Optional: limit to specific dates"),

      limit: z.number().optional().describe("Max results (default: 100)"),
    }),

    func: async (input: any) => {
      console.log('[search_calendar_events] Called with input:', JSON.stringify(input));

      if (!userJwt) {
        return JSON.stringify({ success: false, error: "Authentication required", events: [] });
      }

      try {
        const tokenParts = userJwt.split(".");
        const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
        const currentUserId = payload.sub;

        const supabaseUrl = process.env.SUPABASE_URL!;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

        const filters: string[] = [`user_id=eq.${currentUserId}`];

        // Full-text search
        const sanitized = input.search.replace(/[&|!()<>:]/g, ' ').trim();
        if (sanitized) {
          filters.push(`search_vector=plfts.${encodeURIComponent(sanitized)}`);
        }

        // Optional date filtering
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

        const queryString = filters.join('&');
        const limit = Math.min(input.limit || 20, 1000);
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
          return JSON.stringify({ success: false, error: `Failed to search: ${response.status} ${errorText}`, events: [] });
        }

        const events = await response.json() as EventResolvedRow[];
        return JSON.stringify({ success: true, events, count: events.length, message: `Found ${events.length} events matching "${input.search}"` });
      } catch (error) {
        return JSON.stringify({ success: false, error: `Error: ${error instanceof Error ? error.message : "Unknown"}`, events: [] });
      }
    },
  });

  /**
   * Get full details for a specific calendar event
   */
  const getEventDetails = new DynamicStructuredTool({
    name: "get_event_details",
    description: "Get complete details for a specific calendar event by ID. Use when you need all fields for an event (e.g., before updating).",
    schema: z.object({
      eventId: z.string().describe("Event ID"),
    }),
    func: async (input: { eventId: string }) => {
      if (!userJwt) {
        return JSON.stringify({ success: false, error: "Authentication required" });
      }

      try {
        const tokenParts = userJwt.split(".");
        const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
        const currentUserId = payload.sub;

        const supabaseUrl = process.env.SUPABASE_URL!;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

        const url = `${supabaseUrl}/rest/v1/events_resolved?id=eq.${input.eventId}&user_id=eq.${currentUserId}&select=*&limit=1`;

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
          return JSON.stringify({ success: false, error: `Failed: ${response.status} ${errorText}` });
        }

        const events = await response.json() as EventResolvedRow[];
        if (!events || events.length === 0) {
          return JSON.stringify({ success: false, error: "Event not found" });
        }

        return JSON.stringify({ success: true, event: events[0] });
      } catch (error) {
        return JSON.stringify({ success: false, error: `Error: ${error instanceof Error ? error.message : "Unknown"}` });
      }
    },
  });

  /**
   * Create a new calendar event
   */
  const createCalendarEvent = new DynamicStructuredTool({
    name: "create_calendar_event",
    description: "Create a new calendar event",
    schema: z.object({
      title: z.string().describe("Event title"),
      start_time: z.string().describe("Start time in ISO format"),
      end_time: z.string().describe("End time in ISO format"),
      all_day: z.boolean().optional().describe("Is this an all-day event"),
      agenda: z.string().optional().describe("Event description/agenda"),
    }),
    func: async (input: any) => {
      if (!userJwt) {
        return JSON.stringify({ success: false, error: "Authentication required" });
      }

      const supabaseUrl = process.env.SUPABASE_URL!;

      try {
        const tokenParts = userJwt.split(".");
        const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
        const currentUserId = payload.sub;

        const eventData = {
          title: input.title,
          start_time: input.start_time,
          end_time: input.end_time,
          all_day: input.all_day || false,
          agenda: input.agenda || null,
          owner_id: currentUserId,
          creator_id: currentUserId,
        };

        const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${userJwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          return JSON.stringify({ success: false, error: `Failed: ${response.status} ${errorText}` });
        }

        const result = await response.json() as { success: boolean; event?: EventRow };
        return JSON.stringify({ success: true, eventId: result.event?.id, event: result.event, message: "Event created" });
      } catch (error) {
        return JSON.stringify({ success: false, error: `Error: ${error instanceof Error ? error.message : "Unknown"}` });
      }
    },
  });

  /**
   * Update calendar event(s)
   */
  const updateCalendarEvent = new DynamicStructuredTool({
    name: "update_calendar_event",
    description: `Update calendar events. Event owners can modify all fields. Non-owners can only modify their personal details.`,
    schema: z.object({
      events: z.array(z.object({
        id: z.string().describe("Event ID (REQUIRED)"),
        title: z.string().optional(),
        agenda: z.string().nullable().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        all_day: z.boolean().optional(),
        private: z.boolean().optional(),
        online_event: z.boolean().optional(),
        online_join_link: z.string().nullable().optional(),
        online_chat_link: z.string().nullable().optional(),
        in_person: z.boolean().optional(),
        calendar_id: z.string().nullable().optional(),
        category_id: z.string().nullable().optional(),
        show_time_as: z.enum(["free", "tentative", "busy", "oof", "working_elsewhere"]).optional(),
        time_defense_level: z.enum(["flexible", "normal", "high", "hard_block"]).optional(),
        ai_managed: z.boolean().optional(),
        ai_instructions: z.string().nullable().optional(),
      })).describe("Array of events to update"),
    }),
    func: async (input: any) => {
      if (!userJwt) {
        return JSON.stringify({ success: false, error: "Authentication required" });
      }

      const supabaseUrl = process.env.SUPABASE_URL!;

      try {
        if (!input.events || !input.events.length) {
          return JSON.stringify({ success: false, error: "No events provided" });
        }

        const results = [];
        const errors = [];

        for (const eventUpdate of input.events) {
          if (!eventUpdate.id) {
            errors.push(`Event missing ID`);
            continue;
          }

          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
              method: "PATCH",
              headers: {
                "Authorization": `Bearer ${userJwt}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventUpdate)
            });

            if (!response.ok) {
              const errorText = await response.text();
              errors.push(`Failed to update ${eventUpdate.id}: ${response.status} ${errorText}`);
              continue;
            }

            const result = await response.json() as { success: boolean; event?: EventRow };
            results.push({ id: eventUpdate.id, success: result.success, event: result.event });
          } catch (error: any) {
            errors.push(`Error updating ${eventUpdate.id}: ${error.message}`);
          }
        }

        return JSON.stringify({
          success: errors.length === 0,
          updated: results.length,
          results,
          errors: errors.length > 0 ? errors : undefined,
          message: `Updated ${results.length} event(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}`
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: `Error: ${error instanceof Error ? error.message : "Unknown"}` });
      }
    },
  });

  /**
   * Delete calendar event(s)
   */
  const deleteCalendarEvent = new DynamicStructuredTool({
    name: "delete_calendar_event",
    description: "Delete calendar events. Only event owners can delete.",
    schema: z.object({
      eventIds: z.array(z.string()).describe("Array of event IDs to delete"),
    }),
    func: async (input: any) => {
      if (!userJwt) {
        return JSON.stringify({ success: false, error: "Authentication required" });
      }

      const supabaseUrl = process.env.SUPABASE_URL!;

      try {
        if (!input.eventIds || !input.eventIds.length) {
          return JSON.stringify({ success: false, error: "No event IDs provided" });
        }

        const results = [];
        const errors = [];

        for (const eventId of input.eventIds) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${userJwt}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ id: eventId })
            });

            if (!response.ok) {
              const errorText = await response.text();
              errors.push(`Failed to delete ${eventId}: ${response.status} ${errorText}`);
              continue;
            }

            const result = await response.json() as { success: boolean };
            results.push({ id: eventId, success: result.success });
          } catch (error: any) {
            errors.push(`Error deleting ${eventId}: ${error.message}`);
          }
        }

        return JSON.stringify({
          success: errors.length === 0,
          deleted: results.length,
          results,
          errors: errors.length > 0 ? errors : undefined,
          message: `Deleted ${results.length} event(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}`
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: `Error: ${error instanceof Error ? error.message : "Unknown"}` });
      }
    },
  });

  return [getCalendarEvents, searchCalendarEvents, getEventDetails, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent];
}
