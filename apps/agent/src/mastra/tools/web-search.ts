import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJwtFromContext } from '../auth/jwt-storage.js';

export const webSearch = createTool({
  id: 'webSearch',
  description: 'Search the web for information to help with calendar and scheduling tasks',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().optional().describe('Maximum number of results (default 5)'),
  }),
  execute: async (executionContext, options) => {
    const { context } = executionContext;
    console.log('Web search:', context);

    const userJwt = getJwtFromContext({ runtimeContext: executionContext.runtimeContext });
    console.log('webSearch - JWT available:', !!userJwt);

    if (!userJwt) {
      return {
        success: false,
        error: 'Authentication required - no JWT token found',
        results: []
      };
    }

    // TODO: Implement web search functionality
    return {
      success: true,
      results: [],
      message: 'Web search tool - implementation pending'
    };
  },
});