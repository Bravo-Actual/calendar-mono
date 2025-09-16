import { Mastra } from '@mastra/core/mastra';
import type { RuntimeContext } from '@mastra/core/di';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { calendarAssistantAgent } from './agents/calendar-assistant-agent.js';
import { webSearchMCPServer } from './mcp-servers/web-search-mcp.js';
import { calendarMCPServer } from './mcp-servers/calendar-mcp.js';
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, findFreeTime, suggestMeetingTimes, analyzeSchedule, webSearch } from './tools/index.js';
import { setCurrentUserJwt, getCurrentUserJwt } from './auth/jwt-storage.js';

// Define runtime type for model selection and authentication
type Runtime = {
  'model-id': string;
  'jwt-token': string;
  'persona-id': string;
  'memory-resource': string;
  'memory-thread': string;
};

// Initialize Supabase auth with custom authorization
const auth = new MastraAuthSupabase({
  url: process.env.VITE_SUPABASE_URL!,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
  // Allow all authenticated users (not just admins)
  authorizeUser: async (user: any) => {
    console.log('Authorizing user:', user?.id, user?.email);
    return true; // Allow all authenticated users
  }
});

console.log('Calendar Mastra Service Config:', {
  url: process.env.VITE_SUPABASE_URL,
  hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
  hasSigningSecret: !!process.env.SUPABASE_JWT_SECRET,
  appUrl: process.env.APP_URL || 'http://localhost:3010',
  agentUrl: process.env.AGENT_URL || 'http://localhost:3020'
});

export const mastra = new Mastra({
  agents: { dynamicPersonaAgent: calendarAssistantAgent },
  mcpServers: {
    webSearchMCPServer,
    calendarMCPServer
  },
  tools: {
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    findFreeTime,
    suggestMeetingTimes,
    analyzeSchedule,
    webSearch
  },
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
  }),
  logger: new PinoLogger({
    name: 'Calendar-Mastra',
    level: 'info',
  }),
  server: {
    experimental_auth: auth, // Enabled for agent routing
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
    middleware: [
      // Development mode logging
      async (c, next) => {
        const url = new URL(c.req.url);
        const path = url.pathname;
        const isDev = process.env.NODE_ENV === 'development';

        if (isDev) {
          console.log('Calendar service - request:', path);
        }

        await next();
      },

      // JWT extraction middleware (per-user runtime context)
      async (c, next) => {
        const authHeader = c.req.header('authorization');
        const runtime = c.get<RuntimeContext<Runtime>>('runtimeContext');

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const jwt = authHeader.substring(7);
          runtime.set('jwt-token', jwt);
          console.log('JWT extracted and stored in runtime context:', !!jwt);
        } else {
          runtime.set('jwt-token', '');
          console.log('No Authorization header found');
        }

        await next();
      },

      // Model and persona selection middleware
      async (c, next) => {
        const runtime = c.get<RuntimeContext<Runtime>>('runtimeContext');

        // Allow model selection via header or query param
        const modelFromHeader = c.req.header('x-mastra-model');
        const modelFromQuery = c.req.query('model');

        const modelId = modelFromHeader || modelFromQuery;

        if (modelId) {
          console.log(`Setting model from request: ${modelId}`);
          runtime.set('model-id', modelId as string);
        }

        // Extract persona ID and memory parameters from request body (for POST requests)
        try {
          const contentType = c.req.header('content-type');
          const method = c.req.method;
          const url = c.req.url;
          console.log('🔍 Request details:', { method, contentType, url });

          if (contentType && contentType.includes('application/json')) {
            console.log('🔍 Attempting to parse JSON body...');
            try {
              const body = await c.req.json();
              console.log('🔍 Request body keys:', Object.keys(body));
              console.log('🔍 Full request body:', JSON.stringify(body, null, 2));

              if (body.personaId) {
                console.log(`Setting persona ID from request: ${body.personaId}`);
                runtime.set('persona-id', body.personaId as string);
              }

              // Extract memory parameters for agent calls
              if (body.memory) {
                console.log('✅ Memory parameters found:', body.memory);
                if (body.memory.resource) {
                  runtime.set('memory-resource', body.memory.resource as string);
                  console.log('✅ Set memory-resource:', body.memory.resource);
                }
                if (body.memory.thread) {
                  runtime.set('memory-thread', body.memory.thread as string);
                  console.log('✅ Set memory-thread:', body.memory.thread);
                }
              } else {
                console.log('❌ No memory object found in request body');
              }
            } catch (bodyParseError) {
              console.log('🔍 Unable to parse request body (likely empty):', bodyParseError instanceof Error ? bodyParseError.message : String(bodyParseError));
            }
          } else {
            console.log('❌ Content-type is not application/json, skipping body parsing');
          }
        } catch (error) {
          console.log('❌ Error parsing request body:', error);
          console.log('❌ Error type:', typeof error);
          console.log('❌ Error message:', error instanceof Error ? error.message : String(error));
        }

        await next();
      },
    ],
  },
});