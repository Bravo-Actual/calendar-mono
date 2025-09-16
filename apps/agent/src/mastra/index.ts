import { Mastra } from '@mastra/core/mastra';
import type { RuntimeContext } from '@mastra/core/di';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
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
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Calendar-Mastra',
    level: 'info',
  }),
  server: {
    // experimental_auth: auth, // Disabled - implementing manual JWT extraction
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

        // Extract persona ID from request body (for POST requests)
        try {
          const contentType = c.req.header('content-type');
          if (contentType && contentType.includes('application/json')) {
            const body = await c.req.json();
            if (body.personaId) {
              console.log(`Setting persona ID from request: ${body.personaId}`);
              runtime.set('persona-id', body.personaId as string);
            }
            // Re-assign the body for downstream processing
            c.req = new Request(c.req.url, {
              method: c.req.method,
              headers: c.req.headers,
              body: JSON.stringify(body)
            });
          }
        } catch (error) {
          console.log('No JSON body found or error parsing body');
        }

        await next();
      },
    ],
  },
});