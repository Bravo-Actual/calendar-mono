import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * CLIENT-SIDE TOOL (Pattern B)
 *
 * This tool has NO execute function - it's schema-only.
 * The LLM can call it, but execution happens in the browser via:
 * apps/calendar/src/ai-client-tools/handlers/navigation.ts
 *
 * This pattern is used for UI actions that need direct access to:
 * - Zustand stores
 * - React components
 * - Browser state
 */
export const navigateCalendar = createTool({
  id: 'navigateCalendar',
  description: `Navigate the user's calendar to display specific dates or time periods.

PURPOSE: Update the UI calendar view to show specific dates (max 14 days)

VIEW TYPES:
- day: Single day
- week: 7-day week (auto-detected from date range)
- workweek: 5-day Monday-Friday (auto-detected from date range)
- custom-days: Custom consecutive range 1-14 days
- dates: Non-consecutive specific dates (date array mode)

PARAMETERS:
- startDate: YYYY-MM-DD format (required for date range mode)
- endDate: YYYY-MM-DD format (optional - omit for single day)
- dates: Array of YYYY-MM-DD strings (for non-consecutive dates, max 14)
- viewType: Explicit view type (optional - auto-detected if omitted)
- timezone: IANA timezone (optional, e.g. "America/Chicago")
- weekStartDay: 0=Sunday, 1=Monday, etc (optional)

USAGE:
- Only navigate when user is NOT already viewing the dates you want to show
- Default to same view type unless user requests change
- Use with event highlights to draw attention to specific times
- Supports both date range (consecutive) and date array (non-consecutive) modes

EXAMPLES:
Single day: {"startDate": "2025-10-05"}
Week: {"startDate": "2025-10-05", "endDate": "2025-10-11"}
Workweek: {"startDate": "2025-10-06", "endDate": "2025-10-10"}
Custom 3 days: {"startDate": "2025-10-05", "endDate": "2025-10-07"}
Non-consecutive: {"dates": ["2025-10-05", "2025-10-10", "2025-10-15"]}`,
  inputSchema: z.object({
    // Mode 1: Consecutive dates (date range)
    startDate: z
      .string()
      .optional()
      .describe('Start date in YYYY-MM-DD format for consecutive mode'),
    endDate: z
      .string()
      .optional()
      .describe('End date in YYYY-MM-DD format for consecutive mode (max 14 days from start)'),

    // Mode 2: Non-consecutive dates (array of specific dates)
    dates: z
      .array(z.string())
      .optional()
      .describe(
        'Array of specific dates in YYYY-MM-DD format for non-consecutive mode (max 14 dates)'
      ),

    // View type hint (optional - client will auto-detect if not provided)
    viewType: z
      .enum(['day', 'week', 'workweek', 'custom-days', 'dates'])
      .optional()
      .describe('Explicit view type to use (auto-detected from dates if not provided)'),

    // Settings
    timezone: z
      .string()
      .optional()
      .describe('Timezone for date calculations (defaults to user profile timezone)'),
    weekStartDay: z
      .number()
      .min(0)
      .max(6)
      .optional()
      .describe('Week start day: 0=Sunday, 1=Monday, etc'),
  }),
  // NO execute function - this is handled client-side
});
