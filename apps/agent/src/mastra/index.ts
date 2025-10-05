import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { MastraSupabaseStore } from '../adapter/MastraSupabaseStore.js';
import { CalAgent } from './agents/cal-agent.js';
import { calendarAssistantAgent } from './agents/calendar-assistant-agent.js';
import { mastraExampleDynamicAgent } from './agents/mastra-example-dynamic-agent.js';
import { simpleTestAgent } from './agents/simple-test-agent.js';
import { calendarUserSettingsMCPServer } from './mcp-servers/calendar-user-settings-mcp.js';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  findFreeTime,
  getCalendarEvents,
  navigateCalendar,
  updateCalendarEvent,
} from './tools/index.js';

// JWT handling is now managed by MastraAuthSupabase

// Define runtime type for model selection and persona context
type Runtime = {
  'model-id': string;
  'jwt-token': string;
  'persona-id': string;
  'memory-resource': string;
  'memory-thread': string;
  'calendar-context': string;
};

// Global storage for built-in Memory API endpoints (uses service role but RLS enforces security)
// Note: Agents use their own per-request storage with JWT from runtimeContext
const globalStorage = new MastraSupabaseStore({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  mode: 'service',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

// Initialize Supabase auth with custom authorization
const auth = new MastraAuthSupabase({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  // Allow all authenticated users (not just admins)
  authorizeUser: async (_user: any) => {
    return true; // Allow all authenticated users
  },
});

console.log('Calendar Mastra Service Config:', {
  url: process.env.SUPABASE_URL,
  hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
  hasSigningSecret: !!process.env.SUPABASE_JWT_SECRET,
  appUrl: process.env.APP_URL || 'http://localhost:3010',
  agentUrl: process.env.AGENT_URL || 'http://localhost:3020',
});

export const mastra = new Mastra({
  agents: {
    dynamicPersonaAgent: calendarAssistantAgent,
    'cal-agent': CalAgent,
    simpleTestAgent: simpleTestAgent,
    mastraExampleDynamicAgent: mastraExampleDynamicAgent,
  },
  mcpServers: {
    calendarUserSettings: calendarUserSettingsMCPServer,
  },
  tools: {
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    findFreeTime,
    navigateCalendar,
  },
  // Global storage for Memory API endpoints (uses service role - bypasses RLS)
  // WARNING: Service role bypasses RLS. Mastra auth middleware validates user tokens.
  // Agents use their own per-request storage with JWT via runtimeContext for RLS enforcement.
  storage: globalStorage,
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
    apiRoutes: [
      // Simple login form for development/testing
      registerApiRoute('/login', {
        method: 'GET',
        handler: async (c) => {
          const redirectUrl = c.req.query('redirect') || '/playground';

          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Mastra Calendar - Login</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
                .form-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; }
                input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
                button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
                button:hover { background: #0056b3; }
                button:disabled { background: #ccc; cursor: not-allowed; }
                .error { color: red; margin-top: 10px; }
                .success { color: green; margin-top: 10px; }
                .info { color: #666; margin-top: 10px; font-size: 0.9em; }
              </style>
            </head>
            <body>
              <h2>Mastra Calendar Login</h2>
              <p class="info">Sign in to access the Playground</p>
              <form id="loginForm">
                <div class="form-group">
                  <label for="email">Email:</label>
                  <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                  <label for="password">Password:</label>
                  <input type="password" id="password" name="password" required>
                </div>
                <button type="submit" id="submitBtn">Login</button>
              </form>
              <div id="message"></div>

              <script>
                const redirectUrl = '${redirectUrl}';

                document.getElementById('loginForm').addEventListener('submit', async (e) => {
                  e.preventDefault();
                  const email = document.getElementById('email').value;
                  const password = document.getElementById('password').value;
                  const messageDiv = document.getElementById('message');
                  const submitBtn = document.getElementById('submitBtn');

                  submitBtn.disabled = true;
                  submitBtn.textContent = 'Logging in...';

                  try {
                    const response = await fetch('/auth/login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, password })
                    });

                    const result = await response.json();

                    if (response.ok) {
                      // Set cookie with JWT token
                      document.cookie = 'mastra_jwt=' + result.token + '; path=/; max-age=86400; SameSite=Lax';

                      // Also store in localStorage for client-side access
                      localStorage.setItem('mastra_jwt', result.token);

                      messageDiv.innerHTML = '<div class="success">Login successful! Redirecting...</div>';

                      // Redirect to the original destination
                      setTimeout(() => {
                        window.location.href = redirectUrl;
                      }, 500);
                    } else {
                      messageDiv.innerHTML = '<div class="error">Error: ' + result.error + '</div>';
                      submitBtn.disabled = false;
                      submitBtn.textContent = 'Login';
                    }
                  } catch (error) {
                    messageDiv.innerHTML = '<div class="error">Network error: ' + error.message + '</div>';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Login';
                  }
                });
              </script>
            </body>
            </html>
          `;

          return c.html(html);
        },
      }),

      // Login API endpoint
      registerApiRoute('/auth/login', {
        method: 'POST',
        handler: async (c) => {
          try {
            const { email, password } = await c.req.json();

            // Use Supabase client to authenticate
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_ANON_KEY!
            );

            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (error) {
              return c.json({ error: error.message }, 401);
            }

            if (!data.session?.access_token) {
              return c.json({ error: 'No access token received' }, 401);
            }

            return c.json({
              token: data.session.access_token,
              user: data.user,
            });
          } catch (_error) {
            return c.json({ error: 'Login failed' }, 500);
          }
        },
      }),
    ],
    middleware: [
      // Playground authentication middleware - redirect to login if no JWT
      async (c, next) => {
        const url = new URL(c.req.url);
        const path = url.pathname;

        // Check if this is the playground route
        if (path === '/playground' || path.startsWith('/playground/')) {
          // Check for JWT in Authorization header or cookie
          const authHeader = c.req.header('authorization');
          const cookieHeader = c.req.header('cookie');

          let hasValidAuth = false;

          // Check Authorization header
          if (authHeader?.startsWith('Bearer ')) {
            hasValidAuth = true;
          }

          // Check for mastra_jwt cookie
          if (!hasValidAuth && cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const jwtCookie = cookies.find(c => c.startsWith('mastra_jwt='));
            if (jwtCookie) {
              hasValidAuth = true;
            }
          }

          // Redirect to login if no valid authentication
          if (!hasValidAuth) {
            return c.redirect('/login?redirect=/playground');
          }
        }

        await next();
      },

      // Development mode logging
      async (c, next) => {
        const url = new URL(c.req.url);
        const _path = url.pathname;
        const _isDev = process.env.NODE_ENV === 'development';

        await next();
      },

      // Note: JWT authentication is now handled by MastraAuthSupabase automatically

      // JWT extraction middleware - extract JWT from header for tools to use
      async (c, next) => {
        const runtime = c.get('runtimeContext');

        // Extract JWT token from Authorization header for tools to use
        const authHeader = c.req.header('authorization');
        if (authHeader?.startsWith('Bearer ')) {
          const jwt = authHeader.substring(7); // Remove 'Bearer ' prefix
          runtime.set('jwt-token', jwt);
          console.log('JWT extracted and set in runtime context:', `${jwt.substring(0, 20)}...`);
        } else {
          console.log('No Authorization header found or invalid format');
        }

        await next();
      },

      // Model and persona selection middleware
      async (c, next) => {
        const runtime = c.get('runtimeContext');

        // Allow model selection via header or query param
        const modelFromHeader = c.req.header('x-mastra-model');
        const modelFromQuery = c.req.query('model');

        const modelId = modelFromHeader || modelFromQuery;

        if (modelId) {
          runtime.set('model-id', modelId as string);
        }

        // Extract persona ID and memory parameters from request body (for POST requests)
        try {
          const contentType = c.req.header('content-type');
          const _method = c.req.method;
          const _url = c.req.url;

          if (contentType?.includes('application/json')) {
            try {
              const body = await c.req.json();

              // Extract model ID from request body (preferred over header/query)
              if (body['model-id']) {
                runtime.set('model-id', body['model-id'] as string);
              }

              if (body['persona-id']) {
                runtime.set('persona-id', body['persona-id'] as string);
              }

              // Extract persona data that client already fetched (to avoid redundant DB calls during streaming)
              if (body['persona-name']) {
                runtime.set('persona-name', body['persona-name'] as string);
              }
              if (body['persona-traits']) {
                runtime.set('persona-traits', body['persona-traits'] as string);
              }
              if (body['persona-instructions']) {
                runtime.set('persona-instructions', body['persona-instructions'] as string);
              }
              if (body['persona-temperature']) {
                runtime.set('persona-temperature', body['persona-temperature'] as number);
              }
              if (body['persona-top-p']) {
                runtime.set('persona-top-p', body['persona-top-p'] as number);
              }

              // Extract memory parameters (Mastra 0.20 format)
              if (body.memory) {
                if (body.memory.thread?.id) {
                  runtime.set('threadId', body.memory.thread.id as string);
                }
              }

              // Extract calendar context if provided
              if (body.calendarContext) {
                runtime.set('calendar-context', JSON.stringify(body.calendarContext));
              }

              // Extract runtime context from AI SDK's sendExtraMessageFields data field
              if (body.data) {
                // Extract all data fields into runtime context
                for (const [key, value] of Object.entries(body.data)) {
                  runtime.set(key, value);
                }
              }
            } catch (_bodyParseError) {
              // JSON parsing failed - this is expected for some requests
            }
          }
          // Removed logging for non-JSON requests as this is expected behavior for GET/health checks
        } catch (_error) {
          // Request processing error - handled silently
        }

        await next();
      },
    ],
  },
});
