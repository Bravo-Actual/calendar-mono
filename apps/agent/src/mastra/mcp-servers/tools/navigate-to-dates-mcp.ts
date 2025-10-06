import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * MCP tool for navigating to specific dates (non-consecutive allowed)
 * Client-side execution - returns instructions for browser to handle
 */
export const navigateToDatesMCP = createTool({
  id: 'navigateToDates',
  description: `Navigate to display a specific array of dates (can be non-consecutive, max 14 dates). Use for patterns like "every Monday this month" or "these specific days". If dates are consecutive, may auto-convert to date range view.`,
  inputSchema: z.object({
    dates: z
      .array(z.string())
      .min(1)
      .max(14)
      .describe('Array of dates in YYYY-MM-DD format (max 14 dates)'),
    timezone: z
      .string()
      .optional()
      .describe('IANA timezone (optional, e.g. "America/Chicago")'),
  }),
  // NO execute - client-side only. Client handles via onToolCall + addToolResult
});
