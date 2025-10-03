import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { Database } from "@repo/supabase/database.types";

// Supabase database types
type EventResolvedRow = Database['public']['Views']['events_resolved']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];

/**
 * Create calendar event tools with JWT token bound via closure
 * This allows tools to access the user's auth token for Supabase API calls
 */
export function createCalendarEventTools(userJwt: string) {
  /**
   * Get calendar events - supports both date range and date array modes with comprehensive filtering
   * Uses the events_resolved view for simplified querying with full-text search
   */
  const getCalendarEvents = new DynamicStructuredTool({
  name: "get_calendar_events",
  description: `Get calendar events with comprehensive filtering and search capabilities.

DATE MODES:
1. Date Range: Use startDate + endDate for consecutive dates (e.g., week view)
2. Date Array: Use dates array for non-consecutive dates (e.g., custom selection)

FILTERING OPTIONS:
- Categories: Filter by category ID or search by category name
- Calendars: Filter by calendar ID or search by calendar name
- Event Types: Filter by online_event, in_person, all_day, private
- AI Management: Filter AI-managed events
- Text Search: Full-text search across title, agenda, calendar, and category

Returns fully resolved events including personal details, calendar/category info, roles, and RSVPs.`,

  schema: z.object({
    // Date filtering (at least one required)
    startDate: z.string().optional().describe("Start date in ISO format (use with endDate for range mode)"),
    endDate: z.string().optional().describe("End date in ISO format (use with startDate for range mode)"),
    dates: z.array(z.string()).optional().describe("Array of specific dates in ISO format (for non-consecutive dates in dateArray mode)"),

    // Category filtering
    categoryId: z.string().optional().describe("Filter by specific category ID"),
    categoryName: z.string().optional().describe("Filter by category name (case-insensitive partial match)"),

    // Calendar filtering
    calendarId: z.string().optional().describe("Filter by specific calendar ID"),
    calendarName: z.string().optional().describe("Filter by calendar name (case-insensitive partial match)"),

    // Event type filtering
    onlineEvent: z.boolean().optional().describe("Filter online/virtual events (true) or exclude them (false)"),
    inPerson: z.boolean().optional().describe("Filter in-person events (true) or exclude them (false)"),
    allDay: z.boolean().optional().describe("Filter all-day events (true) or exclude them (false)"),
    private: z.boolean().optional().describe("Filter private events (true) or exclude them (false)"),

    // AI and role filtering
    aiManaged: z.boolean().optional().describe("Filter AI-managed events (true) or exclude them (false)"),
    role: z.enum(["owner", "attendee", "viewer", "contributor", "delegate_full"]).optional().describe("Filter by user's role in the event"),

    // RSVP filtering
    following: z.boolean().optional().describe("Filter events user is following (true) or not following (false)"),

    // Full-text search
    search: z.string().optional().describe("Full-text search query across title, agenda, calendar, and category names"),

    // Result limiting
    limit: z.number().optional().describe("Maximum number of events to return (default: 100, max: 1000)"),
  }).refine(
    (data) => (data.startDate && data.endDate) || (data.dates && data.dates.length > 0),
    { message: "Must provide either startDate+endDate OR dates array" }
  ),

  func: async (input: any) => {
    if (!userJwt) {
      return JSON.stringify({
        success: false,
        error: "Authentication required - no JWT token found",
        events: []
      });
    }

    try {
      // Get user ID from JWT
      let currentUserId;
      try {
        const tokenParts = userJwt.split(".");
        const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
        currentUserId = payload.sub;
      } catch (e) {
        return JSON.stringify({
          success: false,
          error: "Failed to decode JWT token",
          events: []
        });
      }

      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

      // Build query filters
      const filters: string[] = [];

      // Always filter by user
      filters.push(`user_id=eq.${currentUserId}`);

      // Date filtering - handle range mode
      if (input.startDate && input.endDate) {
        filters.push(`start_time=gte.${input.startDate}`);
        filters.push(`start_time=lte.${input.endDate}`);
      }
      // Date filtering - handle array mode
      else if (input.dates && input.dates.length > 0) {
        // For each date, check if event starts on that day
        const dateConditions = input.dates.map((date: string) => {
          const dayStart = `${date.split('T')[0]}T00:00:00.000Z`;
          const dayEnd = `${date.split('T')[0]}T23:59:59.999Z`;
          return `and(start_time.gte.${dayStart},start_time.lte.${dayEnd})`;
        }).join(',');
        filters.push(`or=(${dateConditions})`);
      }

      // Category filtering
      if (input.categoryId) {
        filters.push(`category_id=eq.${input.categoryId}`);
      }
      if (input.categoryName) {
        filters.push(`category_name=ilike.*${input.categoryName}*`);
      }

      // Calendar filtering
      if (input.calendarId) {
        filters.push(`calendar_id=eq.${input.calendarId}`);
      }
      if (input.calendarName) {
        filters.push(`calendar_name=ilike.*${input.calendarName}*`);
      }

      // Event type filtering
      if (input.onlineEvent !== undefined) {
        filters.push(`online_event=eq.${input.onlineEvent}`);
      }
      if (input.inPerson !== undefined) {
        filters.push(`in_person=eq.${input.inPerson}`);
      }
      if (input.allDay !== undefined) {
        filters.push(`all_day=eq.${input.allDay}`);
      }
      if (input.private !== undefined) {
        filters.push(`private=eq.${input.private}`);
      }

      // AI and role filtering
      if (input.aiManaged !== undefined) {
        filters.push(`ai_managed=eq.${input.aiManaged}`);
      }
      if (input.role) {
        filters.push(`computed_role=eq.${input.role}`);
      }

      // RSVP filtering
      if (input.following !== undefined) {
        filters.push(`computed_following=eq.${input.following}`);
      }

      // Full-text search
      if (input.search) {
        // Convert search query to tsquery format
        const searchTerms = input.search.split(/\s+/).filter(Boolean).join(' & ');
        filters.push(`search_vector=fts(english).${searchTerms}`);
      }

      // Build final query
      const queryString = filters.join('&');
      const limit = Math.min(input.limit || 100, 1000);

      const url = `${supabaseUrl}/rest/v1/events_resolved?${queryString}&select=*&order=start_time.asc&limit=${limit}`;

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
        return JSON.stringify({
          success: false,
          error: `Failed to fetch events: ${response.status} ${errorText}`,
          events: []
        });
      }

      const events = await response.json() as EventResolvedRow[];

      return JSON.stringify({
        success: true,
        events: events || [],
        count: events?.length || 0,
        message: `Found ${events?.length || 0} events${input.search ? ` matching "${input.search}"` : ''}`
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to fetch events: ${error instanceof Error ? error.message : "Unknown error"}`,
        events: []
      });
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
        return JSON.stringify({
          success: false,
          error: "Authentication required - no JWT token found"
        });
      }

    const supabaseUrl = process.env.SUPABASE_URL!;

    try {
      // Get current user ID from JWT
      let currentUserId;
      try {
        const tokenParts = userJwt.split(".");
        const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
        currentUserId = payload.sub;
      } catch (e) {
        return JSON.stringify({
          success: false,
          error: "Failed to decode JWT token"
        });
      }

      // Create event data
      const eventData = {
        title: input.title,
        start_time: input.start_time,
        end_time: input.end_time,
        all_day: input.all_day || false,
        agenda: input.agenda || null,
        owner_id: currentUserId,
        creator_id: currentUserId,
      };

      // Create the event via edge function (handles related tables)
      const response = await fetch(
        `${supabaseUrl}/functions/v1/events`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${userJwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          success: false,
          error: `Failed to create event: ${response.status} ${errorText}`
        });
      }

      const result = await response.json() as { success: boolean; event?: EventRow };

      return JSON.stringify({
        success: true,
        eventId: result.event?.id,
        event: result.event,
        message: "Event created successfully"
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to create event: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  },
});

  /**
   * Update calendar event(s) - supports bulk updates
   */
  const updateCalendarEvent = new DynamicStructuredTool({
    name: "update_calendar_event",
    description: `Update calendar events with comprehensive field support.

SECURITY MODEL:
- Event OWNERS can modify main event fields (title, time, etc.) AND their personal details
- Non-owners can ONLY modify their own personal details (calendar assignment, categories, etc.)`,

    schema: z.object({
      events: z.array(z.object({
        id: z.string().describe("Event ID to update (REQUIRED)"),

        // Main event fields (owner only)
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

        // Personal details (any attendee)
        calendar_id: z.string().nullable().optional(),
        category_id: z.string().nullable().optional(),
        show_time_as: z.enum(["free", "tentative", "busy", "oof", "working_elsewhere"]).optional(),
        time_defense_level: z.enum(["flexible", "normal", "high", "hard_block"]).optional(),
        ai_managed: z.boolean().optional(),
        ai_instructions: z.string().nullable().optional(),
      })).describe("Array of events to update in bulk operation"),
    }),

    func: async (input: any) => {
      if (!userJwt) {
        return JSON.stringify({
          success: false,
          error: "Authentication required - no JWT token found"
        });
      }

    const supabaseUrl = process.env.SUPABASE_URL!;

    try {
      if (!input.events || !input.events.length) {
        return JSON.stringify({
          success: false,
          error: "No events provided for update"
        });
      }

      const results = [];
      const errors = [];

      // Use edge function for each event update
      for (const eventUpdate of input.events) {
        if (!eventUpdate.id) {
          errors.push(`Event missing ID`);
          continue;
        }

        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/events`,
            {
              method: "PATCH",
              headers: {
                "Authorization": `Bearer ${userJwt}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventUpdate)
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`Failed to update event ${eventUpdate.id}: ${response.status} ${errorText}`);
            continue;
          }

          const result = await response.json() as { success: boolean; event?: EventRow };
          results.push({
            id: eventUpdate.id,
            success: result.success,
            event: result.event
          });

        } catch (error: any) {
          errors.push(`Error updating event ${eventUpdate.id}: ${error.message}`);
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
      return JSON.stringify({
        success: false,
        error: `Failed to update events: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
});

  /**
   * Delete calendar event(s) - supports bulk deletion
   */
  const deleteCalendarEvent = new DynamicStructuredTool({
    name: "delete_calendar_event",
    description: "Delete calendar events (supports bulk deletion). Only event owners can delete events.",
    schema: z.object({
      eventIds: z.array(z.string()).describe("Array of event IDs to delete"),
    }),
    func: async (input: any) => {
      if (!userJwt) {
        return JSON.stringify({
          success: false,
          error: "Authentication required - no JWT token found"
        });
      }

    const supabaseUrl = process.env.SUPABASE_URL!;

    try {
      if (!input.eventIds || !input.eventIds.length) {
        return JSON.stringify({
          success: false,
          error: "No event IDs provided for deletion"
        });
      }

      const results = [];
      const errors = [];

      // Use edge function for each deletion
      for (const eventId of input.eventIds) {
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/events`,
            {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${userJwt}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ id: eventId })
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`Failed to delete event ${eventId}: ${response.status} ${errorText}`);
            continue;
          }

          const result = await response.json() as { success: boolean };
          results.push({
            id: eventId,
            success: result.success
          });

        } catch (error: any) {
          errors.push(`Error deleting event ${eventId}: ${error.message}`);
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
      return JSON.stringify({
        success: false,
        error: `Failed to delete events: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  },
});

  return [getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent];
}
