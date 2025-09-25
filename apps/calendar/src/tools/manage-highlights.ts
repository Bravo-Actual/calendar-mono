import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { updateAnnotationLocal, deleteAnnotationLocal, getUserAnnotationsLocal, clearAllHighlights } from '@/lib/data';

export const manageHighlightsTool = createTool({
  id: 'manageHighlights',
  description: `Update, modify, or remove existing AI highlights with precision control.

  WHEN TO USE:
  - When user wants to modify existing highlights without recreating all
  - To hide/show specific highlights selectively
  - To update descriptions or emojis on existing highlights
  - When user says "remove just the morning ones" or "update that description"
  - For fine-tuned management of previous analysis results

  CAPABILITIES:
  - Update individual highlights by ID
  - Bulk operations by type (all events, all time ranges)
  - Hide/show without deleting (preserves analysis)
  - Permanently delete specific highlights
  - Update descriptions, titles, emojis on existing highlights

  USE CASES:
  - "Hide the afternoon time blocks" → set specific highlights invisible
  - "Change that conflict emoji to a warning" → update existing highlight
  - "Remove just the lunch meeting highlights" → delete specific subset
  - "Show all the hidden highlights again" → make invisible highlights visible`,

  inputSchema: z.object({
    action: z.enum(['update', 'hide', 'show', 'delete']).describe(`Action to perform:
      - 'update': Modify properties of existing highlights (description, emoji, etc.)
      - 'hide': Make highlights invisible but keep them (can be shown again later)
      - 'show': Make previously hidden highlights visible again
      - 'delete': Permanently remove highlights (cannot be recovered)`),

    // Target selection (one of these must be provided)
    highlightIds: z.array(z.string()).optional().describe(`Specific highlight IDs to target.
      Use this for precise control over individual highlights.
      Get IDs from getHighlights tool first.`),

    filterBy: z.object({
      type: z.enum(['ai_event_highlight', 'ai_time_highlight']).optional().describe(`Target highlights by type:
        - 'ai_event_highlight': Target only event highlights (yellow rings)
        - 'ai_time_highlight': Target only time range highlights (colored blocks)`),

      eventIds: z.array(z.string()).optional().describe(`Target highlights for specific events.
        Use when you want to manage highlights for particular events only.`),

      timeRange: z.object({
        start: z.string().describe('ISO timestamp for start of time range'),
        end: z.string().describe('ISO timestamp for end of time range')
      }).optional().describe(`Target time highlights within a specific time period.
        Useful for "remove morning highlights" or "hide afternoon blocks".`),

      descriptionContains: z.string().optional().describe(`Target highlights whose descriptions contain this text.
        Case-insensitive search. Useful for "remove conflict highlights" or "hide suggestions".`)
    }).optional().describe(`Filter criteria for bulk operations.
      Use when you want to target multiple highlights by pattern rather than specific IDs.`),

    // Updates (only used with 'update' action)
    updates: z.object({
      title: z.string().optional().describe(`New title for the highlights.
        Will replace existing title. Use empty string to remove title.`),

      description: z.string().optional().describe(`New description for the highlights.
        Will replace existing description. Use empty string to remove description.`),

      emoji: z.string().optional().describe(`New emoji for the highlights.
        Will replace existing emoji. Use empty string to remove emoji.`)
    }).optional().describe(`Properties to update (only used with 'update' action).
      Any provided fields will replace the existing values.`)
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

      if (!annotations || annotations.length === 0) {
        return {
          success: false,
          error: 'No highlights found to manage'
        };
      }

      // Determine target highlights
      let targetHighlights = [];

      if (context.highlightIds && context.highlightIds.length > 0) {
        // Target specific highlights by ID
        targetHighlights = annotations.filter(a => context.highlightIds!.includes(a.id));
      } else if (context.filterBy) {
        // Target highlights by filter criteria
        targetHighlights = annotations;

        if (context.filterBy.type) {
          targetHighlights = targetHighlights.filter(a => a.type === context.filterBy!.type);
        }

        if (context.filterBy.eventIds) {
          targetHighlights = targetHighlights.filter(a =>
            a.event_id && context.filterBy!.eventIds!.includes(a.event_id)
          );
        }

        if (context.filterBy.timeRange) {
          const rangeStart = new Date(context.filterBy.timeRange.start).getTime();
          const rangeEnd = new Date(context.filterBy.timeRange.end).getTime();
          targetHighlights = targetHighlights.filter(a =>
            a.type === 'ai_time_highlight' &&
            a.start_time_ms >= rangeStart &&
            a.end_time_ms <= rangeEnd
          );
        }

        if (context.filterBy.descriptionContains) {
          const searchTerm = context.filterBy.descriptionContains.toLowerCase();
          targetHighlights = targetHighlights.filter(a =>
            a.message && a.message.toLowerCase().includes(searchTerm)
          );
        }
      } else {
        return {
          success: false,
          error: 'Must provide either highlightIds or filterBy criteria'
        };
      }

      if (targetHighlights.length === 0) {
        return {
          success: false,
          error: 'No highlights matched the specified criteria'
        };
      }

      const results = [];
      const errors = [];

      // Perform the requested action
      for (const highlight of targetHighlights) {
        try {
          switch (context.action) {
            case 'hide':
              await updateAnnotationLocal(userId, highlight.id, {
                visible: false
              });
              results.push({ id: highlight.id, action: 'hidden' });
              break;

            case 'show':
              await updateAnnotationLocal(userId, highlight.id, {
                visible: true
              });
              results.push({ id: highlight.id, action: 'shown' });
              break;

            case 'delete':
              await deleteAnnotationLocal(userId, highlight.id);
              results.push({ id: highlight.id, action: 'deleted' });
              break;

            case 'update':
              if (!context.updates) {
                errors.push(`Update action requires 'updates' object`);
                continue;
              }

              // Build new description combining updates
              let newDescription = highlight.message || '';

              if (context.updates.emoji !== undefined || context.updates.title !== undefined || context.updates.description !== undefined) {
                newDescription = '';
                if (context.updates.emoji !== undefined) {
                  newDescription += (context.updates.emoji || '') + (context.updates.emoji ? ' ' : '');
                }
                if (context.updates.title !== undefined) {
                  newDescription += (context.updates.title || '');
                }
                if (context.updates.description !== undefined) {
                  newDescription += (newDescription && context.updates.description ? ': ' : '') + (context.updates.description || '');
                }
              }

              await updateAnnotationLocal(userId, highlight.id, {
                message: newDescription || null
              });
              results.push({ id: highlight.id, action: 'updated', newDescription });
              break;
          }
        } catch (error) {
          errors.push(`Failed to ${context.action} highlight ${highlight.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const actionWord = context.action === 'delete' ? 'deleted' :
                        context.action === 'hide' ? 'hidden' :
                        context.action === 'show' ? 'shown' : 'updated';

      return {
        success: errors.length === 0,
        action: context.action,
        affected: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        message: `${results.length} highlight${results.length === 1 ? '' : 's'} ${actionWord}${errors.length > 0 ? ` (${errors.length} error${errors.length === 1 ? '' : 's'})` : ''}`
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to manage highlights: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});