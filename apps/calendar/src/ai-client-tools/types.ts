/**
 * Types for AI client-side tools
 */

export interface ToolCallArguments {
  args?: Record<string, unknown>
  arguments?: Record<string, unknown>
  parameters?: Record<string, unknown>
  input?: Record<string, unknown>
}

export interface ClientToolCall {
  toolName: string
  toolCallId: string
  args?: Record<string, unknown>
  arguments?: Record<string, unknown>
  parameters?: Record<string, unknown>
  input?: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  error?: string
  data?: Record<string, unknown>
}

export interface ToolHandler {
  execute: (args: Record<string, unknown>, context: ToolHandlerContext) => Promise<ToolResult>
}

export interface ToolHandlerContext {
  user?: { id: string }
  addToolResult: (result: { tool: string; toolCallId: string; output: ToolResult }) => void
  // Add any other context needed by tools
  createAnnotation?: any
  updateAnnotation?: any
  deleteAnnotation?: any
  userAnnotations?: any[]
  getEventTimes?: (eventId: string) => Promise<{ start_time: string; end_time: string }>
}

// Specific tool argument types
export interface HighlightToolArgs {
  operations?: Array<{
    action?: string
    type?: string
    eventIds?: string[]
    timeRanges?: Array<{
      start: string
      end: string
      title?: string
      description?: string
      emoji?: string
    }>
    highlightIds?: string[]
    title?: string
    description?: string
    emoji?: string
    updates?: Array<{
      id: string
      title?: string
      message?: string
      emoji?: string
      visible?: boolean
      startTime?: string
      endTime?: string
    }>
  }>
  action?: string
  type?: string
  eventIds?: string[]
  timeRanges?: Array<{
    start: string
    end: string
    title?: string
    description?: string
    emoji?: string
  }>
  highlightIds?: string[]
  title?: string
  description?: string
  emoji?: string
  updates?: Array<{
    id: string
    title?: string
    message?: string
    emoji?: string
    visible?: boolean
    startTime?: string
    endTime?: string
  }>
}

export interface NavigationToolArgs {
  dates?: string[]
  startDate?: string
  endDate?: string
  timezone?: string
}