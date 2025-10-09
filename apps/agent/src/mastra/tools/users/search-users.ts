import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Search for users by name or email
 * Uses PostgreSQL trigram similarity for fuzzy matching
 */
export const searchUsers = createTool({
  id: 'searchUsers',
  description: `Search for people by name or email address to get their user_id.

Use this tool when you need to:
- Find someone's user_id to add them as an attendee to an event
- Look up contact information by name
- Verify if someone exists in the system before taking action
- Get a list of people matching a partial name or email

Examples of when to use:
- "Add John to the meeting" → Search for "john" to get user_id, then use it in event creation
- "Schedule a meeting with Sarah from marketing" → Search for "sarah" to find the right person
- "Is there a user named Mike?" → Search for "mike" to verify
- "Find people with the last name Smith" → Search for "smith"
- "Who is john@example.com?" → Search by email to get their profile

Searches: First name, last name, display name, full name (first + last), and email address
Returns: User ID (for use in other operations), full name, email, and similarity score
Results are ranked by relevance - higher similarity score = better match

IMPORTANT: The user_id field is for internal use only (to pass to other tools like createCalendarEvent).
When communicating with the user, only mention names and emails - never expose user_id or other system IDs.`,
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .describe(
        'Search query - searches names and emails (minimum 2 characters, e.g., "john", "john doe", "john@example.com")'
      ),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .optional()
      .describe('Maximum number of results to return (default: 10, max: 50)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    users: z
      .array(
        z.object({
          user_id: z.string().describe('User ID for referencing in other operations'),
          email: z.string().describe('User email address'),
          first_name: z.string().nullable().optional().describe('First name'),
          last_name: z.string().nullable().optional().describe('Last name'),
          display_name: z.string().nullable().optional().describe('Display name'),
          name: z.string().describe('Full name (display_name or first_name + last_name)'),
          similarity_score: z
            .number()
            .optional()
            .describe('Relevance score (0-1), higher is better match'),
        })
      )
      .optional(),
    count: z.number().optional().describe('Number of users returned'),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const { query, limit = 10 } = executionContext.context;

    if (!query || query.trim().length < 2) {
      return {
        success: false,
        error: 'Search query must be at least 2 characters',
      };
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        },
      });

      // Use trigram similarity search on user_profiles
      // Note: RLS policy "Anyone can view profiles" allows all authenticated users to search
      const { data, error } = await supabase.rpc('search_users', {
        search_query: query.trim(),
        result_limit: limit,
      });

      if (error) {
        // Fallback to basic search if RPC function doesn't exist
        return await fallbackSearch({ supabase, query, limit });
      }

      const users = (data || []).map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        name:
          user.display_name ||
          (user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name || user.last_name || 'Unknown'),
        similarity_score: user.similarity_score,
      }));

      return {
        success: true,
        users,
        count: users.length,
        message: `Found ${users.length} user${users.length !== 1 ? 's' : ''} matching "${query}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to search users: ${error.message}`,
      };
    }
  },
});

/**
 * Fallback search using basic ILIKE queries
 */
async function fallbackSearch({
  supabase,
  query,
  limit,
}: {
  supabase: any;
  query: string;
  limit: number;
}) {
  try {
    const searchPattern = `%${query}%`;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, email, first_name, last_name, display_name')
      .or(
        `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},display_name.ilike.${searchPattern},email.ilike.${searchPattern}`
      )
      .limit(limit);

    if (error) {
      return {
        success: false,
        error: `Failed to search users: ${error.message}`,
      };
    }

    const users = (data || []).map((user: any) => ({
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: user.display_name,
      name:
        user.display_name ||
        (user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.first_name || user.last_name || 'Unknown'),
    }));

    return {
      success: true,
      users,
      count: users.length,
      message: `Found ${users.length} user${users.length !== 1 ? 's' : ''} matching "${query}"`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search users: ${error.message}`,
    };
  }
}
