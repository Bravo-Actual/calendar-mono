import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../auth/jwt-storage.js';

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

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('getCalendarEvents - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        events: []
      };
    }

    // TODO: Implement calendar event fetching from Supabase
    return {
      success: true,
      events: [],
      message: 'Calendar events tool - implementation pending'
    };
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