import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Get events by their IDs - Use this when the user references selected events
 * This is much faster than searching since it does direct lookups
 */
export const getEventsByIds = createTool({
  id: 'getEventsByIds',
  description: `Get calendar events by their IDs (direct lookup - very fast).

Use this tool when:
- User references "this event", "selected event(s)", "these meetings" - use IDs from calendar context
- You have event IDs from a previous tool call
- User says "update/delete/show me the selected event" - use selectedEvents.eventIds from context

DO NOT use this when:
- User asks "what's on my calendar today" (use getCalendarEvents instead)
- User searches by keyword (use searchCalendarEvents instead)
- User doesn't have events selected (no IDs available)

IMPORTANT: When presenting events to the user, show titles, times, attendees names/emails.
Never expose the event ID or user_id values - those are for internal use only.

TIMEZONE: Returned timestamps (start_time, end_time) are in UTC (ISO 8601 format).`,
  inputSchema: z.object({
    eventIds: z
      .array(z.string())
      .min(1)
      .max(50)
      .describe('Array of event IDs to fetch (max 50). Get these from calendar context when user references selected events.'),
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
    notFound: z.array(z.string()).optional().describe('Event IDs that were not found or not accessible'),
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

      // Handle both array and JSON-stringified array
      let eventIdsArray: string[];
      if (typeof context.eventIds === 'string') {
        try {
          eventIdsArray = JSON.parse(context.eventIds);
        } catch {
          // If parse fails, assume it's a single ID
          eventIdsArray = [context.eventIds];
        }
      } else if (Array.isArray(context.eventIds)) {
        eventIdsArray = context.eventIds;
      } else {
        return {
          success: false,
          error: 'Invalid eventIds format',
          events: [],
        };
      }

      const eventIds = eventIdsArray.join(',');

      const response = await fetch(
        `${supabaseUrl}/functions/v1/calendar-events?eventIds=${encodeURIComponent(eventIds)}`,
        {
          headers: {
            Authorization: `Bearer ${userJwt}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to fetch events: ${response.status} - ${errorText}`,
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
