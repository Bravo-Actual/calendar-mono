import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../auth/jwt-storage.js';

export const analyzeSchedule = createTool({
  id: 'analyzeSchedule',
  description: "Analyze the user's schedule for productivity insights",
  inputSchema: z.object({
    period: z.enum(['day', 'week', 'month']).describe('Time period to analyze'),
    startDate: z.string().optional().describe('Start date for analysis in ISO format'),
  }),
  execute: async (executionContext, _options) => {
    const { context } = executionContext;
    console.log('Analyzing schedule:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('analyzeSchedule - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        insights: [],
      };
    }

    // TODO: Implement schedule analysis and productivity insights
    return {
      success: true,
      insights: [],
      message: 'Analyze schedule tool - implementation pending',
    };
  },
});
