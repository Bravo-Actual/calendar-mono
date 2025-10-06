import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * CLIENT-SIDE TOOL (Pattern B)
 *
 * Navigate to display a full week (7-day) view.
 */
export const navigateToWeek = createTool({
  id: 'navigateToWeek',
  description: `Navigate to display a full 7-day week view containing the specified date.

PURPOSE: Show a complete week view (Sunday-Saturday or Monday-Sunday based on user preference).

PARAMETERS:
- date: Any date within the desired week in YYYY-MM-DD format (required)
- timezone: IANA timezone (optional, e.g. "America/Chicago")
- weekStartDay: Override week start day - 0=Sunday, 1=Monday, etc (optional)

BEHAVIOR:
- Calculates the 7-day week range containing the specified date
- Respects user's week start day preference (default: Sunday)
- Sets view to week mode

EXAMPLES:
{"date": "2025-10-08"} - Shows week Oct 5-11 (Sun-Sat, if user prefers Sunday start)
{"date": "2025-10-08", "weekStartDay": 1} - Shows week Oct 6-12 (Mon-Sun)

USAGE:
- Use when user asks for "this week" or "the whole week"
- Use when weekend context is important
- Use when user explicitly requests 7-day view`,
  inputSchema: z.object({
    date: z.string().describe('Any date within the week in YYYY-MM-DD format'),
    timezone: z
      .string()
      .optional()
      .describe('Timezone for date calculations (defaults to user profile timezone)'),
    weekStartDay: z
      .number()
      .min(0)
      .max(6)
      .optional()
      .describe('Week start day: 0=Sunday, 1=Monday, etc (defaults to user preference)'),
  }),
  // NO execute function - this is handled client-side
});
