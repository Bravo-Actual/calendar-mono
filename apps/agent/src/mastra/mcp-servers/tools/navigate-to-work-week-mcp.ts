import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * MCP tool for navigating to work week view
 * CLIENT-SIDE EXECUTION ONLY - Schema definition for agent discovery
 * Actual execution happens in apps/calendar/src/ai-client-tools/handlers/navigate-to-work-week.ts
 */
export const navigateToWorkWeekMCP = createTool({
  id: 'navigateToWorkWeek',
  description: `Navigate to display a 5-day work week (Monday-Friday) containing the specified date. If date is on weekend, shows the following work week. Use when user asks for "this work week" or "next work week".`,
  inputSchema: z.object({
    date: z.string().describe('Any date within the work week in YYYY-MM-DD format'),
    timezone: z
      .string()
      .optional()
      .describe('IANA timezone (optional, e.g. "America/Chicago")'),
  }),
  // NO execute - client-side only. Client handles via onToolCall + addToolResult
});
