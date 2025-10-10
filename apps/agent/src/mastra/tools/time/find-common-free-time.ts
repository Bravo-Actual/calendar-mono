import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { DateTime } from 'luxon';

export const findCommonFreeTime = createTool({
  id: 'findCommonFreeTime',
  description: `Find common available time slots when MULTIPLE people are all free simultaneously.

Primary use cases:
- "When can John, Sarah, and I all meet next week?"
- "Find 1-hour slots when everyone on my team is free tomorrow"
- "What times work for all three attendees this afternoon?"
- "When are both Mike and Lisa available for a meeting?"

Required workflow (CRITICAL - follow these steps):
1. Use searchUsers to get user_id for EACH person mentioned
   - User asks "When can John and Sarah meet?" → searchUsers("john"), searchUsers("sarah")
   - For "John, Sarah, and I" → searchUsers for John and Sarah, plus authenticated user
2. Collect all user_ids into an array (include authenticated user's ID if they're attending)
3. Call this tool with userIds array
4. Present results using people's NAMES (never expose user_ids)

Example flow:
User: "When can I meet with John and Sarah tomorrow?"
→ searchUsers("john") → gets john_user_id
→ searchUsers("sarah") → gets sarah_user_id
→ findCommonFreeTime(userIds: [auth_user_id, john_user_id, sarah_user_id], startDate: tomorrow, endDate: tomorrow)
→ Present: "You, John, and Sarah are all free: 2pm-3pm, 4pm-5pm"

IMPORTANT: Only returns times when ALL users are free (not partially free).
Respects each person's work hours and existing calendar events (privacy-safe via free/busy).`,
  inputSchema: z.object({
    userIds: z
      .array(z.string())
      .min(1)
      .describe('Array of user IDs to find common free time for (use searchUsers to get these)'),
    startDate: z
      .string()
      .describe('Start date to search from in YYYY-MM-DD or ISO 8601 format'),
    endDate: z.string().describe('End date to search until in YYYY-MM-DD or ISO 8601 format'),
    durationMinutes: z
      .number()
      .min(15)
      .default(30)
      .optional()
      .describe('Minimum duration in minutes for free slots (default: 30)'),
    slotIncrementMinutes: z
      .number()
      .min(15)
      .max(60)
      .default(15)
      .optional()
      .describe('Time slot increment in minutes (default: 15)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    freeSlots: z
      .array(
        z.object({
          start_time: z.string().describe('ISO 8601 start time'),
          end_time: z.string().describe('ISO 8601 end time'),
          duration_minutes: z.number().describe('Duration in minutes'),
        })
      )
      .optional(),
    totalSlots: z.number().optional().describe('Number of free slots found'),
    userCount: z.number().optional().describe('Number of users checked'),
    dateRange: z.string().optional().describe('Date range searched'),
    minDuration: z.string().optional().describe('Minimum duration filter'),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (executionContext) => {
    const { context } = executionContext;
    const userJwt = executionContext.runtimeContext?.get('jwt-token');

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required',
        freeSlots: [],
      };
    }

    if (!context.userIds || context.userIds.length === 0) {
      return {
        success: false,
        error: 'At least one user ID is required',
        freeSlots: [],
      };
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${userJwt}`,
          },
        },
      });

      // Get authenticated user's ID from runtime context
      const authenticatedUserId = executionContext.runtimeContext?.get('user-id');
      if (!authenticatedUserId) {
        return {
          success: false,
          error: 'User ID not found in context',
          freeSlots: [],
        };
      }

      // Automatically include authenticated user in the search
      // Remove duplicates if the authenticated user was already in the list
      const allUserIds = Array.from(new Set([authenticatedUserId, ...context.userIds]));

      // Get timezone from runtime context (sent by client)
      const userTimezone = executionContext.runtimeContext?.get('user-timezone') || 'UTC';

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

      // Use find_available_time_slots (same function as drag/drop)
      const { data: rawSlots, error: slotsError } = await supabase.rpc('find_available_time_slots', {
        target_user_ids: allUserIds,
        start_date: startDate,
        end_date: endDate,
        slot_duration_minutes: context.durationMinutes || 30,
        slot_increment_minutes: context.slotIncrementMinutes || 15,
        requesting_user_id: authenticatedUserId, // Use authenticated user for working hours
        user_timezone: userTimezone,
      });

      if (slotsError) {
        return {
          success: false,
          error: `Failed to find available time slots: ${slotsError.message}`,
          freeSlots: [],
        };
      }

      // Consolidate consecutive free slots into blocks
      const freeSlots: Array<{ start_time: string; end_time: string; duration_minutes: number }> =
        [];

      for (const slot of rawSlots || []) {
        if (!slot.all_users_free) continue; // Skip slots where not everyone is free

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

      const minDurationMin = context.durationMinutes || 30;
      return {
        success: true,
        freeSlots,
        totalSlots: freeSlots.length,
        userCount: allUserIds.length,
        dateRange: `${context.startDate} to ${context.endDate}`,
        minDuration: `${minDurationMin} minutes`,
        message: `Found ${freeSlots.length} time slot(s) when all ${allUserIds.length} user(s) are free for at least ${minDurationMin} minutes`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to find common free time: ${error.message}`,
        freeSlots: [],
      };
    }
  },
});
