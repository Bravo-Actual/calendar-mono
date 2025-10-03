# AI Client Tools

Client-side tools that execute in the browser and interact with the calendar UI directly.

## Overview

Client tools are AI functions that run on the client side rather than on the server. They have direct access to:
- Zustand stores (app state, calendar state)
- React hooks and components
- Browser APIs
- Local storage

This allows the AI agent to perform UI actions like navigating the calendar, selecting events, and managing highlights without server round-trips.

## Architecture

```
Agent (server) → AI SDK useChat → onToolCall handler → Client Tool Registry → Tool Handler → App Store
```

1. **Server agent** declares client tools in its instructions (not in tools object)
2. **AI SDK** streams tool calls back to the client
3. **onToolCall handler** intercepts client-side tools
4. **Registry** routes to appropriate handler
5. **Handler** executes the action and updates app state
6. **Result** is sent back to AI SDK for the agent to see

## Available Tools

### `navigateCalendar`

Navigate the calendar to show specific dates or date ranges.

**Location:** `handlers/navigation.ts`

**Capabilities:**
- Navigate to single day
- Navigate to week (7 days)
- Navigate to work week (5 days)
- Navigate to custom date range (1-14 consecutive days)
- Navigate to specific non-consecutive dates (date array mode)
- Set timezone and week start day

**Parameters:**

```typescript
interface NavigationToolArgs {
  // Date array mode - specific dates (max 14)
  dates?: string[];

  // Date range mode - consecutive dates
  startDate?: string;
  endDate?: string; // Optional - if omitted, defaults to single day

  // View type hints
  viewType?: 'day' | 'week' | 'workweek' | 'custom-days' | 'dates';

  // Settings
  timezone?: string;
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday
}
```

**Examples:**

```json
// Single day
{
  "startDate": "2024-01-15"
}

// Week view (7 days)
{
  "startDate": "2024-01-15",
  "endDate": "2024-01-21"
}

// Work week (5 days)
{
  "startDate": "2024-01-15",
  "endDate": "2024-01-19",
  "viewType": "workweek"
}

// Custom date range (3 days)
{
  "startDate": "2024-01-15",
  "endDate": "2024-01-17"
}

// Specific dates (non-consecutive)
{
  "dates": ["2024-01-15", "2024-01-20", "2024-01-25"]
}

// Week view with timezone
{
  "startDate": "2024-01-15",
  "endDate": "2024-01-21",
  "timezone": "America/New_York",
  "weekStartDay": 1
}
```

**Smart Detection:**
- If `dates` array provided with consecutive dates → uses date range mode
- If `dates` array provided with non-consecutive dates → uses date array mode
- If `startDate` + `endDate` provided → auto-detects view type:
  - 1 day → day view
  - 5 days → workweek view
  - 7 days → week view
  - Other → custom-days view
- Explicit `viewType` parameter overrides auto-detection

**Returns:**

```typescript
{
  success: boolean;
  data?: {
    action: 'navigate';
    mode: 'dateRange' | 'dateArray';
    viewType?: 'day' | 'week' | 'workweek' | 'custom-days';
    startDate?: string;
    endDate?: string;
    dayCount?: number;
    dates?: string[];
    message: string;
  };
  error?: string;
}
```

## Adding New Client Tools

### 1. Create the handler

```typescript
// handlers/my-tool.ts
import type { ToolHandler, ToolHandlerContext, ToolResult } from '../types';

export const myToolHandler: ToolHandler = {
  async execute(
    args: Record<string, unknown>,
    context: ToolHandlerContext
  ): Promise<ToolResult> {
    try {
      // Your tool logic here
      // Access app store: useAppStore.getState()
      // Access user: context.user

      return {
        success: true,
        data: { /* result data */ }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};
```

### 2. Define types

```typescript
// types.ts
export interface MyToolArgs {
  param1: string;
  param2?: number;
}
```

### 3. Register in registry

```typescript
// registry.ts
import { myToolHandler } from './handlers/my-tool';

const TOOL_REGISTRY: Record<string, ToolHandler> = {
  navigateCalendar: navigationToolHandler,
  myTool: myToolHandler, // Add here
};
```

### 4. Export from index

```typescript
// index.ts
export { myToolHandler } from './handlers/my-tool';
```

### 5. Update agent instructions

In the LangGraph agent configuration (`apps/calendar-ai/src/agent.ts`):

```typescript
const systemPrompt = `
CLIENT-SIDE TOOLS (Handled by UI, not server):

1. navigateCalendar - ...
2. myTool - Your tool description
   TOOL ID: "myTool"
   PURPOSE: What it does

   USAGE:
   {
     "param1": "value",
     "param2": 123
   }
`;
```

## Testing Client Tools

### Manual Testing

1. Start dev servers: `pnpm dev`
2. Open AI assistant panel
3. Send a message that triggers the tool
4. Check browser console for tool execution logs
5. Verify the UI updates correctly

### Example Prompts

- "Show me next week" → navigates to week view
- "Navigate to January 15, 2024" → navigates to single day
- "Show me Monday, Wednesday, and Friday" → date array mode

## Best Practices

1. **Keep handlers pure** - No side effects beyond app store updates
2. **Validate inputs** - Always validate and sanitize arguments
3. **Return helpful messages** - Include user-friendly messages in results
4. **Handle errors gracefully** - Return `{success: false, error: "message"}`
5. **Use TypeScript** - Define proper types for arguments and results
6. **Document well** - Update this README and agent instructions
7. **Test thoroughly** - Both success and error cases

## Debugging

**Enable logging:**
```typescript
console.log('Tool called:', toolCall.toolName);
console.log('Arguments:', args);
console.log('Result:', result);
```

**Check AI SDK tool calls:**
Open React DevTools → Components → Search for "useChat" → Check messages array

**Verify tool registration:**
```typescript
import { CLIENT_SIDE_TOOLS } from '@/ai-client-tools';
console.log('Registered tools:', CLIENT_SIDE_TOOLS);
```

## Limitations

- **Max 14 days** - Calendar can only display up to 14 days at once
- **Date validation** - Only valid ISO 8601 dates accepted
- **No async UI updates** - Results are returned immediately, UI must update synchronously
- **No modal dialogs** - Client tools cannot show confirmation dialogs
- **No data fetching** - Use server tools for database queries

## Related Documentation

- [Calendar State Management](/apps/calendar/src/store/app.ts) - App store structure
- [LangGraph Agent](/apps/calendar-ai/src/agent.ts) - Agent configuration
- [AI SDK React](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot) - useChat documentation
