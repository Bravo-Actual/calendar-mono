// mastra/agents/calendar-assistant-agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MODEL_MAP, getDefaultModel } from '../models.js';
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, findFreeTime, suggestMeetingTimes, analyzeSchedule, webSearch } from '../tools/index.js';
import { getEffectivePersona, buildPersonaInstructions, getPersonaTemperature } from '../auth/persona-manager.js';

// Define runtime context type
type Runtime = {
  'model-id': string;
  'jwt-token': string;
  'persona-id': string;
  'memory-resource': string;
  'memory-thread': string;
};

export const calendarAssistantAgent = new Agent<'DynamicPersona', any, any, Runtime>({
  name: 'DynamicPersona', // This will be overridden by persona name
  memory: async ({ runtimeContext }) => {
    const memoryResource = runtimeContext.get('memory-resource');
    const memoryThread = runtimeContext.get('memory-thread');

    console.log('Creating Memory instance with runtime context:');
    console.log('- Memory resource:', memoryResource);
    console.log('- Memory thread:', memoryThread);

    return new Memory({
      // Storage will be inherited from the main Mastra PostgreSQL configuration
      resourceId: memoryResource,
      threadId: memoryThread,
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
  instructions: async ({ runtimeContext }) => {
    try {
      console.log('Loading dynamic persona for calendar user...');
      const jwt = runtimeContext.get('jwt-token');
      const personaId = runtimeContext.get('persona-id');
      console.log('JWT available in runtime context:', !!jwt);
      console.log('Persona ID from request:', personaId || '(none - will use default)');

      // Fetch the user's selected persona from database
      const persona = await getEffectivePersona(jwt, personaId);

      // Define base functional instructions for calendar management
      const baseInstructions = `You are a calendar assistant with access to calendar management tools. You can:
- View, create, update, and delete calendar events
- Find free time slots in schedules
- Suggest optimal meeting times
- Analyze schedule patterns and workload
Always be accurate and don't make information up.`;

      if (persona) {
        console.log(`Using persona: ${persona.persona_name}`);
        // Build complete persona-first instructions using name, traits, instructions
        return buildPersonaInstructions(persona, baseInstructions);
      } else {
        console.log('No persona found, using fallback instructions');
        return baseInstructions;
      }
    } catch (error) {
      console.error('Error loading persona instructions:', error);
      return 'You are a helpful calendar assistant.';
    }
  },
  model: async ({ runtimeContext }) => {
    const modelId = runtimeContext.get('model-id') || getDefaultModel(true);
    console.log(`Using model: ${modelId}`);

    const modelFactory = MODEL_MAP[modelId];
    if (!modelFactory) {
      console.warn(`Model ${modelId} not found, falling back to default`);
      return MODEL_MAP[getDefaultModel(true)]();
    }

    // Get persona temperature if available
    try {
      const jwt = runtimeContext.get('jwt-token');
      const personaId = runtimeContext.get('persona-id');
      const persona = await getEffectivePersona(jwt, personaId);
      const temperature = getPersonaTemperature(persona);
      console.log(`Using persona temperature: ${temperature}`);

      // Create model with persona temperature
      const model = modelFactory();
      if (model && typeof model.withConfig === 'function') {
        return model.withConfig({ temperature });
      }
      return model;
    } catch (error) {
      console.error('Error getting persona temperature:', error);
      return modelFactory();
    }
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

