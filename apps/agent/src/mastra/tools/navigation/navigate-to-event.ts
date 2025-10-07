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

PURPOSE: Navigates to a single event on the users calendar - automatically displays work week (Mon-Fri) if event is during work week, or full week (Sun-Sat) if event is on weekend.
IMPORTANT: This only changes the calendar view. This tool is intended to be used in conjunction with other tools to complete the user's request.

PARAMETERS:
- eventId: The UUID of the event to navigate to (required)

USAGE:
- To navigate to a single event. Do not use if you need to show multiple events - use other navigation tools to display multiple events within a week, range or array of dates.
- Use when user asks to "show me that meeting" or "go to the team sync"
- Use after creating an event to show it to the user
- Use when discussing a specific event by name/time`,
  inputSchema: z.object({
    eventId: z.string().uuid().describe('The UUID of the event to navigate to'),
  }),
  // NO execute function - this is handled client-side
});
