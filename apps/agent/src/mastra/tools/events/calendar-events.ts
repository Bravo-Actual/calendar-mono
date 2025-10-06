import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../../auth/jwt-storage.js';

// getCurrentDateTime removed - we pass current datetime in runtime context
// See calendar-assistant-agent.ts lines 180-188 for runtime context usage

export const getCalendarEvents = createTool({
  id: 'getCalendarEvents',
  description: `Fetch calendar events for a specific date range. Use this to:
- Retrieve events after navigating (navigation tools only change the view, not fetch data)
- Summarize or analyze a user's schedule for a time period
- Check what events exist before creating/modifying events
Returns actual event data including titles, times, attendees, and details.`,
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'),
    endDate: z.string().describe('End date in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'),
    categoryId: z.string().optional().describe('Filter by category ID'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    console.log('Getting calendar events:', context);

    const userJwt = executionContext.runtimeContext?.get('jwt-token');
    console.log('getCalendarEvents - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        events: [],
      };
    }

    try {
      // Call Supabase edge function
      const supabaseUrl = process.env.SUPABASE_URL!;

      // Build query parameters
      const params = new URLSearchParams({
        startDate: context.startDate,
        endDate: context.endDate,
      });

      if (context.categoryId) {
        params.append('categoryId', context.categoryId);
      }

      const url = `${supabaseUrl}/functions/v1/calendar-events?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error:', response.status, errorText);
        return {
          success: false,
          error: `Failed to fetch events: ${response.status} ${errorText}`,
          events: [],
        };
      }

      const result = await response.json();

      return {
        success: result.success,
        events: result.events || [],
        message: result.message,
      };
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return {
        success: false,
        error: `Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        events: [],
      };
    }
  },
});

