import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * CLIENT-SIDE TOOL (Pattern B)
 *
 * Navigate to display a specific event on the calendar.
 * Automatically selects appropriate view (work week or full week).
 */
export const navigateToEvent = createTool({
  id: 'navigateToEvent',
  description: `Navigate the calendar to display a specific event.

PURPOSE: Show the event in context - automatically displays work week (Mon-Fri) if event is during work week, or full week (Sun-Sat) if event is on weekend.

PARAMETERS:
- eventId: The UUID of the event to navigate to (required)

BEHAVIOR:
- Detects if event occurs during work week (Monday-Friday) or weekend
- Automatically selects appropriate view type
- Scrolls to event time
- Optionally selects the event for the user

USAGE:
- Use when user asks to "show me that meeting" or "go to the team sync"
- Use after creating an event to show it to the user
- Use when discussing a specific event by name/time`,
  inputSchema: z.object({
    eventId: z.string().uuid().describe('The UUID of the event to navigate to'),
  }),
  // NO execute function - this is handled client-side
});
