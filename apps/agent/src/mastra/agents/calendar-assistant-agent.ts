// mastra/agents/calendar-assistant-agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MODEL_MAP, getDefaultModel } from '../models.js';
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, findFreeTime, suggestMeetingTimes, analyzeSchedule, webSearch } from '../tools/index.js';
import { getEffectivePersona, buildPersonaInstructions, getPersonaTemperature } from '../auth/persona-manager.js';

// Commented out caching implementation - can be enabled later if needed
// const agentCache = new Map<string, { instructions: string; model: any; timestamp: number }>();
// const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Define runtime context type
type Runtime = {
  'model-id': string;
  'jwt-token': string;
  'persona-id': string;
  'persona-name': string;
  'persona-traits': string;
  'persona-instructions': string;
  'persona-temperature': number;
  'persona-top-p': number;
  'memory-resource': string;
  'memory-thread': string;
};

export const calendarAssistantAgent = new Agent<'DynamicPersona', any, any, Runtime>({
  name: 'DynamicPersona', // This will be overridden by persona name
  memory: async ({ runtimeContext }) => {
    const memoryResource = runtimeContext.get('memory-resource');
    const memoryThread = runtimeContext.get('memory-thread');
    const personaId = runtimeContext.get('persona-id');

    console.log('Creating Memory instance with runtime context:');
    console.log('- Memory resource:', memoryResource);
    console.log('- Memory thread:', memoryThread);
    console.log('- Persona ID:', personaId);

    // Use persona-specific resource ID so each agent remembers things about the user
    const resourceId = personaId ? `${memoryResource}-${personaId}` : memoryResource;

    return new Memory({
      // Storage will be inherited from the main Mastra PostgreSQL configuration
      resourceId: resourceId, // Persona-specific memory that persists across threads
      threadId: memoryThread, // Current conversation thread
      options: {
        workingMemory: {
          enabled: true,
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
    });
  },
  instructions: ({ runtimeContext }) => {
    // Use pre-fetched persona data from client request (no async DB calls during streaming)
    const personaName = runtimeContext.get('persona-name');
    const personaTraits = runtimeContext.get('persona-traits');
    const personaInstructions = runtimeContext.get('persona-instructions');

    // Define base functional instructions for calendar management
    const baseInstructions = `You are a calendar assistant with access to calendar management tools. You can:
- View, create, update, and delete calendar events
- Find free time slots in schedules
- Suggest optimal meeting times
- Analyze schedule patterns and workload
Always be accurate and don't make information up.`;

    if (personaName || personaTraits || personaInstructions) {
      console.log(`Using persona: ${personaName || 'Dynamic Persona'}`);
      // Build persona object from runtime context data
      const persona = {
        persona_name: personaName,
        traits: personaTraits,
        instructions: personaInstructions
      };
      return buildPersonaInstructions(persona, baseInstructions);
    } else {
      console.log('No persona data found, using fallback instructions');
      return baseInstructions;
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
    const modelId = runtimeContext.get('model-id') || getDefaultModel(true);
    console.log(`Using model: ${modelId}`);

    const modelFactory = MODEL_MAP[modelId];
    if (!modelFactory) {
      console.warn(`Model ${modelId} not found, falling back to default`);
      return MODEL_MAP[getDefaultModel(true)]();
    }

    // Get persona parameters from pre-fetched data (no async DB call)
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
    suggestMeetingTimes,
    analyzeSchedule,
    webSearch,
  },
});