export const createCalendarEvent = createTool({
  id: 'createCalendarEvent',
  description: 'Create a new calendar event',
  inputSchema: z.object({
    title: z.string().describe('Event title'),
    start_time: z.string().describe('Start time in ISO format'),
    end_time: z.string().describe('End time in ISO format'),
    all_day: z.boolean().optional().describe('Is this an all-day event'),
    agenda: z.string().optional().describe('Event description/agenda'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    console.log('Creating calendar event:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('createCalendarEvent - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

    try {
      // Get current user ID from JWT
      let currentUserId;
      try {
        const tokenParts = userJwt.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        currentUserId = payload.sub;
      } catch (_e) {
        return {
          success: false,
          error: 'Failed to decode JWT token',
        };
      }

      // Create event data
      const eventData = {
        title: context.title,
        start_time: context.start_time,
        end_time: context.end_time,
        all_day: context.all_day || false,
        agenda: context.agenda || null,
        owner_id: currentUserId,
        creator_id: currentUserId,
      };

      // Create the event
      const eventResponse = await fetch(`${supabaseUrl}/rest/v1/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(eventData),
      });

      if (!eventResponse.ok) {
        const errorText = await eventResponse.text();
        return {
          success: false,
          error: `Failed to create event: ${eventResponse.status} ${errorText}`,
        };
      }

      const createdEvent = await eventResponse.json();

      return {
        success: true,
        eventId: createdEvent[0].id,
        event: createdEvent[0],
        message: 'Event created successfully',
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return {
        success: false,
        error: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

export const updateCalendarEvent = createTool({
  id: 'updateCalendarEvent',
  description: `Update calendar events with comprehensive field support.

SECURITY MODEL:
- Event OWNERS can modify main event fields (title, time, etc.) AND their personal details
- Non-owners can ONLY modify their own personal details (calendar assignment, categories, etc.)
- Attempting to modify main event fields as non-owner will be gracefully skipped with explanation

FIELD TYPES AND CONSTRAINTS:
- Required fields: Only 'id' is required for updates
- Nullable fields: agenda, online_join_link, online_chat_link, calendar_id, category_id, ai_instructions
- Boolean fields default to false if not specified
- Enum fields have specific allowed values (see descriptions)
- All timestamp fields use ISO 8601 format
- Duration is specified in minutes as integer`,

  inputSchema: z.object({
    // Bulk update support
    events: z
      .array(
        z.object({
          id: z.string().describe('Event ID to update (REQUIRED)'),

          // MAIN EVENT FIELDS (Owner only - will be skipped for non-owners)
          title: z
            .string()
            .optional()
            .describe('Event title (NOT NULL, no default - current value kept if not provided)'),

          agenda: z
            .string()
            .nullable()
            .optional()
            .describe('Event description/agenda (NULLABLE, default: null)'),

          start_time: z
            .string()
            .optional()
            .describe(
              'Start time in ISO 8601 format (NOT NULL, no default - current value kept if not provided). Example: "2024-01-15T14:30:00.000Z"'
            ),

          end_time: z
            .string()
            .optional()
            .describe(
              'End time in ISO 8601 format (NOT NULL, no default - current value kept if not provided). Example: "2024-01-15T15:30:00.000Z"'
            ),

          all_day: z
            .boolean()
            .optional()
            .describe('Is this an all-day event (NOT NULL, default: false when creating events)'),

          private: z
            .boolean()
            .optional()
            .describe('Is this a private event (NOT NULL, default: false when creating events)'),

          online_event: z
            .boolean()
            .optional()
            .describe(
              'Is this an online/virtual event (NOT NULL, default: false when creating events)'
            ),

          online_join_link: z
            .string()
            .nullable()
            .optional()
            .describe(
              'URL for joining online meeting (NULLABLE, default: null). Only relevant if online_event is true.'
            ),

          online_chat_link: z
            .string()
            .nullable()
            .optional()
            .describe(
              'URL for meeting chat (NULLABLE, default: null). Only relevant if online_event is true.'
            ),

          in_person: z
            .boolean()
            .optional()
            .describe(
              'Is this an in-person event (NOT NULL, default: false when creating events). Can be true simultaneously with online_event for hybrid events.'
            ),

          request_responses: z
            .boolean()
            .optional()
            .describe(
              'Request RSVP responses from attendees (NOT NULL, default: false when creating events)'
            ),

          allow_forwarding: z
            .boolean()
            .optional()
            .describe(
              'Allow attendees to forward this event (NOT NULL, default: true when creating events)'
            ),

          hide_attendees: z
            .boolean()
            .optional()
            .describe(
              'Hide attendee list from participants (NOT NULL, default: false when creating events)'
            ),

          // PERSONAL DETAILS FIELDS (Any attendee can modify their own)
          calendar_id: z
            .string()
            .nullable()
            .optional()
            .describe(
              'UUID of user calendar to assign event to (NULLABLE, references user_calendars.id). If null, uses default calendar.'
            ),

          category_id: z
            .string()
            .nullable()
            .optional()
            .describe(
              'UUID of user category for event organization (NULLABLE, references user_categories.id). If null, no category assigned.'
            ),

          show_time_as: z
            .enum(['free', 'tentative', 'busy', 'oof', 'working_elsewhere'])
            .optional()
            .describe(`How this time should appear on calendar (NULLABLE, default: 'busy'). Options:
        - 'free': Time appears available to others
        - 'tentative': Time appears tentatively booked
        - 'busy': Time appears unavailable (most common)
        - 'oof': Out of office/unavailable
        - 'working_elsewhere': Working but in different location`),

          time_defense_level: z
            .enum(['flexible', 'normal', 'high', 'hard_block'])
            .optional()
            .describe(`How strongly to protect this time (NULLABLE, default: 'normal'). Options:
        - 'flexible': Can easily be rescheduled or interrupted
        - 'normal': Standard protection level
        - 'high': Important, avoid interruptions
        - 'hard_block': Critical, do not reschedule or interrupt`),

          ai_managed: z
            .boolean()
            .optional()
            .describe(
              'Whether this event is managed by AI systems (NOT NULL, default: false when creating events)'
            ),

          ai_instructions: z
            .string()
            .nullable()
            .optional()
            .describe(
              'Instructions for AI management of this event (NULLABLE, default: null). Only relevant if ai_managed is true.'
            ),
        })
      )
      .optional()
      .describe(
        'Array of events to update in bulk operation. Each event needs an id and any fields to update.'
      ),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    console.log('Updating calendar event:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('updateCalendarEvent - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

    try {
      // Handle both single event and bulk updates
      let eventsToUpdate = [];

      if (context.events && Array.isArray(context.events)) {
        // Bulk update mode
        eventsToUpdate = context.events;
      } else {
        return {
          success: false,
          error: 'events array is required',
        };
      }

      if (!eventsToUpdate.length) {
        return {
          success: false,
          error: 'No events provided for update',
        };
      }

      const results = [];
      const errors = [];

      for (const eventUpdate of eventsToUpdate) {
        if (!eventUpdate.id) {
          errors.push(`Event missing ID: ${JSON.stringify(eventUpdate)}`);
          continue;
        }

        try {
          // First check if event exists and get ownership info
          console.log(`Checking event existence for ID: ${eventUpdate.id}`);
          const eventCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/events?select=id,owner_id&id=eq.${eventUpdate.id}`,
            {
              headers: {
                Authorization: `Bearer ${userJwt}`,
                apikey: supabaseAnonKey,
                'Content-Type': 'application/json',
              },
            }
          );
          console.log(`Event check response status: ${eventCheckResponse.status}`);

          if (!eventCheckResponse.ok) {
            errors.push(
              `Failed to check event ${eventUpdate.id}: ${eventCheckResponse.statusText}`
            );
            continue;
          }

          const events = await eventCheckResponse.json();
          const existingEvent = events[0];

          if (!existingEvent) {
            errors.push(`Event not found: ${eventUpdate.id}`);
            continue;
          }

          // Get current user ID from JWT (decode it to get user info)
          let currentUserId;
          try {
            const tokenParts = userJwt.split('.');
            const payload = JSON.parse(atob(tokenParts[1]));
            currentUserId = payload.sub;
          } catch (_e) {
            errors.push(`Failed to decode JWT for event ${eventUpdate.id}`);
            continue;
          }

          const isOwner = existingEvent.owner_id === currentUserId;

          // Separate main event fields from personal details fields
          const mainEventFields = [
            'title',
            'agenda',
            'start_time',
            'end_time',
            'all_day',
            'private',
            'online_event',
            'online_join_link',
            'online_chat_link',
            'in_person',
            'request_responses',
            'allow_forwarding',
            'hide_attendees',
          ];

          const personalFields = [
            'calendar_id',
            'category_id',
            'show_time_as',
            'time_defense_level',
            'ai_managed',
            'ai_instructions',
          ];

          const mainEventUpdates: any = {};
          const personalUpdates: any = {};
          const skippedFields: string[] = [];

          // Categorize updates
          for (const [key, value] of Object.entries(eventUpdate)) {
            if (key === 'id') continue; // Skip ID field

            if (mainEventFields.includes(key)) {
              if (isOwner) {
                mainEventUpdates[key] = value;
              } else {
                skippedFields.push(key);
              }
            } else if (personalFields.includes(key)) {
              personalUpdates[key] = value;
            }
          }

          const updatedFields: string[] = [];

          // Update main event table (owner only)
          if (Object.keys(mainEventUpdates).length > 0 && isOwner) {
            mainEventUpdates.updated_at = new Date().toISOString();

            const eventUpdateResponse = await fetch(
              `${supabaseUrl}/rest/v1/events?id=eq.${eventUpdate.id}`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${userJwt}`,
                  apikey: supabaseAnonKey,
                  'Content-Type': 'application/json',
                  Prefer: 'return=minimal',
                },
                body: JSON.stringify(mainEventUpdates),
              }
            );

            if (!eventUpdateResponse.ok) {
              const errorText = await eventUpdateResponse.text();
              errors.push(
                `Failed to update event ${eventUpdate.id}: ${eventUpdateResponse.status} ${errorText}`
              );
              continue;
            }

            updatedFields.push(...Object.keys(mainEventUpdates).filter((k) => k !== 'updated_at'));
          }

          // Update personal details (any attendee)
          if (Object.keys(personalUpdates).length > 0) {
            personalUpdates.updated_at = new Date().toISOString();

            // First check if personal details exist
            const personalCheckResponse = await fetch(
              `${supabaseUrl}/rest/v1/event_details_personal?select=event_id&event_id=eq.${eventUpdate.id}&user_id=eq.${currentUserId}`,
              {
                headers: {
                  Authorization: `Bearer ${userJwt}`,
                  apikey: supabaseAnonKey,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (!personalCheckResponse.ok) {
              errors.push(
                `Failed to check personal details for event ${eventUpdate.id}: ${personalCheckResponse.statusText}`
              );
              continue;
            }

            const personalDetails = await personalCheckResponse.json();
            const hasPersonalDetails = personalDetails.length > 0;

            if (hasPersonalDetails) {
              // Update existing personal details
              const personalUpdateResponse = await fetch(
                `${supabaseUrl}/rest/v1/event_details_personal?event_id=eq.${eventUpdate.id}&user_id=eq.${currentUserId}`,
                {
                  method: 'PATCH',
                  headers: {
                    Authorization: `Bearer ${userJwt}`,
                    apikey: supabaseAnonKey,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                  },
                  body: JSON.stringify(personalUpdates),
                }
              );

              if (!personalUpdateResponse.ok) {
                const errorText = await personalUpdateResponse.text();
                errors.push(
                  `Failed to update personal details for event ${eventUpdate.id}: ${personalUpdateResponse.status} ${errorText}`
                );
                continue;
              }
            } else {
              // Create new personal details
              const personalCreateData = {
                event_id: eventUpdate.id,
                user_id: currentUserId,
                ...personalUpdates,
              };

              const personalCreateResponse = await fetch(
                `${supabaseUrl}/rest/v1/event_details_personal`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${userJwt}`,
                    apikey: supabaseAnonKey,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                  },
                  body: JSON.stringify(personalCreateData),
                }
              );

              if (!personalCreateResponse.ok) {
                const errorText = await personalCreateResponse.text();
                errors.push(
                  `Failed to create personal details for event ${eventUpdate.id}: ${personalCreateResponse.status} ${errorText}`
                );
                continue;
              }
            }

            updatedFields.push(...Object.keys(personalUpdates).filter((k) => k !== 'updated_at'));
          }

          // Build result
          const result: any = {
            id: eventUpdate.id,
            success: true,
            isOwner,
            updated: updatedFields,
          };

          if (skippedFields.length > 0) {
            result.skipped = skippedFields;
            result.message = `Non-owner can only update personal details. Skipped main event fields: ${skippedFields.join(', ')}`;
          }

          results.push(result);
        } catch (error) {
          errors.push(`Error updating event ${eventUpdate.id}: ${error.message}`);
        }
      }

      const response = {
        success: errors.length === 0,
        updated: results.length,
        results: results,
        errors: errors.length > 0 ? errors : undefined,
        message: `Updated ${results.length} event(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
      };

      return response;
    } catch (error) {
      console.error('Error updating calendar events:', error);
      return {
        success: false,
        error: `Failed to update events: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

export const deleteCalendarEvent = createTool({
  id: 'deleteCalendarEvent',
  description: 'Delete calendar events (supports bulk deletion)',
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe('Array of event IDs to delete'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    console.log('Deleting calendar event:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('deleteCalendarEvent - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

    try {
      // Get current user ID from JWT
      let currentUserId;
      try {
        const tokenParts = userJwt.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        currentUserId = payload.sub;
      } catch (_e) {
        return {
          success: false,
          error: 'Failed to decode JWT token',
        };
      }

      if (!context.eventIds || !context.eventIds.length) {
        return {
          success: false,
          error: 'No event IDs provided for deletion',
        };
      }

      const results = [];
      const errors = [];

      for (const eventId of context.eventIds) {
        try {
          // First check if event exists and user has permission to delete
          const eventCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/events?select=id,owner_id,title&id=eq.${eventId}`,
            {
              headers: {
                Authorization: `Bearer ${userJwt}`,
                apikey: supabaseAnonKey,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!eventCheckResponse.ok) {
            errors.push(`Failed to check event ${eventId}: ${eventCheckResponse.statusText}`);
            continue;
          }

          const events = await eventCheckResponse.json();
          const existingEvent = events[0];

          if (!existingEvent) {
            errors.push(`Event not found: ${eventId}`);
            continue;
          }

          // Only owner can delete events
          if (existingEvent.owner_id !== currentUserId) {
            errors.push(`Permission denied: Only event owners can delete events (${eventId})`);
            continue;
          }

          // Delete the event
          const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${eventId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${userJwt}`,
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
          });

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            errors.push(`Failed to delete event ${eventId}: ${deleteResponse.status} ${errorText}`);
            continue;
          }

          results.push({
            id: eventId,
            title: existingEvent.title,
            success: true,
          });
        } catch (error) {
          errors.push(`Error deleting event ${eventId}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        deleted: results.length,
        results: results,
        errors: errors.length > 0 ? errors : undefined,
        message: `Deleted ${results.length} event(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
      };
    } catch (error) {
      console.error('Error deleting calendar events:', error);
      return {
        success: false,
        error: `Failed to delete events: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
