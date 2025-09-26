// mastra/agents/calendar-assistant-agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { MODEL_MAP, getDefaultModel } from '../models.js';
import {
  getCalendarEvents,
  getCurrentDateTime,
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

    // Define base functional instructions for calendar management
    const baseInstructions = `You have access to calendar management tools and can:
- View, create, update, and delete calendar events
- Find free time slots in schedules with advanced filtering (minimum duration, work hours, timezone-aware)
- Suggest optimal meeting times based on actual availability
- Navigate calendar views using navigateCalendar tool to show specific dates or ranges (client-side)
- Manage AI calendar highlights with full CRUD operations using aiCalendarHighlightsTool (client-side)
- Create event highlights (yellow overlays on specific events) and time highlights (colored time blocks)
- Query existing highlights to understand current calendar annotations
- Perform batch highlight operations (e.g., remove old highlights while adding new ones in a single call)
- View and update user time settings (timezone, time format, week start day)
- View, create, update, and delete user calendars (but cannot change default calendar)
- View, create, update, and delete user categories (but cannot change default category)

IMPORTANT: When updating calendar events, always use the updateCalendarEvent tool with this exact format:
{
  "events": [
    {
      "id": "event-uuid-here",
      "title": "New Title",
      // ... other fields to update
    }
  ]
}
Never use legacy parameters like "eventId" or "title" at the root level. Always wrap event updates in the "events" array.

When working with events:
- If the user refers to events they have already selected, ALWAYS use the exact event IDs from the selectedEvents array in the calendar context
- For event updates/modifications, use the event IDs from the selectedEvents context when available
- You can find other events by time/title when the user refers to events they haven't specifically selected

CLIENT-SIDE TOOLS (Handled by UI, not server):
These tools are executed on the client-side and will show visual results in the calendar interface:

1. aiCalendarHighlightsTool - Visual Calendar Annotations
   TOOL ID: "aiCalendarHighlights"
   PURPOSE: Create visual highlights on the calendar for AI analysis and user guidance

   HIGHLIGHT TYPES:
   - Event highlights: Yellow overlays on specific events (use type="events" with eventIds)
   - Time highlights: Colored time blocks for focus periods, breaks, analysis (use type="time" with timeRanges)

   COMMON USAGE PATTERNS:

   📅 CREATE EVENT HIGHLIGHTS:
   {
     "action": "create",
     "type": "events",
     "eventIds": ["event-123", "event-456"],
     "title": "Critical Meetings",
     "description": "Require extra preparation",
     "emoji": "🔥"
   }

   ⏰ CREATE TIME HIGHLIGHTS:
   {
     "action": "create",
     "type": "time",
     "timeRanges": [
       {
         "start": "2024-01-15T09:00:00Z",
         "end": "2024-01-15T10:30:00Z",
         "title": "Deep Work",
         "description": "Focus time for project analysis",
         "emoji": "🎯"
       }
     ]
   }

   📖 READ HIGHLIGHTS:
   {"action": "read"}  // All highlights
   {"action": "read", "type": "events", "startDate": "2024-01-15T00:00:00Z", "endDate": "2024-01-16T23:59:59Z"}

   🗑️ CLEAR HIGHLIGHTS:
   {"action": "clear"}  // All highlights
   {"action": "clear", "type": "events"}  // Only event highlights
   {"action": "clear", "type": "time"}  // Only time highlights
   {"action": "delete", "highlightIds": ["highlight-123", "highlight-456"]}  // Specific highlights

2. navigateCalendar - Calendar View Navigation
   TOOL ID: "navigateCalendar"
   PURPOSE: Navigate the user's calendar to display specific dates or time periods

   USAGE GUIDELINES:
   - Only navigate when user is NOT already viewing what you want to show
   - Default to same view type (work week, week, day) unless permission given or required
   - Use to: show meetings you found, navigate to available time slots, display requested date ranges
   - Works great with highlights to draw attention to specific events/times

   EXAMPLES:
   {"startDate": "2024-01-15", "endDate": "2024-01-21"}  // Date range (max 14 days)
   {"dates": ["2024-01-15", "2024-01-20", "2024-01-25"]}  // Specific dates (max 14)
   {"startDate": "2024-01-15", "timezone": "America/New_York"}  // With timezone

Free Time Analysis Usage:
- Use findFreeTime tool to find available meeting slots in user's schedule
- Supports minimum duration filtering (e.g., 30, 60, 90 minutes)
- Automatically respects work hours (9 AM - 5 PM weekdays by default)
- Results include both ISO 8601 strings (start_time, end_time) and millisecond timestamps (start_time_ms, end_time_ms) for JavaScript compatibility
- Results are timezone-aware and filtered by actual availability
- Great for suggesting meeting times, finding focus blocks, or scheduling recommendations

Guidelines for conversations with the user:
- ** Important **: Do NOT describe your internal tool calling and actions. Provide final and relevant answers when you have completed your work.
- ** Important **: Do not use data IDs, GUIDs, UUID, or other technical details when discussing items with the user. Refer to things by name, date and time, or other descriptors in plain language.
- ** When there are longer lists of items, render them as lists or tables in markdown format.

Always be accurate and don't make information up.${calendarContextInstructions}`;

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
    getCurrentDateTime,
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    findFreeTime,
    // navigateCalendar handled client-side only
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

