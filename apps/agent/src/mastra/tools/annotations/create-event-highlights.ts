import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const createEventHighlights = createTool({
  id: 'createEventHighlights',
  description: `Highlight specific calendar events with blue/indigo glow and AI annotations.

USE FOR: Drawing attention to important, interesting, or problematic events
NOT FOR: Creating new calendar events (use createCalendarEvent instead)

VISUAL EFFECT: Selected events get a blue/indigo glowing border with sparkles badge

BEHAVIOR: Creates or updates highlights (one highlight per event per user)
- If event already highlighted: Updates with new emoji/title/message
- If event not highlighted: Creates new highlight
- Use listHighlights first to see current state (optional)

EXAMPLES:
- "Highlight all my meetings with executives today"
- "Mark the conflicting events with a warning"
- "Show me which events need preparation"
- "Update the highlight on that morning meeting to show it's urgent"

Each highlight includes:
- Emoji icon for visual recognition
- Title summarizing why it's highlighted
- Optional message with details/reasoning`,
  inputSchema: z.object({
    eventIds: z
      .array(z.string())
      .describe('Array of event IDs to highlight (get from getCalendarEvents tool)'),
    emoji: z.string().optional().describe('Emoji icon for all highlights (e.g., "🔥", "⚠️", "⭐")'),
    title: z.string().optional().describe('Title explaining why highlighted (e.g., "Important Meeting")'),
    message: z
      .string()
      .optional()
      .describe('Detailed explanation or AI reasoning (e.g., "Conflicts with focus time")'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    const userJwt = executionContext.runtimeContext?.get('jwt-token');

    if (!userJwt) {
      return { success: false, error: 'Authentication required' };
    }

    if (!context.eventIds || context.eventIds.length === 0) {
      return { success: false, error: 'No event IDs provided' };
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
        event_id: string;
        start_time: string;
        end_time: string;
        emoji_icon: string;
        title: string;
        message: string | null;
        visible: boolean;
      }> = [];

      // Fetch event times for each highlight
      for (const eventId of context.eventIds) {
        const { data: event } = await supabase
          .from('events')
          .select('start_time, end_time')
          .eq('id', eventId)
          .single();

        if (event) {
          annotations.push({
            user_id: user.id,
            type: 'ai_event_highlight',
            event_id: eventId,
            start_time: event.start_time,
            end_time: event.end_time,
            emoji_icon: context.emoji || '⭐',
            title: context.title || 'Highlighted Event',
            message: context.message || null,
            visible: true,
          });
        }
      }

      if (annotations.length === 0) {
        return { success: false, error: 'No valid events found' };
      }

      // Upsert to create or update (one highlight per event per user)
      const { data, error } = await supabase
        .from('user_annotations')
        .upsert(annotations, {
          onConflict: 'user_id,event_id,type',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        count: annotations.length,
        highlights: data,
        message: `Highlighted ${annotations.length} event${annotations.length === 1 ? '' : 's'}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
