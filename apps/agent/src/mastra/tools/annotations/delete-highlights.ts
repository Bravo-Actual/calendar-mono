import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const deleteHighlights = createTool({
  id: 'deleteHighlights',
  description: `Remove AI-generated calendar highlights (visual blue/indigo glows on events or time blocks).

WHAT ARE HIGHLIGHTS: AI annotations with sparkles badges that add visual emphasis to events/times
NOT FOR: Deleting categories, events, or calendars (use their respective delete tools)

USE FOR: Cleaning up AI highlights that are no longer needed
ALWAYS USE: listHighlights first to get the IDs to delete

EXAMPLES:
- "Remove the highlight I created on Sally's meeting" ← Use this tool
- "Clear the focus time highlights from today" ← Use this tool
- "Delete my Work category" ← DON'T use this tool (use deleteUserCategory)
- "Delete Sally's meeting" ← DON'T use this tool (use deleteCalendarEvent)

You can delete:
- Specific highlights by ID
- All highlights (clear everything)
- All event highlights only
- All time highlights only`,
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
