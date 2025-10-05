import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getClientToolsGuide = createTool({
  id: 'getClientToolsGuide',
  description:
    'Get detailed instructions on how to use client-side calendar tools for visual effects and navigation. Call this when you need to highlight events, highlight time ranges, or navigate the calendar view.',
  inputSchema: z.object({
    toolType: z
      .enum(['highlights', 'navigation', 'all'])
      .optional()
      .describe('Type of client tools to get guidance for'),
  }),
  execute: async ({ toolType = 'all' }) => {
    const highlightGuide = `
## aiCalendarHighlightsTool - Visual Calendar Annotations
**Purpose**: Create visual highlights on the calendar for AI analysis and user guidance

**Tool ID**: "aiCalendarHighlightsTool"

### HIGHLIGHT TYPES:
- **Event highlights**: Yellow overlays on specific events (use type="events" with eventIds)
- **Time highlights**: Colored time blocks for focus periods, breaks, analysis (use type="time" with timeRanges)

### COMMON USAGE PATTERNS:

**📅 CREATE EVENT HIGHLIGHTS:**
\`\`\`json
{
  "action": "create",
  "type": "events",
  "eventIds": ["event-123", "event-456"],
  "title": "Critical Meetings",
  "description": "Require extra preparation",
  "emoji": "🔥"
}
\`\`\`

**⏰ CREATE TIME HIGHLIGHTS:**
\`\`\`json
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
\`\`\`

**📖 READ HIGHLIGHTS:**
\`\`\`json
{"action": "read"}  // All highlights
{"action": "read", "type": "events"}  // Only event highlights
{"action": "read", "type": "events", "startDate": "2024-01-15T00:00:00Z", "endDate": "2024-01-16T23:59:59Z"}
\`\`\`

**🗑️ CLEAR HIGHLIGHTS:**
\`\`\`json
{"action": "clear"}  // All highlights
{"action": "clear", "type": "events"}  // Only event highlights
{"action": "clear", "type": "time"}  // Only time highlights
{"action": "delete", "highlightIds": ["highlight-123", "highlight-456"]}  // Specific highlights
\`\`\`

**BEST PRACTICES:**
- Always read existing highlights first to understand current state
- Use meaningful titles and descriptions for context
- Use emojis to make highlights visually distinctive
- Remove outdated highlights before adding new ones
`;

    const navigationGuide = `
## navigateCalendar - Calendar View Navigation
**Purpose**: Navigate the user's calendar to display specific dates or time periods

**Tool ID**: "navigateCalendar"

### USAGE GUIDELINES:
- Only navigate when user is NOT already viewing what you want to show
- Default to same view type (work week, week, day) unless permission given or required
- Use to: show meetings you found, navigate to available time slots, display requested date ranges
- Works great with highlights to draw attention to specific events/times

### EXAMPLES:
\`\`\`json
{"startDate": "2024-01-15", "endDate": "2024-01-21"}  // Date range (max 14 days)
{"dates": ["2024-01-15", "2024-01-20", "2024-01-25"]}  // Specific dates (max 14)
{"startDate": "2024-01-15", "timezone": "America/New_York"}  // With timezone
\`\`\`
`;

    if (toolType === 'highlights') {
      return { guide: highlightGuide };
    } else if (toolType === 'navigation') {
      return { guide: navigationGuide };
    } else {
      return {
        guide: `# CLIENT-SIDE TOOLS GUIDE\nThese tools are executed on the client-side and show visual results in the calendar interface:\n\n${highlightGuide}\n\n${navigationGuide}`,
      };
    }
  },
});
