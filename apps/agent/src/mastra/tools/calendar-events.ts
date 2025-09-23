import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../auth/jwt-storage';

export const getCurrentDateTime = createTool({
  id: 'getCurrentDateTime',
  description: 'Get the current date and time in ISO format. Use this when you need to know what time it is right now.',
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    const isoDateTime = now.toISOString();
    const localDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const localTime = now.toLocaleTimeString();

    return {
      success: true,
      currentDateTime: isoDateTime,
      currentDate: localDate,
      currentTime: localTime,
      timestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      message: `Current date and time: ${isoDateTime}`
    };
  },
});

export const getCalendarEvents = createTool({
  id: 'getCalendarEvents',
  description: 'Get calendar events for a date range',
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO format'),
    endDate: z.string().describe('End date in ISO format'),
    categoryId: z.string().optional().describe('Filter by category ID'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Getting calendar events:', context);

    const userJwt = executionContext.runtimeContext?.get('jwt-token');
    console.log('getCalendarEvents - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        events: []
      };
    }

    try {
      // Call Supabase edge function
      const supabaseUrl = process.env.SUPABASE_URL!;

      // Build query parameters
      const params = new URLSearchParams({
        startDate: context.startDate,
        endDate: context.endDate
      });

      if (context.categoryId) {
        params.append('categoryId', context.categoryId);
      }

      const url = `${supabaseUrl}/functions/v1/calendar-events?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userJwt}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error:', response.status, errorText);
        return {
          success: false,
          error: `Failed to fetch events: ${response.status} ${errorText}`,
          events: []
        };
      }

      const result = await response.json();

      return {
        success: result.success,
        events: result.events || [],
        message: result.message
      };
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return {
        success: false,
        error: `Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        events: []
      };
    }
  },
});

export const createCalendarEvent = createTool({
  id: 'createCalendarEvent',
  description: 'Create a new calendar event',
  inputSchema: z.object({
    title: z.string().describe('Event title'),
    startTime: z.string().describe('Start time in ISO format'),
    duration: z.number().describe('Duration in minutes'),
    allDay: z.boolean().optional().describe('Is this an all-day event'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Creating calendar event:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('createCalendarEvent - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found'
      };
    }

    // TODO: Implement calendar event creation in Supabase
    return {
      success: true,
      eventId: 'temp-id',
      message: 'Create calendar event tool - implementation pending'
    };
  },
});

export const updateCalendarEvent = createTool({
  id: 'updateCalendarEvent',
  description: 'Update an existing calendar event',
  inputSchema: z.object({
    eventId: z.string().describe('Event ID to update'),
    title: z.string().optional().describe('New event title'),
    startTime: z.string().optional().describe('New start time in ISO format'),
    duration: z.number().optional().describe('New duration in minutes'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Updating calendar event:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('updateCalendarEvent - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found'
      };
    }

    // TODO: Implement calendar event update in Supabase
    return {
      success: true,
      message: 'Update calendar event tool - implementation pending'
    };
  },
});

export const deleteCalendarEvent = createTool({
  id: 'deleteCalendarEvent',
  description: 'Delete a calendar event',
  inputSchema: z.object({
    eventId: z.string().describe('Event ID to delete'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Deleting calendar event:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('deleteCalendarEvent - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found'
      };
    }

    // TODO: Implement calendar event deletion in Supabase
    return {
      success: true,
      message: 'Delete calendar event tool - implementation pending'
    };
  },
});