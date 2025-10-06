import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * CLIENT-SIDE TOOL (Pattern B)
 *
 * Navigate to display a work week (Monday-Friday) view.
 */
export const navigateToWorkWeek = createTool({
  id: 'navigateToWorkWeek',
  description: `CLIENT-SIDE: Change calendar UI to display work week (Monday-Friday) view.

IMPORTANT: This only changes what the user sees - it does NOT fetch event data.
After navigating, you MUST call getCalendarEvents to retrieve and summarize events.

PURPOSE: Show a 5-day work week view, automatically calculating Monday-Friday range.

PARAMETERS:
- date: Any date within the desired work week in YYYY-MM-DD format (required)
- timezone: IANA timezone (optional, e.g. "America/Chicago")

BEHAVIOR:
- Calculates the Monday-Friday range containing the specified date
- If date is Saturday/Sunday, shows the following work week
- Sets view to work week mode

EXAMPLES:
{"date": "2025-10-08"} - Shows work week Oct 6-10 (Mon-Fri)
{"date": "2025-10-05"} - Shows work week Oct 6-10 (Sunday → next Mon-Fri)

USAGE:
- Use when user asks for "this work week" or "next work week"
- Default view for most business calendar navigation`,
  inputSchema: z.object({
    date: z.string().describe('Any date within the work week in YYYY-MM-DD format'),
    timezone: z
      .string()
      .optional()
      .describe('Timezone for date calculations (defaults to user profile timezone)'),
  }),
  // NO execute function - this is handled client-side
});
