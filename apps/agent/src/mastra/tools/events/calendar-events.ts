import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getCalendarEvents = createTool({
  id: 'getCalendarEvents',
  description: `Fetch calendar events for a date range.

WHEN TO USE:
- After navigating to view events (navigation tools don't fetch data)
- To check what events exist before creating/updating
- To summarize or analyze schedule

Returns event data including titles, times, attendees, and details.`,
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO 8601 format (e.g., "2025-10-06T00:00:00.000Z")'),
    endDate: z.string().describe('End date in ISO 8601 format (e.g., "2025-10-07T23:59:59.999Z")'),
    categoryId: z.string().optional().describe('Optional: Filter by category ID'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    const userJwt = executionContext.runtimeContext?.get('jwt-token');

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required',
        events: [],
      };
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const params = new URLSearchParams({
        startDate: context.startDate,
        endDate: context.endDate,
      });

      if (context.categoryId) {
        params.append('categoryId', context.categoryId);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/calendar-events?${params}`, {
        headers: {
          Authorization: `Bearer ${userJwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Failed to fetch events: ${response.status}`,
          events: [],
        };
      }

      const result = await response.json();
      return {
        success: true,
        events: result.events || [],
        count: result.events?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        events: [],
      };
    }
  },
});

export const createCalendarEvent = createTool({
  id: 'createCalendarEvent',
  description: `Create a new calendar event.

USE FOR: Creating meetings, appointments, reminders, tasks
NOT FOR: Highlighting existing events (use aiCalendarHighlights instead)

EXAMPLES:
- "Schedule a meeting with John tomorrow at 2pm for 1 hour"
- "Create an all-day event for my birthday on March 15th"
- "Add a 30-minute focus block at 9am today"`,
  inputSchema: z.object({
    title: z.string().describe('Event title (e.g., "Team Meeting", "Lunch with Sarah")'),
    start_time: z.string().describe('Start time in ISO 8601 format (e.g., "2025-10-06T14:00:00.000Z")'),
    end_time: z.string().describe('End time in ISO 8601 format (e.g., "2025-10-06T15:00:00.000Z")'),
    all_day: z.boolean().optional().describe('All-day event (defaults to false)'),
    agenda: z.string().optional().describe('Event description/notes'),
    online_event: z.boolean().optional().describe('Is this a virtual/online meeting'),
    online_join_link: z.string().optional().describe('Meeting URL (Zoom, Teams, etc.)'),
    in_person: z.boolean().optional().describe('Is this an in-person meeting'),
    private: z.boolean().optional().describe('Mark as private event'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    const userJwt = executionContext.runtimeContext?.get('jwt-token');

    if (!userJwt) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: context.title,
          start_time: context.start_time,
          end_time: context.end_time,
          all_day: context.all_day || false,
          agenda: context.agenda || null,
          online_event: context.online_event || false,
          online_join_link: context.online_join_link || null,
          in_person: context.in_person || false,
          private: context.private || false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Failed to create event: ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        eventId: result.event?.id,
        message: `Created event: ${context.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

export const updateCalendarEvent = createTool({
  id: 'updateCalendarEvent',
  description: `Update calendar events (supports batch updates).

PERMISSIONS:
- Event owners: Can update all event fields
- Attendees: Can only update their personal settings (category, calendar, time-as)

COMMON USES:
- Change event time: Provide id, start_time, end_time
- Update title/description: Provide id, title, and/or agenda
- Mark as online meeting: Provide id, online_event: true, online_join_link
- Change personal category: Provide id, category_id (any attendee)

BATCH UPDATES:
Use events array to update multiple events at once.`,
  inputSchema: z.object({
    events: z
      .array(
        z.object({
          id: z.string().describe('Event ID (required)'),

          // Main event fields (owner only)
          title: z.string().optional().describe('Event title'),
          agenda: z.string().nullable().optional().describe('Event description'),
          start_time: z.string().optional().describe('Start time (ISO 8601)'),
          end_time: z.string().optional().describe('End time (ISO 8601)'),
          all_day: z.boolean().optional().describe('All-day event'),
          private: z.boolean().optional().describe('Private event'),
          online_event: z.boolean().optional().describe('Virtual/online meeting'),
          online_join_link: z.string().nullable().optional().describe('Meeting URL'),
          in_person: z.boolean().optional().describe('In-person meeting'),

          // Personal fields (any attendee)
          calendar_id: z.string().nullable().optional().describe('Assign to calendar'),
          category_id: z.string().nullable().optional().describe('Event category'),
          show_time_as: z
            .enum(['free', 'tentative', 'busy', 'oof', 'working_elsewhere'])
            .optional()
            .describe('How time appears (busy/free/tentative/oof/working_elsewhere)'),
        })
      )
      .describe('Array of events to update'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    const userJwt = executionContext.runtimeContext?.get('jwt-token');

    if (!userJwt) {
      return { success: false, error: 'Authentication required' };
    }

    if (!context.events?.length) {
      return { success: false, error: 'No events provided' };
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const results: Array<{ id: string; success: boolean; updated: string[]; skipped: string[] }> = [];
      const errors: string[] = [];

      for (const eventUpdate of context.events) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${userJwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventUpdate),
          });

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`Event ${eventUpdate.id}: ${errorText}`);
            continue;
          }

          const result = await response.json();
          results.push({
            id: eventUpdate.id,
            success: true,
            updated: result.updated || [],
            skipped: result.skipped || [],
          });
        } catch (error) {
          errors.push(`Event ${eventUpdate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        updated: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        message: `Updated ${results.length} event(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

export const deleteCalendarEvent = createTool({
  id: 'deleteCalendarEvent',
  description: `Delete calendar events (supports batch deletion).

PERMISSION: Only event owners can delete events.

EXAMPLES:
- Delete single event: Provide one event ID
- Delete multiple: Provide array of event IDs`,
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe('Event IDs to delete'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    const userJwt = executionContext.runtimeContext?.get('jwt-token');

    if (!userJwt) {
      return { success: false, error: 'Authentication required' };
    }

    if (!context.eventIds?.length) {
      return { success: false, error: 'No event IDs provided' };
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const results: Array<{ id: string; success: boolean }> = [];
      const errors: string[] = [];

      for (const eventId of context.eventIds) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${userJwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: eventId }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`Event ${eventId}: ${errorText}`);
            continue;
          }

          results.push({ id: eventId, success: true });
        } catch (error) {
          errors.push(`Event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        deleted: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        message: `Deleted ${results.length} event(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
