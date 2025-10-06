import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * CLIENT-SIDE TOOL (Pattern B)
 *
 * Navigate to display a non-consecutive array of specific dates.
 */
export const navigateToDates = createTool({
  id: 'navigateToDates',
  description: `Navigate to display a specific array of dates (can be non-consecutive, max 14 dates).

PURPOSE: Show multiple specific dates that may not be consecutive, in a side-by-side view.

PARAMETERS:
- dates: Array of dates in YYYY-MM-DD format (required, max 14)
- timezone: IANA timezone (optional, e.g. "America/Chicago")

BEHAVIOR:
- Displays each date as a separate column
- Dates can be non-consecutive (e.g., Mon, Wed, Fri)
- If dates happen to be consecutive, may auto-convert to date range view
- Maximum 14 dates

EXAMPLES:
{"dates": ["2025-10-06", "2025-10-08", "2025-10-10"]} - Shows Mon, Wed, Fri
{"dates": ["2025-10-01", "2025-10-15"]} - Shows two non-consecutive dates
{"dates": ["2025-10-05"]} - Shows single date

USAGE:
- Use when user asks for specific non-consecutive dates
- Use for patterns like "every Monday this month"
- Use for comparing specific dates side-by-side
- Use when user requests "show me these specific days"`,
  inputSchema: z.object({
    dates: z
      .array(z.string())
      .min(1)
      .max(14)
      .describe('Array of dates in YYYY-MM-DD format (max 14 dates)'),
    timezone: z
      .string()
      .optional()
      .describe('Timezone for date calculations (defaults to user profile timezone)'),
  }),
  // NO execute function - this is handled client-side
});
