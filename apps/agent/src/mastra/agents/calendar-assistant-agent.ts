// mastra/agents/calendar-assistant-agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { MODEL_MAP, getDefaultModel } from '../models.js';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  findFreeTime,
  navigateCalendar,
  getUserTimeSettingsTool,
  updateUserTimeSettingsTool,
  getUserCalendarsTool,
  createUserCalendarTool,
  updateUserCalendarTool,
  deleteUserCalendarTool,
  getUserCategoriesTool,
  createUserCategoryTool,
  updateUserCategoryTool,
  deleteUserCategoryTool
} from '../tools/index.js';
// aiCalendarHighlightsTool removed - handled client-side only
import { getEffectivePersona, buildPersonaInstructions, getPersonaTemperature } from '../auth/persona-manager.js';

// Commented out caching implementation - can be enabled later if needed
// const agentCache = new Map<string, { instructions: string; model: any; timestamp: number }>();
// const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Define runtime context type
type Runtime = {
  modelId: string;
  jwtToken: string;
  personaId: string;
  personaName: string;
  personaTraits: string;
  personaInstructions: string;
  personaTemperature: number;
  personaTopP: number;
  memoryResource: string;
  memoryThread: string;
};

export const calendarAssistantAgent = new Agent<'DynamicPersona', any, any, Runtime>({
  name: 'DynamicPersona', // This will be overridden by persona name
  defaultGenerateOptions: {
    maxSteps: 5, // Limit tool calls to prevent infinite loops
  },
  defaultStreamOptions: {
    maxSteps: 5, // Limit tool calls to prevent infinite loops
  },
  defaultVNextStreamOptions: {
    maxSteps: 5, // Limit tool calls to prevent infinite loops
  },
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
    }),
    options: {
      workingMemory: {
        enabled: false, // Disabled to prevent multiple LLM calls
        scope: 'resource', // Persist across all threads for the same user
        template: `# Calendar Assistant Memory

## User Preferences
- preferred_communication_style:
- timezone:
- work_hours:
- meeting_preferences:

## Current Context
- active_projects:
- focus_areas:
- upcoming_priorities:
- recent_scheduling_patterns:

## Calendar Insights
- busy_periods:
- free_time_patterns:
- meeting_frequency:
- calendar_goals:

## Task Tracking
- pending_requests:
- scheduled_items:
- follow_up_needed: `
      },
      threads: {
        generateTitle: true
      },
      lastMessages: 10
    }
  }),
  instructions: ({ runtimeContext }) => {
    // Use kebab-case keys that match the working version
    const personaName = runtimeContext.get('persona-name');
    const personaTraits = runtimeContext.get('persona-traits');
    const personaInstructions = runtimeContext.get('persona-instructions');
    const calendarContextJson = runtimeContext.get('calendar-context');

    // Debug logging
    console.log('🎭 Agent Instructions - Persona Data:', {
      personaName,
      personaTraits: personaTraits ? 'present' : 'missing',
      personaInstructions: personaInstructions ? 'present' : 'missing',
      calendarContext: calendarContextJson ? 'present' : 'missing'
    });


    // Parse calendar context if available and add to instructions
    let calendarContextInstructions = '';
    if (calendarContextJson) {
      try {
        const calendarContext = JSON.parse(calendarContextJson);
        calendarContextInstructions = `

CURRENT CALENDAR CONTEXT:
The user has provided their current calendar context:

Current View: ${calendarContext.currentView} view showing ${calendarContext.currentDate}
View Range: ${new Date(calendarContext.viewRange.start).toLocaleString()} to ${new Date(calendarContext.viewRange.end).toLocaleString()}

Visible Dates: ${calendarContext.viewDates.dates.join(', ')}

Selected Events:
${calendarContext.selectedEvents.events.length > 0
  ? calendarContext.selectedEvents.events.map(event => `- ${event.title} (${new Date(event.start_time_ms).toLocaleString()} - ${new Date(event.end_time_ms).toLocaleString()})`).join('\n')
  : 'No events currently selected'
}

Selected Time Ranges:
${calendarContext.selectedTimeRanges.ranges.length > 0
  ? calendarContext.selectedTimeRanges.ranges.map(range => `- ${new Date(range.start).toLocaleString()} - ${new Date(range.end).toLocaleString()}`).join('\n')
  : 'No time ranges currently selected'
}

When the user refers to "this event", "selected time", "these dates", etc., they likely mean the above context.
`;
      } catch (error) {
        console.warn('Failed to parse calendar context:', error);
      }
    }

    // Get timezone and datetime from runtime context (sent by client)
    const userTimezone = runtimeContext.get('user-timezone') as string || 'UTC';
    const userCurrentDateTime = runtimeContext.get('user-current-datetime') as string || new Date().toISOString();

    // Use runtime context values for date calculations
    const now = new Date(userCurrentDateTime);
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDateTime = userCurrentDateTime;
    const currentYear = now.getFullYear();

    // Define base functional instructions for calendar management
    const baseInstructions = `CONTEXT
========================================
Today: ${currentDate}
Current Time: ${currentDateTime} (ISO 8601)
User Timezone: ${userTimezone}
========================================

PLAN
1) Parse the user's request and identify the concrete goal (e.g., view, summarize, modify, or plan).
2) If essential info is missing, ask **one concise** clarifying question; otherwise proceed.
3) Think and use tools **silently**—do not narrate steps or internal reasoning.
4) Prefer **final-only** responses; keep interim updates to a minimum.
5) Calendar-specific rules:
   - Resolve relative dates ("today", "next week") from ${currentDate}.
   - When the user references selected items ("this event/time"), use exact IDs from calendar context; otherwise search by time/title.
   - For updates, only discuss names, dates, and times (never IDs/UUIDs). Batch updates as needed.
   - When suggesting times, propose 2–3 options in YYYY-MM-DD with local times and note conflicts.
   - Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ) for all tool calls involving dates/times.
6) Output style:
   - Default to short bullet points; use tables for multi-item schedules or comparisons.
   - Include absolute dates/times to avoid ambiguity.
   - Avoid filler, process narration, or speculative statements.
7) If blocked by missing data or permissions, state the issue plainly and provide the next actionable step.

TOOLS
You have access to:
- Event management (view, create, update, delete calendar events)
- Time analysis (find free slots, suggest meeting times)
- Calendar navigation (show specific dates/ranges - client-side)
- User settings (timezone, calendars, categories)

GUIDELINES
- Be concise and actionable.
- Avoid narrating internal reasoning or steps. Provide only relevant information and the final answer.
- Ask for missing details only when essential.${calendarContextInstructions}`;

    // Always prioritize persona identity if available
    if (personaName) {
      const personaIdentity = `You are ${personaName}. Always respond as this character following all instructions below.\n\n`;

      if (personaTraits || personaInstructions) {
        // Build minimal persona object from runtime context data
        const persona = {
          id: 'runtime-persona',
          user_id: 'runtime-user',
          persona_name: (typeof personaName === 'string' && personaName) ? personaName : 'Assistant',
          traits: personaTraits as string | undefined,
          instructions: personaInstructions as string | undefined,
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return personaIdentity + buildPersonaInstructions(persona, baseInstructions);
      } else {
        return personaIdentity + baseInstructions;
      }
    } else if (personaTraits || personaInstructions) {
      // Build minimal persona object from runtime context data
      const persona = {
        id: 'runtime-persona',
        user_id: 'runtime-user',
        persona_name: (typeof personaName === 'string' && personaName) ? personaName : 'Assistant',
        traits: personaTraits as string | undefined,
        instructions: personaInstructions as string | undefined,
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return buildPersonaInstructions(persona, baseInstructions);
    } else {
      return baseInstructions + calendarContextInstructions;
    }

    // Commented out async database implementation - can be enabled later if needed
    // try {
    //   const cacheKey = `${runtimeContext.get('jwt-token')?.slice(-8) || 'noauth'}_${runtimeContext.get('persona-id') || 'default'}`;
    //   if (agentCache.has(cacheKey)) {
    //     const cached = agentCache.get(cacheKey)!;
    //     if (Date.now() - cached.timestamp < CACHE_TTL) {
    //       return cached.instructions;
    //     }
    //   }
    //   const jwt = runtimeContext.get('jwt-token');
    //   const personaId = runtimeContext.get('persona-id');
    //   const persona = await getEffectivePersona(jwt, personaId);
    //   const instructions = persona ? buildPersonaInstructions(persona, baseInstructions) : baseInstructions;
    //   agentCache.set(cacheKey, { instructions, model: null, timestamp: Date.now() });
    //   return instructions;
    // } catch (error) {
    //   console.error('Error loading persona instructions:', error);
    //   return 'You are a helpful calendar assistant.';
    // }
  },
  model: ({ runtimeContext }) => {
    // Use kebab-case key that matches the working version
    const modelId = (runtimeContext.get('model-id') as string) || getDefaultModel(true);

    const modelFactory = MODEL_MAP[modelId];
    if (!modelFactory) {
      console.warn(`Model ${modelId} not found, falling back to default`);
      return MODEL_MAP[getDefaultModel(true)]();
    }

    // Get persona parameters from runtimeContext using kebab-case keys
    // Use temperature OR top_p (mutually exclusive)
    const temperature = runtimeContext.get('persona-temperature');
    const topP = runtimeContext.get('persona-top-p');

    const model = modelFactory();
    if (model && typeof model.withConfig === 'function') {
      const config: any = {};

      if (temperature !== undefined && temperature !== null) {
        config.temperature = temperature;
        console.log(`Using persona temperature: ${temperature}`);
      } else if (topP !== undefined && topP !== null) {
        config.top_p = topP;
        console.log(`Using persona top_p: ${topP}`);
      } else {
        // Default fallback
        config.temperature = 0.7;
        console.log(`Using default temperature: 0.7`);
      }

      return model.withConfig(config);
    }
    return model;

    // Commented out async database implementation - can be enabled later if needed
    // try {
    //   const cacheKey = `${runtimeContext.get('jwt-token')?.slice(-8) || 'noauth'}_${runtimeContext.get('persona-id') || 'default'}`;
    //   if (agentCache.has(cacheKey)) {
    //     const cached = agentCache.get(cacheKey)!;
    //     if (Date.now() - cached.timestamp < CACHE_TTL && cached.model) {
    //       return cached.model;
    //     }
    //   }
    //   const jwt = runtimeContext.get('jwt-token');
    //   const personaId = runtimeContext.get('persona-id');
    //   const persona = await getEffectivePersona(jwt, personaId);
    //   const temperature = getPersonaTemperature(persona);
    //   const model = modelFactory();
    //   const configuredModel = model && typeof model.withConfig === 'function' ? model.withConfig({ temperature }) : model;
    //   agentCache.set(cacheKey, { instructions: '', model: configuredModel, timestamp: Date.now() });
    //   return configuredModel;
    // } catch (error) {
    //   console.error('Error getting persona temperature:', error);
    //   return modelFactory();
    // }
  },
  tools: {
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    findFreeTime,
    navigateCalendar, // Client-side execution (Pattern B) - see apps/calendar/src/ai-client-tools/handlers/navigation.ts
    // aiCalendarHighlightsTool handled client-side only
    // User settings and configuration tools
    getUserTimeSettingsTool,
    updateUserTimeSettingsTool,
    getUserCalendarsTool,
    createUserCalendarTool,
    updateUserCalendarTool,
    deleteUserCalendarTool,
    getUserCategoriesTool,
    createUserCategoryTool,
    updateUserCategoryTool,
    deleteUserCategoryTool,
  },
});

