import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Full-text search of calendar events
 * Uses PostgreSQL full-text search on title and agenda fields
 */
export const searchCalendarEvents = createTool({
  id: 'searchCalendarEvents',
  description: `Search calendar events by keywords - searches event titles, descriptions, AND attendee names/emails automatically.

WHAT IT DOES: Full-text search across event titles, agendas, and attendee information (names, emails)
USE WHEN: User asks to find, search, or look for events by name, topic, content, or people

RETURNS:
- Events ranked by relevance to search query
- Each event includes:
  * Event details (title, agenda, start_time, end_time, online_event, in_person, etc.)
  * event_users array with attendees:
    - user_id: UUID of the attendee
    - role: User's role in the event (see ATTENDEE ROLES below)
    - user_profiles: Object with first_name, last_name, display_name, email

ATTENDEE ROLES:
- owner: Event creator/organizer (full control)
- attendee: Regular participant (invited)
- viewer: Can view but not modify
- contributor: Can make changes but not delete
- delegate_full: Has full delegation rights

NOT FOR: Getting all events in a date range (use getCalendarEvents instead)

SEARCH SCOPE:
- Event titles and agendas
- Attendee first names, last names, display names
- Attendee email addresses

EXAMPLES:
- "Find all my meetings with Sarah" → search query="Sarah", returns events with Sarah in title OR as attendee
- "Find meetings organized by Bob" → search query="Bob", then check event_users for who has role='owner'
- "Search for events about the quarterly review" → search query="quarterly review", shows all attendees
- "Find meetings with john@example.com" → search query="john@example.com", searches attendee emails
- "Show me all events with Sarah Johnson" → search query="Sarah Johnson", shows their role

IMPORTANT NOTES:
- You do NOT need full name or email to search - partial names work (e.g., just "Bob")
- The search automatically finds people in attendee lists AND event titles/agendas
- To find who ORGANIZED an event, look for the user with role='owner' in event_users array
- The owner_id field on the event also indicates the organizer's user ID`,
  inputSchema: z.object({
    query: z
      .string()
      .describe('Search query - searches event titles, agendas, attendee names, and attendee emails'),
    startDate: z
      .string()
      .optional()
      .describe('Optional start date filter in YYYY-MM-DD format'),
    endDate: z
      .string()
      .optional()
      .describe('Optional end date filter in YYYY-MM-DD format'),
    categoryId: z.string().optional().describe('Optional category UUID to filter by'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .describe('Maximum number of results to return (default: 20, max: 100)'),
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const { query, startDate, endDate, categoryId, limit = 20 } = executionContext.context;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required',
      };
    }

    try {
      // Use REST API to search events by text and attendees
      return await fallbackSearch({ jwt, query, startDate, endDate, categoryId, limit });
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to search events: ${error.message}`,
      };
    }
  },
});

/**
 * Fallback search implementation using direct SQL query
 * Used when the RPC function doesn't exist yet
 */
async function fallbackSearch({
  jwt,
  query,
  startDate,
  endDate,
  categoryId,
  limit,
}: {
  jwt: string;
  query: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  limit: number;
}) {
  try {
    // First get user ID from JWT to filter event_users
    let userId: string;
    try {
      const tokenParts = jwt.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      userId = payload.sub;
    } catch (e) {
      return {
        success: false,
        error: 'Failed to decode JWT token',
      };
    }

    // Get event IDs user has access to via event_users
    const eventUsersUrl = `${process.env.SUPABASE_URL}/rest/v1/event_users?select=event_id&user_id=eq.${userId}`;

    const eventUsersResponse = await fetch(eventUsersUrl, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: process.env.SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
    });

    if (!eventUsersResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch user events: ${eventUsersResponse.statusText}`,
      };
    }

    const eventUsersData = await eventUsersResponse.json();
    const eventIds = eventUsersData.map((eu: any) => eu.event_id);

    if (eventIds.length === 0) {
      return {
        success: true,
        events: [],
        count: 0,
        message: 'No events found',
      };
    }

    // Search for users matching the query (attendees)
    const userProfilesUrl = `${process.env.SUPABASE_URL}/rest/v1/user_profiles?select=user_id&or=(first_name.ilike.*${encodeURIComponent(query)}*,last_name.ilike.*${encodeURIComponent(query)}*,display_name.ilike.*${encodeURIComponent(query)}*,email.ilike.*${encodeURIComponent(query)}*)`;

    const userProfilesResponse = await fetch(userProfilesUrl, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: process.env.SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
    });

    let matchingAttendeeUserIds: string[] = [];
    if (userProfilesResponse.ok) {
      const matchingUsers = await userProfilesResponse.json();
      matchingAttendeeUserIds = matchingUsers.map((u: any) => u.user_id);
    }

    // Get event IDs where matching users are attendees
    let eventIdsFromAttendees: string[] = [];
    if (matchingAttendeeUserIds.length > 0) {
      const attendeeEventsUrl = `${process.env.SUPABASE_URL}/rest/v1/event_users?select=event_id&user_id=in.(${matchingAttendeeUserIds.join(',')})`;

      const attendeeEventsResponse = await fetch(attendeeEventsUrl, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
      });

      if (attendeeEventsResponse.ok) {
        const attendeeEvents = await attendeeEventsResponse.json();
        eventIdsFromAttendees = attendeeEvents.map((eu: any) => eu.event_id);
      }
    }

    // Get events where matching users are attendees (filtered by accessible events)
    const attendeeMatchEventIds = eventIds.filter((id: string) =>
      eventIdsFromAttendees.includes(id)
    );

    // Now query events with text search OR attendee match, filtered by accessible event IDs
    // Note: We'll fetch event_users separately to avoid FK relationship issues
    let url = `${process.env.SUPABASE_URL}/rest/v1/events?select=*,event_details_personal!inner(*)`;

    // Filter by accessible events first
    url += `&id=in.(${eventIds.join(',')})`;

    // Build text search OR attendee match filter
    const filters: string[] = [];

    // Add text search (encode the query for URL)
    const encodedQuery = encodeURIComponent(query);
    filters.push(`title.ilike.*${encodedQuery}*`);
    filters.push(`agenda.ilike.*${encodedQuery}*`);

    // Add attendee match if applicable
    if (attendeeMatchEventIds.length > 0) {
      filters.push(`id.in.(${attendeeMatchEventIds.join(',')})`);
    }

    // Add OR filter
    if (filters.length > 0) {
      url += `&or=(${filters.join(',')})`;
    }

    if (startDate) {
      url += `&start_time=gte.${startDate}T00:00:00Z`;
    }
    if (endDate) {
      url += `&end_time=lte.${endDate}T23:59:59Z`;
    }
    if (categoryId) {
      url += `&event_details_personal.category_id=eq.${categoryId}`;
    }

    url += `&limit=${limit}&order=start_time.asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: process.env.SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to search events: ${response.statusText} - ${errorText}`,
      };
    }

    const events = await response.json();

    // Fetch event_users and user_profiles for these events
    if (events.length > 0) {
      const eventIdsForUsers = events.map((e: any) => e.id);
      const eventUsersUrl = `${process.env.SUPABASE_URL}/rest/v1/event_users?select=event_id,user_id,role&event_id=in.(${eventIdsForUsers.join(',')})`;

      const eventUsersResponse = await fetch(eventUsersUrl, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
      });

      if (eventUsersResponse.ok) {
        const eventUsersData = await eventUsersResponse.json();

        // Get unique user IDs
        const userIds = [...new Set(eventUsersData.map((eu: any) => eu.user_id))];

        if (userIds.length > 0) {
          // Fetch user profiles
          const userProfilesUrl = `${process.env.SUPABASE_URL}/rest/v1/user_profiles?select=user_id,first_name,last_name,display_name,email&user_id=in.(${userIds.join(',')})`;

          const userProfilesResponse = await fetch(userProfilesUrl, {
            headers: {
              Authorization: `Bearer ${jwt}`,
              apikey: process.env.SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json',
            },
          });

          if (userProfilesResponse.ok) {
            const userProfiles = await userProfilesResponse.json();

            // Create a map for quick lookup
            const profileMap = new Map(userProfiles.map((p: any) => [p.user_id, p]));

            // Attach event_users with user_profiles to events
            for (const event of events) {
              const eventUsers = eventUsersData
                .filter((eu: any) => eu.event_id === event.id)
                .map((eu: any) => ({
                  user_id: eu.user_id,
                  role: eu.role,
                  user_profiles: profileMap.get(eu.user_id) || null,
                }));
              event.event_users = eventUsers;
            }
          }
        }
      }
    }

    return {
      success: true,
      events,
      count: events.length,
      message: `Found ${events.length} event${events.length !== 1 ? 's' : ''} matching "${query}" (searched titles, agendas, and attendees)`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search events: ${error.message}`,
    };
  }
}
