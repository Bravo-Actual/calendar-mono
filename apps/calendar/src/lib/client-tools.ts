import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Client-side tool definition (no execute function)
// This provides the schema to the agent so it knows how to call the tool
export const aiCalendarHighlightsTool = createTool({
  id: "aiCalendarHighlights",
  description: `Manage AI calendar highlights with full CRUD operations for visual calendar annotations.

HIGHLIGHT TYPES:
- Event highlights: Yellow overlays on specific events (use type="events" with eventIds)
- Time highlights: Colored time blocks for focus periods, breaks, analysis (use type="time" with timeRanges)

OPERATION MODES:
1. Single operations: Use "action" parameter for simple operations
2. Batch operations: Use "operations" array for complex scenarios (recommended for multiple changes)

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
{
  "action": "read"  // All highlights
}
{
  "action": "read",
  "type": "events",  // Only event highlights
  "startDate": "2024-01-15T00:00:00Z",
  "endDate": "2024-01-16T23:59:59Z"  // Date range filter
}

✏️ UPDATE HIGHLIGHTS:
{
  "action": "update",
  "updates": [
    {
      "id": "highlight-123",
      "title": "Updated Title",
      "emoji": "⚡"
    }
  ]
}

🗑️ DELETE SPECIFIC HIGHLIGHTS:
{
  "action": "delete",
  "highlightIds": ["highlight-123", "highlight-456"]
}

🧹 CLEAR HIGHLIGHTS:
{
  "action": "clear"  // All highlights
}
{
  "action": "clear",
  "type": "time"  // Only time highlights
}

BEST PRACTICES:
- Always read existing highlights first to understand current state
- Use batch operations when making multiple related changes
- Provide meaningful titles and descriptions for context
- Use emojis to make highlights visually distinctive
- Remove outdated highlights before adding new ones`,
  inputSchema: z.object({
    // Single operation mode
    action: z.enum(["create", "read", "update", "delete", "clear"]).optional().describe("Single operation mode. Use 'create' to add new highlights, 'read' to query existing ones, 'update' to modify existing highlights, 'delete' to remove specific highlights, 'clear' to remove all or by type"),
    type: z.enum(["events", "time"]).optional().describe("Highlight type: 'events' for yellow overlays on specific calendar events, 'time' for colored blocks on time ranges"),

    // Create operations
    eventIds: z.array(z.string()).optional().describe("Array of calendar event IDs to highlight with yellow overlays. Get these from calendar context or getCalendarEvents tool. Use when type='events'"),
    timeRanges: z.array(z.object({
      start: z.string().describe("Start time in ISO format (e.g. '2024-01-15T09:00:00Z')"),
      end: z.string().describe("End time in ISO format (e.g. '2024-01-15T10:30:00Z')"),
      title: z.string().optional().describe("Title for this specific time range (e.g. 'Deep Work', 'Break Time')"),
      description: z.string().optional().describe("Description explaining why this time is highlighted"),
      emoji: z.string().optional().describe("Emoji to represent this time range (e.g. '🎯', '☕', '📞')")
    })).optional().describe("Array of time periods to highlight with colored blocks. Use when type='time'"),
    title: z.string().optional().describe("Default title applied to all highlights being created (e.g. 'Important Meetings', 'Focus Blocks')"),
    description: z.string().optional().describe("Default description applied to all highlights being created"),
    emoji: z.string().optional().describe("Default emoji applied to all highlights being created (e.g. '🔥', '⭐', '⚠️')"),

    // Read operations
    startDate: z.string().optional().describe("Filter highlights starting from this date (ISO format). Use to find highlights in specific time periods"),
    endDate: z.string().optional().describe("Filter highlights until this date (ISO format). Combine with startDate for date range queries"),
    highlightIds: z.array(z.string()).optional().describe("Specific highlight IDs to retrieve. Use when you know exact highlights to query"),

    // Update operations
    updates: z.array(z.object({
      id: z.string().describe("ID of the highlight to update (get from read operation)"),
      title: z.string().optional().describe("New title for the highlight"),
      message: z.string().optional().describe("New description/message for the highlight"),
      emoji: z.string().optional().describe("New emoji for the highlight"),
      visible: z.boolean().optional().describe("Whether highlight should be visible (true) or hidden (false)"),
      startTime: z.string().optional().describe("New start time (ISO format) - only for time highlights"),
      endTime: z.string().optional().describe("New end time (ISO format) - only for time highlights")
    })).optional().describe("Array of highlight modifications. Each update targets one highlight by ID"),

    // Batch operations mode
    operations: z.array(z.object({
      action: z.enum(["create", "update", "delete", "clear"]).describe("What this operation does: create new highlights, update existing ones, delete specific highlights, or clear by type"),
      type: z.enum(["events", "time"]).optional().describe("For create/clear operations: whether to work with event highlights or time highlights"),

      // Per-operation create fields
      eventIds: z.array(z.string()).optional().describe("Event IDs to highlight in this create operation"),
      timeRanges: z.array(z.object({
        start: z.string().describe("Start time in ISO format"),
        end: z.string().describe("End time in ISO format"),
        title: z.string().optional().describe("Title for this specific time range"),
        description: z.string().optional().describe("Description for this specific time range"),
        emoji: z.string().optional().describe("Emoji for this specific time range")
      })).optional().describe("Time ranges to highlight in this create operation"),
      title: z.string().optional().describe("Default title for all highlights created in this operation"),
      description: z.string().optional().describe("Default description for all highlights created in this operation"),
      emoji: z.string().optional().describe("Default emoji for all highlights created in this operation"),

      // Per-operation update/delete fields
      updates: z.array(z.object({
        id: z.string().describe("Highlight ID to update"),
        title: z.string().optional().describe("New title"),
        message: z.string().optional().describe("New message/description"),
        emoji: z.string().optional().describe("New emoji"),
        visible: z.boolean().optional().describe("New visibility setting"),
        startTime: z.string().optional().describe("New start time (ISO format)"),
        endTime: z.string().optional().describe("New end time (ISO format)")
      })).optional().describe("Highlight updates for this update operation"),
      highlightIds: z.array(z.string()).optional().describe("Highlight IDs to delete in this delete operation")
    })).optional().describe("BATCH MODE: Array of operations executed together. Perfect for complex scenarios like: 1) Delete old highlights, 2) Create new event highlights, 3) Add focus time blocks. Operations execute in sequence.")
  }),
  // NO execute function - this is a client-side tool
});

