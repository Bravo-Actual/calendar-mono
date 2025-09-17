import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../auth/jwt-storage.js';

export const findFreeTime = createTool({
  id: 'findFreeTime',
  description: 'Find free time slots in the user\'s calendar',
  inputSchema: z.object({
    startDate: z.string().describe('Start date to search from in ISO format'),
    endDate: z.string().describe('End date to search until in ISO format'),
    durationMinutes: z.number().describe('Required duration in minutes'),
    workingHoursOnly: z.boolean().optional().describe('Only search during working hours'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Finding free time:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('findFreeTime - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        freeSlots: []
      };
    }

    // TODO: Implement free time analysis
    return {
      success: true,
      freeSlots: [],
      message: 'Find free time tool - implementation pending'
    };
  },
});