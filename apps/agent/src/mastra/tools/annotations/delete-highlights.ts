import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const deleteHighlights = createTool({
  id: 'deleteHighlights',
  description: `Remove AI-generated calendar highlights.

Use this tool to:
- Delete specific highlights by ID
- Clear all highlights
- Clear all event highlights or all time highlights

Use listHighlights first to get the IDs to delete
NOT for: Deleting categories, events, or calendars (use their respective delete tools)`,
  inputSchema: z.object({
    highlightIds: z
      .array(z.string())
      .optional()
      .describe('Specific highlight IDs to delete (get from listHighlights)'),
    clearAll: z
      .boolean()
      .optional()
      .describe('Set to true to delete ALL highlights (use with caution)'),
    clearType: z
      .enum(['events', 'time'])
      .optional()
      .describe('Clear all highlights of this type only (requires clearAll: true)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    count: z.number().optional().describe('Number of highlights deleted'),
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

      // Delete specific highlights by ID
      if (context.highlightIds && context.highlightIds.length > 0) {
        const { error, count } = await supabase
          .from('user_annotations')
          .delete()
          .in('id', context.highlightIds)
          .eq('user_id', user.id);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          count: count || 0,
          message: `Deleted ${count || 0} highlight${count === 1 ? '' : 's'}`,
        };
      }

      // Clear all highlights (with optional type filter)
      if (context.clearAll) {
        let query = supabase.from('user_annotations').delete().eq('user_id', user.id);

        if (context.clearType === 'events') {
          query = query.eq('type', 'ai_event_highlight');
        } else if (context.clearType === 'time') {
          query = query.eq('type', 'ai_time_highlight');
        }

        const { error, count } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const typeLabel = context.clearType ? `${context.clearType} ` : '';
        return {
          success: true,
          count: count || 0,
          message: `Cleared ${count || 0} ${typeLabel}highlight${count === 1 ? '' : 's'}`,
        };
      }

      return {
        success: false,
        error: 'Must provide either highlightIds or set clearAll to true',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
