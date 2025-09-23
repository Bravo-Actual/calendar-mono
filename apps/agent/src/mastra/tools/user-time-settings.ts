import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getUserTimeSettingsTool = createTool({
  id: "getUserTimeSettings",
  description: "Get the user's time settings including timezone, time format (12/24 hour), and week start day.",
  inputSchema: z.object({}),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: "Authentication required"
      };
    }

    try {
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_profiles?select=timezone,time_format,week_start_day`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch time settings: ${response.statusText}`
        };
      }

      const profiles = await response.json();
      const profile = profiles[0];

      if (!profile) {
        return {
          success: false,
          error: "User profile not found"
        };
      }

      const settings = {
        timezone: profile.timezone || 'UTC',
        timeFormat: profile.time_format || '12_hour',
        weekStartDay: profile.week_start_day || '0' // 0 = Sunday
      };

      return {
        success: true,
        settings,
        message: `User time settings: ${settings.timezone}, ${settings.timeFormat} format, week starts on ${
          settings.weekStartDay === '0' ? 'Sunday' :
          settings.weekStartDay === '1' ? 'Monday' :
          settings.weekStartDay === '2' ? 'Tuesday' :
          settings.weekStartDay === '3' ? 'Wednesday' :
          settings.weekStartDay === '4' ? 'Thursday' :
          settings.weekStartDay === '5' ? 'Friday' : 'Saturday'
        }`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch time settings: ${error.message}`
      };
    }
  }
});

export const updateUserTimeSettingsTool = createTool({
  id: "updateUserTimeSettings",
  description: "Update the user's time settings. Can update timezone, time format (12_hour/24_hour), and/or week start day (0=Sunday, 1=Monday, etc.).",
  inputSchema: z.object({
    timezone: z.string().optional().describe("IANA timezone identifier (e.g., 'America/Chicago', 'Europe/London')"),
    timeFormat: z.enum(["12_hour", "24_hour"]).optional().describe("Time display format"),
    weekStartDay: z.enum(["0", "1", "2", "3", "4", "5", "6"]).optional().describe("Day week starts on (0=Sunday, 1=Monday, etc.)")
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: "Authentication required"
      };
    }

    const { timezone, timeFormat, weekStartDay } = executionContext.context;

    if (!timezone && !timeFormat && !weekStartDay) {
      return {
        success: false,
        error: "At least one setting must be provided to update"
      };
    }

    try {
      const updateData: any = {};
      if (timezone) updateData.timezone = timezone;
      if (timeFormat) updateData.time_format = timeFormat;
      if (weekStartDay) updateData.week_start_day = weekStartDay;

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_profiles`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to update time settings: ${response.statusText}`
        };
      }

      const updates = [];
      if (timezone) updates.push(`timezone to ${timezone}`);
      if (timeFormat) updates.push(`time format to ${timeFormat}`);
      if (weekStartDay) {
        const dayName = weekStartDay === '0' ? 'Sunday' :
                       weekStartDay === '1' ? 'Monday' :
                       weekStartDay === '2' ? 'Tuesday' :
                       weekStartDay === '3' ? 'Wednesday' :
                       weekStartDay === '4' ? 'Thursday' :
                       weekStartDay === '5' ? 'Friday' : 'Saturday';
        updates.push(`week start day to ${dayName}`);
      }

      return {
        success: true,
        message: `Updated ${updates.join(', ')}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update time settings: ${error.message}`
      };
    }
  }
});