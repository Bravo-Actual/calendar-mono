import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../../auth/jwt-storage.js';

/**
 * MCP tool for finding free time slots in user's calendar
 * Wraps the main findFreeTime tool for MCP server usage
 */
export const findFreeTimeMCP = createTool({
  id: 'findFreeTime',
  description: 'Find free time slots in the user\'s calendar within their work schedule via MCP. Returns gaps between scheduled events during work periods. Minimum slot duration is 30 minutes by default.',
  inputSchema: z.object({
    startDate: z.string().describe('Start date to search from in YYYY-MM-DD format'),
    endDate: z.string().describe('End date to search until in YYYY-MM-DD format'),
    durationMinutes: z.number().optional().describe('Minimum duration in minutes to filter results (defaults to 30 minutes)'),
    userId: z.string().optional().describe('User ID to find free time for (optional, defaults to authenticated user)'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('MCP findFreeTime:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('findFreeTimeMCP - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        freeSlots: []
      };
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

      // Get current user ID from JWT if no userId provided
      let targetUserId = context.userId;
      if (!targetUserId) {
        try {
          const tokenParts = userJwt.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          targetUserId = payload.sub;
        } catch (e) {
          return {
            success: false,
            error: 'Failed to decode JWT token',
            freeSlots: []
          };
        }
      }

      // Get user's timezone from profile
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?select=timezone&id=eq.${targetUserId}`,
        {
          headers: {
            'Authorization': `Bearer ${userJwt}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!profileResponse.ok) {
        return {
          success: false,
          error: `Failed to get user profile: ${profileResponse.statusText}`,
          freeSlots: []
        };
      }

      const profiles = await profileResponse.json();
      const userTimezone = profiles[0]?.timezone || 'UTC';

      // Call the get_user_free_time function
      const freeTimeResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_user_free_time`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userJwt}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_user_id: targetUserId,
            p_start_date: context.startDate,
            p_end_date: context.endDate,
            p_timezone: userTimezone
          })
        }
      );

      if (!freeTimeResponse.ok) {
        const errorText = await freeTimeResponse.text();
        console.error('Free time function error:', freeTimeResponse.status, errorText);
        return {
          success: false,
          error: `Failed to get free time: ${freeTimeResponse.status} ${errorText}`,
          freeSlots: []
        };
      }

      const freeSlots = await freeTimeResponse.json();

      // Apply minimum duration filter (default 30 minutes, or user specified)
      const minDuration = context.durationMinutes || 30;
      const filteredSlots = freeSlots.filter((slot: any) => slot.duration_minutes >= minDuration);

      return {
        success: true,
        freeSlots: filteredSlots,
        totalSlots: filteredSlots.length,
        timezone: userTimezone,
        dateRange: `${context.startDate} to ${context.endDate}`,
        minDuration: `${minDuration} minutes`,
        message: `Found ${filteredSlots.length} free time slot(s) of at least ${minDuration} minutes via MCP`
      };

    } catch (error) {
      console.error('Error finding free time via MCP:', error);
      return {
        success: false,
        error: `Failed to find free time: ${error instanceof Error ? error.message : 'Unknown error'}`,
        freeSlots: []
      };
    }
  },
});