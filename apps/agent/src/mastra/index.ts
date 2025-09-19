import { Mastra } from '@mastra/core/mastra';
import type { RuntimeContext } from '@mastra/core/di';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { calendarAssistantAgent } from './agents/calendar-assistant-agent.js';
import { simpleTestAgent } from './agents/simple-test-agent.js';
import { mastraExampleDynamicAgent } from './agents/mastra-example-dynamic-agent.js';
import { webSearchMCPServer } from './mcp-servers/web-search-mcp.js';
import { calendarMCPServer } from './mcp-servers/calendar-mcp.js';
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, findFreeTime, suggestMeetingTimes, analyzeSchedule, webSearch } from './tools/index.js';
// JWT handling is now managed by MastraAuthSupabase

// Define runtime type for model selection and persona context
type Runtime = {
  'model-id': string;
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
    return true; // Allow all authenticated users
  },
  // Allow public access to documentation routes
  publicRoutes: ['/docs', '/openapi.json', '/api/docs']
});

console.log('Calendar Mastra Service Config:', {
  url: process.env.VITE_SUPABASE_URL,
  hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
  hasSigningSecret: !!process.env.SUPABASE_JWT_SECRET,
  appUrl: process.env.APP_URL || 'http://localhost:3010',
  agentUrl: process.env.AGENT_URL || 'http://localhost:3020'
});

export const mastra = new Mastra({
  agents: {
    dynamicPersonaAgent: calendarAssistantAgent,
    simpleTestAgent: simpleTestAgent,
    mastraExampleDynamicAgent: mastraExampleDynamicAgent,
  },
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


        await next();
      },

      // Note: JWT authentication is now handled by MastraAuthSupabase automatically

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

          if (contentType && contentType.includes('application/json')) {
            try {
              const body = await c.req.json();

              // Extract model ID from request body (preferred over header/query)
              if (body.modelId) {
                runtime.set('model-id', body.modelId as string);
                console.log(`Setting model from request body: ${body.modelId}`);
              }

              if (body.personaId) {
                runtime.set('persona-id', body.personaId as string);
              }

              // Extract persona data that client already fetched (to avoid redundant DB calls during streaming)
              if (body.personaName) {
                runtime.set('persona-name', body.personaName as string);
              }
              if (body.personaTraits) {
                runtime.set('persona-traits', body.personaTraits as string);
              }
              if (body.personaInstructions) {
                runtime.set('persona-instructions', body.personaInstructions as string);
              }
              if (body.personaTemperature) {
                runtime.set('persona-temperature', body.personaTemperature as number);
              }
              if (body.personaTopP) {
                runtime.set('persona-top-p', body.personaTopP as number);
              }

              // Extract memory parameters for agent calls (Mastra format)
              if (body.memory) {
                if (body.memory.resource) {
                  runtime.set('memory-resource', body.memory.resource as string);
                }
                if (body.memory.thread && body.memory.thread.id) {
                  runtime.set('memory-thread', body.memory.thread.id as string);
                }
              }
            } catch (bodyParseError) {
              // Only log actual parsing errors for JSON requests, not expected non-JSON requests
              console.log('❌ Unable to parse JSON request body:', bodyParseError instanceof Error ? bodyParseError.message : 'Unknown error');
            }
          }
          // Removed logging for non-JSON requests as this is expected behavior for GET/health checks
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