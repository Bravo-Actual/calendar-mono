import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const navigateCalendar = createTool({
  id: 'navigateCalendar',
  description: 'Navigate the user\'s calendar to display specific dates or time periods. IMPORTANT: Only navigate when the user is not already on a view that contains what you want to show them. Default to the same view type (work week, week, day, etc) that the user is already using when navigating unless you get permission to change it or MUST change it to complete your task. Use this tool to: 1) Show meetings you found for the user, 2) Navigate to time slots that would work for new or rescheduled meetings, 3) Display a specific date range when user asks to check their schedule. Works great when coupled with highlighting tools to draw attention to specific events or time ranges. Updates the client-side calendar view. Supports consecutive (date range, max 14 days) or non-consecutive (specific dates, max 14 dates) modes.',
  inputSchema: z.object({
    // Mode 1: Consecutive dates (date range)
    startDate: z.string().optional().describe('Start date in YYYY-MM-DD format for consecutive mode'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format for consecutive mode (max 14 days from start)'),

    // Mode 2: Non-consecutive dates (array of specific dates)
    dates: z.array(z.string()).optional().describe('Array of specific dates in YYYY-MM-DD format for non-consecutive mode (max 14 dates)'),

    timezone: z.string().optional().describe('Timezone for date calculations (defaults to user profile timezone)'),
  }),
  execute: async ({ context }) => {
    // Server-side tool - returns navigation instructions for the frontend to execute

    if (context.dates && Array.isArray(context.dates)) {
      // Mode 2: Non-consecutive dates
      if (context.dates.length > 14) {
        return {
          success: false,
          error: 'Maximum of 14 dates allowed in non-consecutive mode'
        };
      }

      // Sort and validate dates
      const validDates = context.dates
        .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();

      if (validDates.length === 0) {
        return {
          success: false,
          error: 'No valid dates provided (use YYYY-MM-DD format)'
        };
      }

      return {
        success: true,
        type: "calendar-navigation" as const,
        navigation: {
          mode: 'non-consecutive' as const,
          dates: validDates
        },
        message: `Calendar navigated to ${validDates.length} non-consecutive dates: ${validDates.join(', ')}`
      };

    } else if (context.startDate) {
      // Mode 1: Consecutive dates (range)
      const startDate = context.startDate;
      let endDate = context.endDate || startDate;

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return {
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format'
        };
      }

      // Calculate and limit day count
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (endDateObj < startDateObj) {
        return {
          success: false,
          error: 'End date must be on or after start date'
        };
      }

      const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 13) { // 13 days difference = 14 days total
        const limitedEndDate = new Date(startDateObj);
        limitedEndDate.setDate(startDateObj.getDate() + 13);
        endDate = limitedEndDate.toISOString().split('T')[0];
      }

      const finalDayCount = Math.min(daysDiff + 1, 14);

      // Determine consecutive view type based on day count
      let consecutiveType: 'day' | 'week' | 'workweek' | 'custom-days';
      if (finalDayCount === 1) {
        consecutiveType = 'day';
      } else if (finalDayCount === 7) {
        consecutiveType = 'week';
      } else if (finalDayCount === 5) {
        consecutiveType = 'workweek';
      } else {
        consecutiveType = 'custom-days';
      }

      return {
        success: true,
        type: "calendar-navigation" as const,
        navigation: {
          mode: 'consecutive' as const,
          consecutiveType,
          startDate,
          endDate,
          dayCount: finalDayCount
        },
        message: `Calendar navigated to consecutive range: ${startDate} to ${endDate} (${finalDayCount} days)`
      };

    } else {
      return {
        success: false,
        error: 'Must provide either startDate (for consecutive mode) or dates array (for non-consecutive mode)'
      };
    }
  },
});