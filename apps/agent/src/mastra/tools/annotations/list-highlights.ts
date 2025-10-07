import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const listHighlights = createTool({
  id: 'listHighlights',
  description: `Query existing calendar highlights.

Use this tool to:
- Check current highlights before adding/removing
- View highlights for a specific date range
- Filter by type (event highlights vs time highlights)
- Get specific highlights by ID

Use before creating new highlights to avoid duplicates`,
  inputSchema: z.object({
    type: z
      .enum(['events', 'time', 'all'])
      .optional()
      .describe('Filter by type: "events" for event highlights, "time" for time blocks, "all" for both'),
    startDate: z
      .string()
      .optional()
      .describe('Filter highlights starting from this date (ISO 8601 format)'),
    endDate: z
      .string()
      .optional()
      .describe('Filter highlights ending before this date (ISO 8601 format)'),
    highlightIds: z
      .array(z.string())
      .optional()
      .describe('Get specific highlights by ID (if you already know the IDs)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    count: z.number().optional().describe('Number of highlights found'),
    highlights: z
      .array(
        z.object({
          id: z.string(),
          user_id: z.string(),
          type: z.string().describe('Highlight type: ai_event_highlight or ai_time_highlight'),
          event_id: z.string().nullable().optional().describe('Event ID if event highlight'),
          start_time: z.string(),
          end_time: z.string(),
          emoji_icon: z.string(),
          title: z.string(),
          message: z.string().nullable().optional(),
          visible: z.boolean(),
          created_at: z.string().optional(),
        })
      )
      .optional(),
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
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${userJwt}`,
          },
        },
      });

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Failed to authenticate user' };
      }

      let query = supabase
        .from('user_annotations')
        .select('*')
        .eq('user_id', user.id)
        .eq('visible', true);

      // Filter by type
      if (context.type === 'events') {
        query = query.eq('type', 'ai_event_highlight');
      } else if (context.type === 'time') {
        query = query.eq('type', 'ai_time_highlight');
      }
      // 'all' or undefined = no type filter

      // Filter by date range
      if (context.startDate) {
        query = query.gte('start_time', context.startDate);
      }

      if (context.endDate) {
        query = query.lte('end_time', context.endDate);
      }

      // Filter by specific IDs
      if (context.highlightIds && context.highlightIds.length > 0) {
        query = query.in('id', context.highlightIds);
      }

      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        count: data.length,
        highlights: data,
        message: `Found ${data.length} highlight${data.length === 1 ? '' : 's'}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
