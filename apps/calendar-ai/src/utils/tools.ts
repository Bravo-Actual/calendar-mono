import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentTime = new DynamicStructuredTool({
  name: "get_current_time",
  description: "Get the current time",
  schema: z.object({}),
  func: async () => {
    return new Date().toISOString();
  },
});

export const tools = [getCurrentTime];
