/**
 * Types for AI client-side tools
 */

export interface ToolCallArguments {
  args?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

export interface ClientToolCall {
  toolName: string;
  toolCallId: string;
  args?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface ToolHandler {
  execute: (args: Record<string, unknown>, context: ToolHandlerContext) => Promise<ToolResult>;
}

export interface ToolHandlerContext {
  user?: { id: string };
  addToolResult: (result: { tool: string; toolCallId: string; output: ToolResult }) => void;
  // Add any other context needed by tools
  getEventTimes?: (eventId: string) => Promise<{ start_time: string; end_time: string }>;
}

// Specific tool argument types

export interface NavigationToolArgs {
  // Date array mode - specific dates (max 14)
  dates?: string[];

  // Date range mode - consecutive dates
  startDate?: string;
  endDate?: string; // Optional - if omitted, defaults to single day

  // View type hints
  viewType?: 'day' | 'week' | 'workweek' | 'custom-days' | 'dates'; // Explicit view type

  // Settings
  timezone?: string;
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday
}
