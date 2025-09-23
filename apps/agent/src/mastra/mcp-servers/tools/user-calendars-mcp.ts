import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getUserCalendarsMCP = createTool({
  id: "getUserCalendars",
  description: "Get all of the user's calendars with their properties (name, color, visibility, default status).",
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
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_calendars?select=*&order=created_at.asc`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch calendars: ${response.statusText}`
        };
      }

      const calendars = await response.json();

      return {
        success: true,
        calendars,
        count: calendars.length,
        message: `Found ${calendars.length} calendar${calendars.length === 1 ? '' : 's'}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch calendars: ${error.message}`
      };
    }
  }
});

export const createUserCalendarMCP = createTool({
  id: "createUserCalendar",
  description: "Create a new calendar for the user.",
  inputSchema: z.object({
    name: z.string().describe("Calendar name"),
    color: z.enum([
      "neutral", "slate", "orange", "yellow", "green",
      "blue", "indigo", "violet", "fuchsia", "rose"
    ]).optional().describe("Calendar color"),
    visible: z.boolean().optional().describe("Whether calendar is visible (default: true)")
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: "Authentication required"
      };
    }

    const { name, color, visible } = executionContext.context;

    if (!name?.trim()) {
      return {
        success: false,
        error: "Calendar name is required"
      };
    }

    try {
      const calendarData = {
        name: name.trim(),
        color: color || "blue",
        visible: visible !== false,
        is_default: false
      };

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_calendars`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(calendarData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to create calendar: ${response.statusText} - ${errorText}`
        };
      }

      const newCalendar = await response.json();

      return {
        success: true,
        calendar: newCalendar[0],
        message: `Created calendar "${name}"`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create calendar: ${error.message}`
      };
    }
  }
});

export const updateUserCalendarMCP = createTool({
  id: "updateUserCalendar",
  description: "Update an existing user calendar. Can modify name, color, or visibility.",
  inputSchema: z.object({
    calendarId: z.string().describe("ID of the calendar to update"),
    name: z.string().optional().describe("New calendar name"),
    color: z.enum([
      "neutral", "slate", "orange", "yellow", "green",
      "blue", "indigo", "violet", "fuchsia", "rose"
    ]).optional().describe("New calendar color"),
    visible: z.boolean().optional().describe("Whether calendar should be visible")
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return { success: false, error: "Authentication required" };
    }

    const { calendarId, name, color, visible } = executionContext.context;
    if (!calendarId) {
      return { success: false, error: "Calendar ID is required" };
    }
    if (!name && !color && visible === undefined) {
      return { success: false, error: "At least one field must be provided to update" };
    }

    try {
      const updateData: any = {};
      if (name?.trim()) updateData.name = name.trim();
      if (color) updateData.color = color;
      if (visible !== undefined) updateData.visible = visible;

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_calendars?id=eq.${calendarId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        return { success: false, error: `Failed to update calendar: ${response.statusText}` };
      }

      const updatedCalendar = await response.json();
      if (updatedCalendar.length === 0) {
        return { success: false, error: "Calendar not found or access denied" };
      }

      const updates: string[] = [];
      if (name) updates.push(`name to "${name}"`);
      if (color) updates.push(`color to ${color}`);
      if (visible !== undefined) updates.push(`visibility to ${visible ? 'visible' : 'hidden'}`);

      return {
        success: true,
        calendar: updatedCalendar[0],
        message: `Updated calendar: ${updates.join(', ')}`
      };
    } catch (error) {
      return { success: false, error: `Failed to update calendar: ${error.message}` };
    }
  }
});

export const deleteUserCalendarMCP = createTool({
  id: "deleteUserCalendar",
  description: "Delete a user calendar. Cannot delete the default calendar.",
  inputSchema: z.object({
    calendarId: z.string().describe("ID of the calendar to delete")
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return { success: false, error: "Authentication required" };
    }

    const { calendarId } = executionContext.context;
    if (!calendarId) {
      return { success: false, error: "Calendar ID is required" };
    }

    try {
      // Check if default calendar
      const checkResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_calendars?id=eq.${calendarId}&select=name,is_default`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        }
      });

      if (!checkResponse.ok) {
        return { success: false, error: `Failed to check calendar: ${checkResponse.statusText}` };
      }

      const calendars = await checkResponse.json();
      if (calendars.length === 0) {
        return { success: false, error: "Calendar not found or access denied" };
      }

      const calendar = calendars[0];
      if (calendar.is_default) {
        return { success: false, error: "Cannot delete the default calendar" };
      }

      // Delete calendar
      const deleteResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_calendars?id=eq.${calendarId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        }
      });

      if (!deleteResponse.ok) {
        return { success: false, error: `Failed to delete calendar: ${deleteResponse.statusText}` };
      }

      return { success: true, message: `Deleted calendar "${calendar.name}"` };
    } catch (error) {
      return { success: false, error: `Failed to delete calendar: ${error.message}` };
    }
  }
});