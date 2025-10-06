import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * MCP tool for navigating to full week view
 * Client-side execution - returns instructions for browser to handle
 */
export const navigateToWeekMCP = createTool({
  id: 'navigateToWeek',
  description: `Navigate to display a full 7-day week containing the specified date. Respects user's week start preference (Sunday or Monday). Use when user asks for "this week" or "the whole week" or when weekend context is important.`,
  inputSchema: z.object({
    date: z.string().describe('Any date within the week in YYYY-MM-DD format'),
    timezone: z
      .string()
      .optional()
      .describe('IANA timezone (optional, e.g. "America/Chicago")'),
    weekStartDay: z
      .number()
      .min(0)
      .max(6)
      .optional()
      .describe('Week start day: 0=Sunday, 1=Monday, etc (optional, defaults to user preference)'),
  }),
  // NO execute - client-side only. Client handles via onToolCall + addToolResult
});
