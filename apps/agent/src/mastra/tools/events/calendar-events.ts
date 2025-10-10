import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getCalendarEvents = createTool({
  id: 'getCalendarEvents',
  description: `Fetch calendar events for a date range including attendee information.

Use this tool to:
- View events after navigating (navigation tools don't fetch data)
- Check what meetings exist before scheduling
- Answer questions about who's attending meetings
- Identify meeting organizers and participant responses

IMPORTANT: When presenting events to the user, show titles, times, attendees names/emails.
Never expose the event ID or user_id values - those are for internal use only (e.g., for updateCalendarEvent calls).`,
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in ISO 8601 format (e.g., "2025-10-06T00:00:00.000Z")'),
    endDate: z.string().describe('End date in ISO 8601 format (e.g., "2025-10-07T23:59:59.999Z")'),
    categoryId: z.string().optional().describe('Optional: Filter by category ID'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    events: z.array(
      z.object({
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
        calendar_id: z
          .string()
          .nullable()
          .optional()
          .describe('Calendar ID - use getUserCalendars to get calendar names'),
        category_id: z
          .string()
          .nullable()
          .optional()
          .describe('Category ID - use getUserCategories to get category names'),
        show_time_as: z
          .enum(['free', 'tentative', 'busy', 'oof', 'working_elsewhere'])
          .optional()
          .describe('How this time appears on calendar'),
        event_users: z
          .array(
            z.object({
              user_id: z.string().describe('User ID for referencing in other operations'),
              role: z
                .string()
                .describe('Attendee role: owner, attendee, viewer, contributor, delegate_full'),
              email: z.string().describe('Attendee email address'),
              name: z.string().describe('Attendee name'),
            })
          )
          .optional()
          .describe('Array of attendees with their roles and contact information'),
      })
    ),
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
        const _error = await response.text();
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
  description: `Create a new calendar event with optional attendees.

Use this tool to:
- Schedule meetings, appointments, or focus time
- Add reminders and tasks to the calendar
- Create all-day events for birthdays, holidays, etc.
- Invite attendees to meetings (use searchUsers to get their user_id first)

Workflow for adding attendees:
1. Use searchUsers to find each person by name/email → get their user_id
2. Include the user_ids in the attendee_user_ids array
3. The event creator is automatically added as owner (don't include your own ID)
4. When presenting to user, show attendee names/emails, never the user_id values

Example: "Schedule meeting with John and Sarah tomorrow at 2pm"
→ searchUsers("john") → john_id
→ searchUsers("sarah") → sarah_id
→ createCalendarEvent(attendee_user_ids: [john_id, sarah_id], ...)

NOT for highlighting existing events (use createTimeHighlights instead)`,
  inputSchema: z.object({
    title: z.string().describe('Event title (e.g., "Team Meeting", "Lunch with Sarah")'),
    start_time: z
      .string()
      .describe('Start time in ISO 8601 format (e.g., "2025-10-06T14:00:00.000Z")'),
    end_time: z.string().describe('End time in ISO 8601 format (e.g., "2025-10-06T15:00:00.000Z")'),
    all_day: z.boolean().optional().describe('All-day event (defaults to false)'),
    agenda: z.string().optional().describe('Event description/notes'),
    online_event: z.boolean().optional().describe('Is this a virtual/online meeting'),
    online_join_link: z.string().optional().describe('Meeting URL (Zoom, Teams, etc.)'),
    in_person: z.boolean().optional().describe('Is this an in-person meeting'),
    private: z.boolean().optional().describe('Mark as private event'),
    attendee_user_ids: z
      .array(z.string())
      .optional()
      .describe(
        'Array of user IDs to invite as attendees (use searchUsers first to get user_ids). Event creator is automatically included as owner, so do not include your own user_id.'
      ),
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

      // Build payload with optional invite_users array
      const payload: any = {
        title: context.title,
        start_time: context.start_time,
        end_time: context.end_time,
        all_day: context.all_day || false,
        agenda: context.agenda || null,
        online_event: context.online_event || false,
        online_join_link: context.online_join_link || null,
        in_person: context.in_person || false,
        private: context.private || false,
      };

      // Add invite_users if attendees were provided
      if (context.attendee_user_ids && context.attendee_user_ids.length > 0) {
        payload.invite_users = context.attendee_user_ids.map((user_id) => ({
          user_id,
          role: 'attendee',
          rsvp_status: 'tentative',
        }));
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const _error = await response.text();
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
  description: `Update the actual event data (title, time, description, etc).

Use this tool to:
- Change event times or titles
- Modify the event description/agenda field (for permanent changes to the event)
- Add/update meeting links
- Modify event settings (online, in-person, private)
- Update personal settings (category, calendar, availability)
- Batch update multiple events at once

Examples of when to use:
- "Change the meeting time to 3pm" → Use this tool
- "Update the meeting description to include the agenda" → Use this tool (permanent change)
- "Add a Zoom link to the meeting" → Use this tool
- "Move this to my Work calendar" → Use this tool

NOT for: Adding temporary notes or reminders (use createEventHighlights instead)
NOT for: Visual markers or flags (use createEventHighlights instead)

Examples of when NOT to use:
- "Add a note to remind me to bring coffee" → Use createEventHighlights
- "Mark this as important" → Use createEventHighlights
- "Highlight this meeting" → Use createEventHighlights
- "Flag this as urgent" → Use createEventHighlights

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
      const results: Array<{ id: string; success: boolean; updated: string[]; skipped: string[] }> =
        [];
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
          errors.push(
            `Event ${eventUpdate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
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
          errors.push(
            `Event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
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
