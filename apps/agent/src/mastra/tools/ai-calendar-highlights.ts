import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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

🔄 BATCH OPERATIONS (RECOMMENDED FOR COMPLEX CHANGES):
{
  "operations": [
    {
      "action": "delete",
      "highlightIds": ["old-highlight-1"]
    },
    {
      "action": "create",
      "type": "events",
      "eventIds": ["important-meeting-1"],
      "title": "Urgent Review",
      "emoji": "🚨"
    },
    {
      "action": "create",
      "type": "time",
      "timeRanges": [{
        "start": "2024-01-15T14:00:00Z",
        "end": "2024-01-15T15:00:00Z",
        "title": "Preparation Time",
        "emoji": "📋"
      }]
    }
  ]
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
  execute: async ({ context }) => {
    // Server-side tool - returns instructions for the frontend to execute
    // The actual implementation happens on the frontend in ai-assistant-panel.tsx

    if (context.operations) {
      // Batch mode
      const operationSummary = context.operations.map(op => {
        switch (op.action) {
          case 'create':
            return `create ${op.type} highlights`;
          case 'update':
            return `update ${op.updates?.length || 0} highlights`;
          case 'delete':
            return `delete ${op.highlightIds?.length || 0} highlights`;
          case 'clear':
            return `clear ${op.type || 'all'} highlights`;
          default:
            return op.action;
        }
      }).join(', ');

      return {
        success: true,
        batch: true,
        operationsCount: context.operations.length,
        message: `Batch operation: ${operationSummary}`,
        type: "ai-highlight" as const
      };
    } else {
      // Single operation mode
      switch (context.action) {
        case 'create':
          const createCount = context.eventIds?.length || context.timeRanges?.length || 0;
          return {
            success: true,
            action: 'create',
            type: context.type,
            count: createCount,
            message: `Creating ${createCount} ${context.type} highlight${createCount === 1 ? '' : 's'}`,
            type: "ai-highlight" as const
          };
        case 'read':
          return {
            success: true,
            action: 'read',
            message: "Reading highlights",
            type: "ai-highlight" as const
          };
        case 'update':
          const updateCount = context.updates?.length || 0;
          return {
            success: true,
            action: 'update',
            count: updateCount,
            message: `Updating ${updateCount} highlight${updateCount === 1 ? '' : 's'}`,
            type: "ai-highlight" as const
          };
        case 'delete':
          const deleteCount = context.highlightIds?.length || 0;
          return {
            success: true,
            action: 'delete',
            count: deleteCount,
            message: `Deleting ${deleteCount} highlight${deleteCount === 1 ? '' : 's'}`,
            type: "ai-highlight" as const
          };
        case 'clear':
          return {
            success: true,
            action: 'clear',
            type: context.type || 'all',
            message: `Clearing ${context.type || 'all'} highlights`,
            type: "ai-highlight" as const
          };
        default:
          return {
            success: false,
            error: "Invalid action",
            type: "ai-highlight" as const
          };
      }
    }
  }
});