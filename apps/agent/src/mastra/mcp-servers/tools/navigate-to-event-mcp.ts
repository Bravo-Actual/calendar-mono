import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * MCP tool for navigating to show a specific event
 * CLIENT-SIDE EXECUTION ONLY - Schema definition for agent discovery
 * Actual execution happens in apps/calendar/src/ai-client-tools/handlers/navigate-to-event.ts
 */
export const navigateToEventMCP = createTool({
  id: 'navigateToEvent',
  description: `Navigate the calendar to display a specific event. Automatically selects work week (Mon-Fri) for weekday events or full week for weekend events. Use when user asks to "show me that meeting" or references a specific event.`,
  inputSchema: z.object({
    eventId: z.string().uuid().describe('The UUID of the event to navigate to'),
  }),
  // NO execute - client-side only. Client handles via onToolCall + addToolResult
});
