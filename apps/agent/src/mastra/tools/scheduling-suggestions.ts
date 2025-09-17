import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../auth/jwt-storage.js';

export const suggestMeetingTimes = createTool({
  id: 'suggestMeetingTimes',
  description: 'Suggest optimal meeting times based on calendar analysis',
  inputSchema: z.object({
    duration: z.number().describe('Meeting duration in minutes'),
    preferredTimeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']).optional().describe('Preferred time of day'),
    daysAhead: z.number().optional().describe('How many days ahead to look (default 7)'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Suggesting meeting times:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('suggestMeetingTimes - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        suggestions: []
      };
    }

    // TODO: Implement AI-powered meeting time suggestions
    return {
      success: true,
      suggestions: [],
      message: 'Suggest meeting times tool - implementation pending'
    };
  },
});