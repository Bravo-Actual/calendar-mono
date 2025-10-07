import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Full-text search of calendar events
 * Uses PostgreSQL full-text search on title and agenda fields
 */
export const searchCalendarEvents = createTool({
  id: 'searchCalendarEvents',
  description: `Search calendar events by keywords in title and description.

WHAT IT DOES: Full-text search across event titles and agendas
USE WHEN: User asks to find, search, or look for events by name, topic, or content

RETURNS: Events ranked by relevance to search query
NOT FOR: Getting all events in a date range (use getCalendarEvents instead)

EXAMPLES:
- "Find all my meetings with Sarah"
- "Search for events about the quarterly review"
- "Look for dentist appointments"`,
  inputSchema: z.object({
    query: z
      .string()
      .describe('Search query - words or phrases to search for in event titles and agendas'),
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
      // Build the query using to_tsquery for full-text search
      // Use websearch_to_tsquery to support natural language queries
      let supabaseQuery = `
        events!inner(
          id,
          owner_id,
          series_id,
          title,
          agenda,
          online_event,
          online_join_link,
          online_chat_link,
          in_person,
          start_time,
          end_time,
          all_day,
          private,
          request_responses,
          allow_forwarding,
          allow_reschedule_request,
          hide_attendees,
          history,
          discovery,
          join_model,
          created_at,
          updated_at
        ),
        event_details_personal!inner(
          calendar_id,
          category_id,
          show_time_as,
          time_defense_level,
          ai_managed,
          ai_instructions
        )
      `;

      // Build the URL with search parameters
      const params = new URLSearchParams();

      // Add text search - use websearch for natural language
      // This uses the idx_events_title_fts GIN index
      params.append('select', supabaseQuery);

      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/rpc/search_calendar_events?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: process.env.SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            search_query: query,
            start_date: startDate || null,
            end_date: endDate || null,
            category_filter: categoryId || null,
            result_limit: limit,
          }),
        }
      );

      if (!response.ok) {
        // If the RPC function doesn't exist, fall back to manual search
        if (response.status === 404) {
          return await fallbackSearch({ jwt, query, startDate, endDate, categoryId, limit });
        }

        return {
          success: false,
          error: `Failed to search events: ${response.statusText}`,
        };
      }

      const events = await response.json();

      return {
        success: true,
        events,
        count: events.length,
        message: `Found ${events.length} event${events.length !== 1 ? 's' : ''} matching "${query}"`,
      };
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

    // Now query events with text search, filtered by event IDs
    let url = `${process.env.SUPABASE_URL}/rest/v1/events?select=*,event_details_personal!inner(*)`;

    // Filter by accessible event IDs
    url += `&id=in.(${eventIds.join(',')})`;

    // Add text search using textSearch with websearch config
    url += `&or=(title.wfts.${encodeURIComponent(query)},agenda.wfts.${encodeURIComponent(query)})`;

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
      return {
        success: false,
        error: `Failed to search events: ${response.statusText}`,
      };
    }

    const events = await response.json();

    return {
      success: true,
      events,
      count: events.length,
      message: `Found ${events.length} event${events.length !== 1 ? 's' : ''} matching "${query}" (fallback search)`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search events: ${error.message}`,
    };
  }
}
