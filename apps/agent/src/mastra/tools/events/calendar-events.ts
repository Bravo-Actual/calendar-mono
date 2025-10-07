import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getCalendarEvents = createTool({
  id: 'getCalendarEvents',
  description: `Fetch calendar events for a date range including attendee information.

Use this tool to:
- View events after navigating (navigation tools don't fetch data)
- Check what meetings exist before scheduling
- Answer questions about who's attending meetings
- Identify meeting organizers and participant responses`,
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO 8601 format (e.g., "2025-10-06T00:00:00.000Z")'),
    endDate: z.string().describe('End date in ISO 8601 format (e.g., "2025-10-07T23:59:59.999Z")'),
    categoryId: z.string().optional().describe('Optional: Filter by category ID'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    events: z.array(z.object({
      id: z.string(),
      title: z.string(),
      start_time: z.string(),
      end_time: z.string(),
      all_day: z.boolean(),
      agenda: z.string().nullable().optional(),
      online_event: z.boolean(),
      online_join_link: z.string().nullable().optional(),
      in_person: z.boolean(),
      private: z.boolean(),
      event_users: z.array(z.object({
        user_id: z.string(),
        role: z.string().describe('Attendee role: owner, attendee, viewer, contributor, delegate_full'),
        users: z.object({
          id: z.string(),
          user_profiles: z.array(z.object({
            email: z.string().describe('Attendee email address'),
            display_name: z.string().nullable().optional().describe('Preferred display name'),
            first_name: z.string().nullable().optional(),
            last_name: z.string().nullable().optional(),
          })).describe('Array with one profile object - access via user_profiles[0]'),
        }),
      })).optional().describe('Array of attendees with their roles and contact information'),
    })),
    count: z.number().optional(),
    error: z.string().optional(),
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

Use this tool to:
- Schedule meetings, appointments, or focus time
- Add reminders and tasks to the calendar
- Create all-day events for birthdays, holidays, etc.

NOT for highlighting existing events (use createTimeHighlights instead)`,
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
  outputSchema: z.object({
    success: z.boolean(),
    eventId: z.string().optional().describe('ID of created event'),
    message: z.string().optional(),
    error: z.string().optional(),
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
  description: `Update one or more calendar events.

Use this tool to:
- Change event times or titles
- Add/update meeting links or descriptions
- Modify event settings (online, in-person, private)
- Update personal settings (category, calendar, availability)
- Batch update multiple events at once

Permissions: Event owners can update all fields, attendees can only update personal settings`,
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
  outputSchema: z.object({
    success: z.boolean(),
    updated: z.number().optional().describe('Number of events successfully updated'),
    results: z
      .array(
        z.object({
          id: z.string(),
          success: z.boolean(),
          updated: z.array(z.string()).describe('Fields that were updated'),
          skipped: z.array(z.string()).describe('Fields that were skipped (permission denied)'),
        })
      )
      .optional()
      .describe('Per-event results'),
    errors: z.array(z.string()).optional().describe('Error messages if any updates failed'),
    message: z.string().optional(),
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
  description: `Delete one or more calendar events.

Use this tool to:
- Remove events from the calendar
- Delete multiple events at once

Permission: Only event owners can delete events`,
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe('Event IDs to delete'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deleted: z.number().optional().describe('Number of events successfully deleted'),
    results: z
      .array(
        z.object({
          id: z.string(),
          success: z.boolean(),
        })
      )
      .optional()
      .describe('Per-event results'),
    errors: z.array(z.string()).optional().describe('Error messages if any deletions failed'),
    message: z.string().optional(),
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
