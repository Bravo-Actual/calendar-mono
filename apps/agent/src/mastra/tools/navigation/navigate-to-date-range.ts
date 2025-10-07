import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * CLIENT-SIDE TOOL (Pattern B)
 *
 * Navigate to display a custom consecutive date range.
 */
export const navigateToDateRange = createTool({
  id: 'navigateToDateRange',
  description: `Navigate to display a custom consecutive date range (1-14 days).

PURPOSE: Show a specific consecutive date range that doesn't fit standard week/work week patterns.
IMPORTANT: This only changes the calendar view. This tool is intended to be used in conjunction with other tools to complete the user's request.

PARAMETERS:
- startDate: First date of range in YYYY-MM-DD format (required)
- endDate: Last date of range in YYYY-MM-DD format (required)
- timezone: IANA timezone (optional, e.g. "America/Chicago")

BEHAVIOR:
- Displays consecutive dates from startDate to endDate (inclusive)
- Maximum 14 days
- If range is exactly 5 days or 7 days, may auto-select work week or week view
- Single day (startDate = endDate) shows day view

EXAMPLES:
{"startDate": "2025-10-06", "endDate": "2025-10-08"} - Shows 3-day range (Mon-Wed)
{"startDate": "2025-10-15", "endDate": "2025-10-15"} - Shows single day
{"startDate": "2025-10-01", "endDate": "2025-10-14"} - Shows 14-day range

USAGE:
- Use for custom ranges like "next 3 days" or "Oct 15-20"
- Use when user specifies non-standard date ranges
- Use for single day view when user asks for "tomorrow" or specific date`,
  inputSchema: z.object({
    startDate: z.string().describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    timezone: z
      .string()
      .optional()
      .describe('Timezone for date calculations (defaults to user profile timezone)'),
  }),
  // NO execute function - this is handled client-side
});