// Navigation tool for client-side calendar view changes
export const navigateCalendar = createTool({
  id: 'navigateCalendar',
  description: 'Navigate the user\'s calendar to display specific dates or time periods. IMPORTANT: Only navigate when the user is not already on a view that contains what you want to show them. Default to the same view type (work week, week, day, etc) that the user is already using when navigating unless you get permission to change it or MUST change it to complete your task. Use this tool to: 1) Show meetings you found for the user, 2) Navigate to time slots that would work for new or rescheduled meetings, 3) Display a specific date range when user asks to check their schedule. Works great when coupled with highlighting tools to draw attention to specific events or time ranges. Updates the client-side calendar view. Supports consecutive (date range, max 14 days) or non-consecutive (specific dates, max 14 dates) modes.',
  inputSchema: z.object({
    // Mode 1: Consecutive dates (date range)
    startDate: z.string().optional().describe('Start date in YYYY-MM-DD format for consecutive mode'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format for consecutive mode (max 14 days from start)'),

    // Mode 2: Non-consecutive dates (array of specific dates)
    dates: z.array(z.string()).optional().describe('Array of specific dates in YYYY-MM-DD format for non-consecutive mode (max 14 dates)'),

    timezone: z.string().optional().describe('Timezone for date calculations (defaults to user profile timezone)'),
  }),
  // NO execute function - this is a client-side tool
});