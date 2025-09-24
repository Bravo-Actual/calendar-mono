import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateAnnotation, useUpdateAnnotation, useAnnotations, clearAllHighlights } from '@/lib/data';

export const highlightEventsTool = createTool({
  id: 'highlightEvents',
  description: `Highlight specific calendar events to draw user attention with persistent visual indicators (yellow rings around events).

  WHEN TO USE:
  - When user asks to find/show/highlight specific events
  - To draw attention to conflicts, important meetings, or patterns
  - When analyzing schedule and want to mark relevant events
  - To visually group related events (e.g., "all meetings with John")

  VISUAL EFFECT:
  - Creates yellow highlight rings around specified events
  - Shows emoji + title/description as tooltip when hovering
  - Persists across page refreshes and navigation
  - Only visible to current user

  USE CASES:
  - "Show me all my meetings with conflicts" → highlight overlapping events
  - "Find my important meetings this week" → highlight high-priority events
  - "Which events can I reschedule?" → highlight flexible events
  - "Show me all recurring meetings" → highlight series events`,
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe(`Array of event IDs to highlight. Get these from calendar context or previous event queries.
      REQUIRED: Must have valid event IDs from the user's calendar data`),

    action: z.enum(['add', 'replace', 'clear']).default('replace').describe(`Action to take:
      - 'replace': Clear all existing highlights and show only these (most common)
      - 'add': Add these highlights to existing ones (when building on previous analysis)
      - 'clear': Remove all highlights (when user says "clear" or "remove highlights")`),

    title: z.string().optional().describe(`Short title for the highlight group (shows in tooltips):
      Examples: "Conflicts", "Important Meetings", "Flexible Events", "Overdue Tasks"`),

    description: z.string().optional().describe(`Detailed explanation with context (shows in tooltips):
      Examples: "These meetings overlap with your focus time", "High-priority events this week"
      TIP: Can include reasoning for why these events were highlighted`),

    emoji: z.string().optional().describe(`Single emoji to represent the highlight type (shows in tooltips):
      Suggestions: "⚠️" (conflicts), "⭐" (important), "🔥" (urgent), "💡" (suggestions),
      "📅" (scheduling), "🎯" (goals), "⏰" (time-sensitive), "🤝" (meetings)`)
  }),
  execute: async ({ context }) => {
    const { user } = useAuth.getState();
    const createAnnotation = useCreateAnnotation(user?.id);
    const updateAnnotation = useUpdateAnnotation(user?.id);
    const { data: existingAnnotations } = useAnnotations(user?.id);

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

      // Build description combining title, description, and emoji
      let fullDescription = '';
      if (context.emoji) fullDescription += context.emoji + ' ';
      if (context.title) fullDescription += context.title;
      if (context.description) {
        fullDescription += (fullDescription ? ': ' : '') + context.description;
      }

      // Create new highlights
      for (const eventId of context.eventIds) {
        try {
          const created = await createAnnotation.mutateAsync({
            type: 'ai_event_highlight',
            event_id: eventId,
            description: fullDescription || null,
            visible: true,
            start_time: null, // Not used for event highlights
            end_time: null    // Not used for event highlights
          });
          results.push({ eventId, id: created.id });
        } catch (error) {
          errors.push(`Failed to highlight event ${eventId}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        action: context.action,
        highlightedCount: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        message: `${context.action === 'add' ? 'Added' : 'Set'} ${results.length} persistent event highlight${results.length === 1 ? '' : 's'}${fullDescription ? `: ${fullDescription}` : ''}`,
        type: 'ai-highlight'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to manage event highlights: ${error.message}`
      };
    }
  }
});