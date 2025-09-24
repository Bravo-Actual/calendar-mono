import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateAnnotation, clearAllHighlights } from '@/lib/data';

export const highlightTimeRangesTool = createTool({
  id: 'highlightTimeRanges',
  description: `Highlight specific time periods on the calendar with persistent visual overlays (colored blocks behind events).

  WHEN TO USE:
  - When suggesting available time slots for scheduling
  - To mark focus time, break periods, or work blocks
  - When analyzing productivity patterns or time usage
  - To show conflicts, overlaps, or scheduling opportunities
  - When user asks "when am I free?" or "suggest times for X"

  VISUAL EFFECT:
  - Creates colored time blocks overlaid on the calendar
  - Shows emoji + title/description as labels when space allows
  - Shows full details in tooltips when hovering
  - Persists across page refreshes and navigation
  - Only visible to current user

  USE CASES:
  - "When am I free for a 30min meeting?" → highlight open slots
  - "Show my focus time blocks" → highlight deep work periods
  - "When do I have scheduling conflicts?" → highlight overlapping times
  - "Suggest times for lunch meetings" → highlight lunch-appropriate slots
  - "Block time for project work" → highlight recommended work periods`,
  inputSchema: z.object({
    timeRanges: z.array(z.object({
      start: z.string().describe(`ISO timestamp for start of highlight (REQUIRED):
        - Must be in ISO format: "2024-01-15T09:00:00.000Z"
        - Use user's timezone context from calendar
        - Should align with user's time preferences (work hours, etc.)`),

      end: z.string().describe(`ISO timestamp for end of highlight (REQUIRED):
        - Must be in ISO format: "2024-01-15T10:00:00.000Z"
        - Must be after start time
        - Consider appropriate duration for the purpose (meetings: 30-60min, focus: 2-4hrs)`),

      title: z.string().optional().describe(`Title for this specific time slot (shows as label on calendar):
        Examples: "Available", "Focus Time", "Lunch Break", "Quick Call Slot"
        Keep short - appears directly on the calendar when space allows`),

      description: z.string().optional().describe(`Detailed context for this time slot (shows in tooltips):
        Examples: "Perfect for team meetings", "Your most productive hours", "Avoid - right after lunch"
        Can include reasoning for why this time is highlighted`),

      emoji: z.string().optional().describe(`Single emoji for this time slot (shows as visual indicator):
        Suggestions: "⭐" (best), "🟢" (available), "⚡" (energy), "🎯" (focus), "☕" (break),
        "🌅" (morning), "🌙" (evening), "🔥" (productive), "💡" (creative time)`)
    })).describe('Array of time ranges to highlight with individual properties'),

    action: z.enum(['add', 'replace', 'clear']).default('replace').describe(`Action to take:
      - 'replace': Clear existing highlights and show only these (most common for new analysis)
      - 'add': Add these to existing highlights (when building on previous suggestions)
      - 'clear': Remove all time highlights (when user says "clear" or "remove highlights")`),

    globalTitle: z.string().optional().describe(`Overall title applied to all ranges that don't have individual titles:
      Examples: "Suggested Times", "Available Slots", "Focus Blocks", "Meeting Windows"
      Use when all time ranges serve the same purpose`),

    globalDescription: z.string().optional().describe(`Overall context applied to all ranges that don't have individual descriptions:
      Examples: "Best times based on your schedule patterns", "Free slots for scheduling meetings"
      Explain the analysis or reasoning behind these suggestions`)
  }),
  execute: async ({ context }) => {
    const { user } = useAuth.getState();
    const createAnnotation = useCreateAnnotation(user?.id);

    if (!user?.id) {
      return {
        success: false,
        error: 'User authentication required'
      };
    }

    try {
      const results = [];
      const errors = [];

      if (context.action === 'clear') {
        await clearAllHighlights(user.id);
        return {
          success: true,
          action: 'clear',
          message: 'Cleared all AI highlights'
        };
      }

      if (context.action === 'replace') {
        // Clear existing highlights first
        await clearAllHighlights(user.id);
      }

      // Create new time range highlights
      for (const timeRange of context.timeRanges) {
        try {
          // Build description combining range-specific and global info
          let fullDescription = '';

          // Use range-specific emoji/title/description if available, otherwise global
          const emoji = timeRange.emoji || '';
          const title = timeRange.title || context.globalTitle || '';
          const description = timeRange.description || context.globalDescription || '';

          if (emoji) fullDescription += emoji + ' ';
          if (title) fullDescription += title;
          if (description) {
            fullDescription += (fullDescription ? ': ' : '') + description;
          }

          const created = await createAnnotation.mutateAsync({
            type: 'ai_time_highlight',
            event_id: null, // Not used for time highlights
            start_time: timeRange.start,
            end_time: timeRange.end,
            description: fullDescription || null,
            visible: true
          });

          results.push({
            id: created.id,
            start: timeRange.start,
            end: timeRange.end,
            description: fullDescription
          });
        } catch (error) {
          errors.push(`Failed to highlight time range ${timeRange.start}-${timeRange.end}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        action: context.action,
        highlightedRanges: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        message: `${context.action === 'add' ? 'Added' : 'Set'} ${results.length} persistent time highlight${results.length === 1 ? '' : 's'}${context.globalTitle ? `: ${context.globalTitle}` : ''}`,
        type: 'ai-highlight'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to manage time range highlights: ${error.message}`
      };
    }
  }
});