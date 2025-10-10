import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { getJwtFromContext } from '../../auth/jwt-storage.js';

export const findFreeTime = createTool({
  id: 'findFreeTime',
  description: `Find available time slots for a SINGLE person (most commonly OTHER people).

Primary use case: Check when someone else is available
- "When is John free tomorrow?" → searchUsers("john"), then findFreeTime(userId: john_id)
- "What times is Sarah available next week?" → searchUsers("sarah"), then findFreeTime(userId: sarah_id)
- "Show me Mike's free slots on Monday" → searchUsers("mike"), then findFreeTime(userId: mike_id)

Secondary use case: Check your own availability
- "When am I free tomorrow?" → findFreeTime (no userId needed - uses authenticated user)

For MULTIPLE people: Use findCommonFreeTime instead
- "When can John, Sarah, and I all meet?" → Use findCommonFreeTime

Workflow:
1. If checking someone else: Use searchUsers to get their user_id first
2. Call this tool with the user_id
3. Present results using the person's NAME (never expose user_id)

Returns: Free time slots respecting work hours and existing events (privacy-safe via free/busy)`,
  inputSchema: z.object({
    startDate: z.string().describe('Start date to search from in YYYY-MM-DD format'),
    endDate: z.string().describe('End date to search until in YYYY-MM-DD format'),
    durationMinutes: z
      .number()
      .optional()
      .describe('Minimum duration in minutes to filter results (defaults to 30 minutes)'),
    userId: z
      .string()
      .optional()
      .describe('User ID to find free time for (optional, defaults to authenticated user)'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    console.log('Finding free time:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('findFreeTime - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        freeSlots: [],
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
        } catch (_e) {
          return {
            success: false,
            error: 'Failed to decode JWT token',
            freeSlots: [],
          };
        }
      }

      // Get user's timezone from profile
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?select=timezone&id=eq.${targetUserId}`,
        {
          headers: {
            Authorization: `Bearer ${userJwt}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!profileResponse.ok) {
        return {
          success: false,
          error: `Failed to get user profile: ${profileResponse.statusText}`,
          freeSlots: [],
        };
      }

      const profiles = await profileResponse.json();
      const userTimezone = profiles[0]?.timezone || 'UTC';

      // Convert dates to ISO format using Luxon
      // If already ISO timestamp, use as-is; otherwise convert date string to start/end of day in user's timezone
      const startDate = context.startDate.includes('T')
        ? context.startDate
        : DateTime.fromISO(context.startDate, { zone: userTimezone })
            .startOf('day')
            .toUTC()
            .toISO();
      const endDate = context.endDate.includes('T')
        ? context.endDate
        : DateTime.fromISO(context.endDate, { zone: userTimezone })
            .endOf('day')
            .toUTC()
            .toISO();

      console.log('findFreeTime - Date conversion:', {
        userTimezone,
        inputStartDate: context.startDate,
        inputEndDate: context.endDate,
        convertedStartDate: startDate,
        convertedEndDate: endDate,
      });

      // Call find_available_time_slots (same function used by drag/drop)
      const freeTimeResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/find_available_time_slots`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userJwt}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_ids: [targetUserId],
          start_date: startDate,
          end_date: endDate,
          slot_duration_minutes: context.durationMinutes || 30,
          slot_increment_minutes: 15,
          requesting_user_id: targetUserId,
          user_timezone: userTimezone,
        }),
      });

      if (!freeTimeResponse.ok) {
        const errorText = await freeTimeResponse.text();
        console.error('Free time function error:', freeTimeResponse.status, errorText);
        return {
          success: false,
          error: `Failed to get free time: ${freeTimeResponse.status} ${errorText}`,
          freeSlots: [],
        };
      }

      const rawSlots = await freeTimeResponse.json();
      const minDuration = context.durationMinutes || 30;

      // Consolidate consecutive slots into blocks (same as drag/drop logic)
      const freeSlots: Array<{
        start_time: string;
        end_time: string;
        duration_minutes: number;
      }> = [];

      for (const slot of rawSlots) {
        if (!slot.all_users_free) continue; // Skip busy slots

        const startMs = new Date(slot.slot_start).getTime();
        const endMs = new Date(slot.slot_end).getTime();

        if (freeSlots.length === 0) {
          // First block
          freeSlots.push({
            start_time: slot.slot_start,
            end_time: slot.slot_end,
            duration_minutes: Math.floor((endMs - startMs) / (60 * 1000)),
          });
        } else {
          const lastBlock = freeSlots[freeSlots.length - 1];
          const lastEndMs = new Date(lastBlock.end_time).getTime();

          // If this slot touches or overlaps the last block, extend it
          if (startMs <= lastEndMs) {
            lastBlock.end_time = slot.slot_end;
            lastBlock.duration_minutes = Math.floor(
              (endMs - new Date(lastBlock.start_time).getTime()) / (60 * 1000)
            );
          } else {
            // New separate block
            freeSlots.push({
              start_time: slot.slot_start,
              end_time: slot.slot_end,
              duration_minutes: Math.floor((endMs - startMs) / (60 * 1000)),
            });
          }
        }
      }

      return {
        success: true,
        freeSlots: freeSlots,
        totalSlots: freeSlots.length,
        timezone: userTimezone,
        dateRange: `${context.startDate} to ${context.endDate}`,
        minDuration: `${minDuration} minutes`,
        message: `Found ${freeSlots.length} free time slot(s) of at least ${minDuration} minutes`,
      };
    } catch (error) {
      console.error('Error finding free time:', error);
      return {
        success: false,
        error: `Failed to find free time: ${error instanceof Error ? error.message : 'Unknown error'}`,
        freeSlots: [],
      };
    }
  },
});
