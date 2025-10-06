/**
 * AI Client Tools Registry
 * Central registry for all client-side AI tools
 */

import { navigateToDateRangeHandler } from './handlers/navigate-to-date-range';
import { navigateToDatesHandler } from './handlers/navigate-to-dates';
import { navigateToEventHandler } from './handlers/navigate-to-event';
import { navigateToWeekHandler } from './handlers/navigate-to-week';
import { navigateToWorkWeekHandler } from './handlers/navigate-to-work-week';
import type { ClientToolCall, ToolHandler, ToolHandlerContext, ToolResult } from './types';

// Registry of available client-side tools
const TOOL_REGISTRY: Record<string, ToolHandler> = {
  navigateToEvent: navigateToEventHandler,
  navigateToWorkWeek: navigateToWorkWeekHandler,
  navigateToWeek: navigateToWeekHandler,
  navigateToDateRange: navigateToDateRangeHandler,
  navigateToDates: navigateToDatesHandler,
};

// List of client-side tool names
export const CLIENT_SIDE_TOOLS = Object.keys(TOOL_REGISTRY);

/**
 * Extract arguments from tool call, handling various possible property names
 */
export function extractToolArguments(toolCall: ClientToolCall): Record<string, unknown> | null {
  const toolCallWithArgs = toolCall as ClientToolCall & {
    args?: Record<string, unknown>;
    arguments?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    input?: Record<string, unknown>;
  };

  return (
    toolCallWithArgs.args ||
    toolCallWithArgs.arguments ||
    toolCallWithArgs.parameters ||
    toolCallWithArgs.input ||
    null
  );
}

/**
 * Execute a client-side tool
 */
export async function executeClientTool(
  toolCall: ClientToolCall,
  context: ToolHandlerContext
): Promise<ToolResult> {
  // Check if this is a client-side tool
  if (!CLIENT_SIDE_TOOLS.includes(toolCall.toolName)) {
    return {
      success: false,
      error: `Tool ${toolCall.toolName} is not a registered client-side tool`,
    };
  }

  // Extract arguments
  const args = extractToolArguments(toolCall);
  if (!args) {
    return {
      success: false,
      error: 'No arguments found in tool call',
    };
  }

  // Get the tool handler
  const handler = TOOL_REGISTRY[toolCall.toolName];
  if (!handler) {
    return {
      success: false,
      error: `No handler found for tool: ${toolCall.toolName}`,
    };
  }

  // Execute the tool
  return await handler.execute(args, context);
}

/**
 * Check if a tool name is a client-side tool
 */
export function isClientSideTool(toolName: string): boolean {
  return CLIENT_SIDE_TOOLS.includes(toolName);
}
