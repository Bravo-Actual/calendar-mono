import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { getUserAnnotationsLocal } from '@/lib/data';

export const getHighlightsTool = createTool({
  id: 'getHighlights',
  description: `Query and analyze current AI highlights on the calendar to understand what's already been marked.

  WHEN TO USE:
  - Before creating new highlights to avoid duplicates
  - When user asks "what highlights do I have?" or "what did you mark?"
  - To analyze patterns in previously highlighted items
  - When building on previous analysis (use 'add' action with new highlights)
  - To understand context before making new suggestions

  WHAT IT RETURNS:
  - List of all current highlights with their details
  - Separates event highlights from time range highlights
  - Shows titles, descriptions, emojis for each highlight
  - Includes visibility status and creation info

  USE CASES:
  - "What events did you highlight earlier?" → shows current event highlights
  - "Clear the morning time blocks but keep afternoon ones" → get highlights first to be selective
  - "Add more suggestions to what you already showed" → check existing before adding
  - "What conflicts did you find?" → review previous analysis results`,

  inputSchema: z.object({
    type: z.enum(['all', 'events', 'time_ranges']).default('all').describe(`Type of highlights to retrieve:
      - 'all': Get both event and time range highlights (most common)
      - 'events': Get only event highlights (yellow rings around events)
      - 'time_ranges': Get only time range highlights (colored time blocks)`),

    includeHidden: z.boolean().default(false).describe(`Include hidden/cleared highlights in results:
      - false: Show only currently visible highlights (default)
      - true: Include previously cleared highlights for full history`),

    summary: z.boolean().default(true).describe(`Return summary format:
      - true: Condensed summary with counts and key details (default, faster)
      - false: Full detailed information for each highlight`)
  }),

  execute: async ({ context }) => {
    const { userId } = context as any;

    if (!userId) {
      return {
        success: false,
        error: 'User authentication required'
      };
    }

    try {
      const annotations = await getUserAnnotationsLocal(userId);

      if (!annotations) {
        return {
          success: true,
          highlights: {
            total: 0,
            eventHighlights: 0,
            timeHighlights: 0,
            events: [],
            timeRanges: []
          },
          message: 'No highlights found'
        };
      }

      // Filter annotations based on type and visibility
      let filteredAnnotations = annotations;

      if (!context.includeHidden) {
        filteredAnnotations = filteredAnnotations.filter(a => a.visible);
      }

      const eventHighlights = filteredAnnotations.filter(a => a.type === 'ai_event_highlight');
      const timeHighlights = filteredAnnotations.filter(a => a.type === 'ai_time_highlight');

      // Filter by requested type
      let finalEventHighlights = eventHighlights;
      let finalTimeHighlights = timeHighlights;

      if (context.type === 'events') {
        finalTimeHighlights = [];
      } else if (context.type === 'time_ranges') {
        finalEventHighlights = [];
      }

      if (context.summary) {
        // Return condensed summary
        const eventSummary = finalEventHighlights.map(h => ({
          id: h.id,
          eventId: h.event_id,
          description: h.message,
          visible: h.visible,
          createdAt: h.created_at
        }));

        const timeSummary = finalTimeHighlights.map(h => ({
          id: h.id,
          start: h.start_time,
          end: h.end_time,
          description: h.message,
          visible: h.visible,
          duration: Math.round((h.end_time_ms - h.start_time_ms) / 60000) + ' minutes'
        }));

        return {
          success: true,
          highlights: {
            total: finalEventHighlights.length + finalTimeHighlights.length,
            eventHighlights: finalEventHighlights.length,
            timeHighlights: finalTimeHighlights.length,
            events: eventSummary,
            timeRanges: timeSummary
          },
          message: `Found ${finalEventHighlights.length} event highlight${finalEventHighlights.length === 1 ? '' : 's'} and ${finalTimeHighlights.length} time range highlight${finalTimeHighlights.length === 1 ? '' : 's'}`
        };
      } else {
        // Return full detailed information
        return {
          success: true,
          highlights: {
            total: finalEventHighlights.length + finalTimeHighlights.length,
            eventHighlights: finalEventHighlights.length,
            timeHighlights: finalTimeHighlights.length,
            events: finalEventHighlights,
            timeRanges: finalTimeHighlights
          },
          message: `Retrieved detailed information for ${finalEventHighlights.length} event highlight${finalEventHighlights.length === 1 ? '' : 's'} and ${finalTimeHighlights.length} time range highlight${finalTimeHighlights.length === 1 ? '' : 's'}`
        };
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve highlights: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});