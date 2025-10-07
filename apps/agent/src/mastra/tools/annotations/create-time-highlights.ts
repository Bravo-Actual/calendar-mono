import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const createTimeHighlights = createTool({
  id: 'createTimeHighlights',
  description: `Create colored time block highlights on the calendar.

Use this tool to:
- Mark focus periods, breaks, or gaps in schedule
- Highlight time ranges for analysis (e.g., overbooked times, free slots)
- Annotate time blocks with reasoning or suggestions

NOT for: Highlighting existing events (use createEventHighlights instead)`,
  inputSchema: z.object({
    timeRanges: z
      .array(
        z.object({
          start: z.string().describe('Start time in ISO 8601 format (e.g., "2025-10-06T09:00:00.000Z")'),
          end: z.string().describe('End time in ISO 8601 format (e.g., "2025-10-06T11:00:00.000Z")'),
          emoji: z.string().optional().describe('Emoji for this time block (e.g., "🎯", "☕", "📞")'),
          title: z
            .string()
            .optional()
            .describe('Title for this time block (e.g., "Deep Work", "Lunch Break")'),
          message: z
            .string()
            .optional()
            .describe('Explanation of why this time is highlighted (e.g., "Best time for focused work")'),
        })
      )
      .describe('Array of time ranges to highlight'),
    defaultEmoji: z
      .string()
      .optional()
      .describe('Default emoji for time blocks that don\'t specify one'),
    defaultTitle: z
      .string()
      .optional()
      .describe('Default title for time blocks that don\'t specify one'),
    defaultMessage: z
      .string()
      .optional()
      .describe('Default message for time blocks that don\'t specify one'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    count: z.number().optional().describe('Number of highlights created'),
    highlights: z
      .array(
        z.object({
          id: z.string(),
          user_id: z.string(),
          type: z.string(),
          start_time: z.string(),
          end_time: z.string(),
          emoji_icon: z.string(),
          title: z.string(),
          message: z.string().nullable().optional(),
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

    if (!context.timeRanges || context.timeRanges.length === 0) {
      return { success: false, error: 'No time ranges provided' };
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

      const annotations: Array<{
        user_id: string;
        type: string;
        event_id: null;
        start_time: string;
        end_time: string;
        emoji_icon: string;
        title: string;
        message: string | null;
        visible: boolean;
      }> = [];

      for (const range of context.timeRanges) {
        annotations.push({
          user_id: user.id,
          type: 'ai_time_highlight',
          event_id: null,
          start_time: range.start,
          end_time: range.end,
          emoji_icon: range.emoji || context.defaultEmoji || '🎯',
          title: range.title || context.defaultTitle || 'Highlighted Time',
          message: range.message || context.defaultMessage || null,
          visible: true,
        });
      }

      const { data, error } = await supabase.from('user_annotations').insert(annotations).select();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        count: annotations.length,
        highlights: data,
        message: `Created ${annotations.length} time highlight${annotations.length === 1 ? '' : 's'}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
