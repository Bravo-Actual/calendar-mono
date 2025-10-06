import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * MCP tool for navigating to custom date range
 * Client-side execution - returns instructions for browser to handle
 */
export const navigateToDateRangeMCP = createTool({
  id: 'navigateToDateRange',
  description: `Navigate to display a custom consecutive date range (1-14 days). Use for custom ranges like "next 3 days" or "Oct 15-20". If range is exactly 5 or 7 days, may auto-select work week or week view.`,
  inputSchema: z.object({
    startDate: z.string().describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive, max 14 days from start)'),
    timezone: z
      .string()
      .optional()
      .describe('IANA timezone (optional, e.g. "America/Chicago")'),
  }),
  // NO execute - client-side only. Client handles via onToolCall + addToolResult
});
