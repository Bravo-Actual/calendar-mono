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
  description: 'Navigate the user\'s calendar to display specific dates or time periods. IMPORTANT: Only navigate when the user is not already on a view that contains what you want to show them. Default to the same view type (work week, week, day, etc) that the user is already using when navigating unless you get permission to change it or MUST change it to complete your task. Use this tool to: 1) Show meetings you found for the user, 2) Navigate to time slots that would work for new or rescheduled meetings, 3) Display a specific date range when user asks to check their schedule. Works great when coupled with highlighting tools to draw attention to specific events or time ranges. Updates the client-side calendar view. Supports consecutive (date range, max 14 days) or non-consecutive (specific dates, max 14 dates) modes.',
  inputSchema: z.object({
    // Mode 1: Consecutive dates (date range)
    startDate: z.string().optional().describe('Start date in YYYY-MM-DD format for consecutive mode'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format for consecutive mode (max 14 days from start)'),

    // Mode 2: Non-consecutive dates (array of specific dates)
    dates: z.array(z.string()).optional().describe('Array of specific dates in YYYY-MM-DD format for non-consecutive mode (max 14 dates)'),

    // View type hint (optional - client will auto-detect if not provided)
    viewType: z.enum(['day', 'week', 'workweek', 'custom-days', 'dates']).optional().describe('Explicit view type to use (auto-detected from dates if not provided)'),

    // Settings
    timezone: z.string().optional().describe('Timezone for date calculations (defaults to user profile timezone)'),
    weekStartDay: z.number().min(0).max(6).optional().describe('Week start day: 0=Sunday, 1=Monday, etc'),
  }),
  // NO execute function - this is handled client-side
});