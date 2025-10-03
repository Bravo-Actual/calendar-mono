import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createCalendarEventTools } from "./calendar-event-tools.js";

export const getCurrentTime = new DynamicStructuredTool({
  name: "get_current_time",
  description: "Get the current time",
  schema: z.object({}),
  func: async () => {
    return new Date().toISOString();
  },
});

/**
 * Create base tools (no auth required) + calendar tools (auth required)
 */
export function createTools(userJwt: string) {
  const calendarTools = createCalendarEventTools(userJwt);
  return [getCurrentTime, ...calendarTools];
}
