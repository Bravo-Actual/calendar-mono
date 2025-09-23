import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const highlightTimeRangesTool = createTool({
  id: "highlightTimeRanges",
  description: "Highlight specific time ranges on the calendar to draw user attention. This creates yellow AI time highlights separate from user selections.",
  inputSchema: z.object({
    timeRanges: z.array(z.object({
      start: z.string().describe("ISO timestamp for start of AI highlight (e.g., \"2024-01-15T09:00:00.000Z\")"),
      end: z.string().describe("ISO timestamp for end of AI highlight (e.g., \"2024-01-15T10:00:00.000Z\")"),
      description: z.string().optional().describe("Context for this specific time range highlight")
    })).describe("Array of time ranges to highlight"),
    action: z.enum(["add", "replace", "clear"]).default("replace").describe("How to apply AI highlights: add to existing, replace all, or clear all"),
    description: z.string().optional().describe("Overall context for why these time ranges are highlighted")
  }),
  execute: async ({ context }) => {
    // Server-side tool - returns instructions for the frontend to execute
    const message = context.action === "clear"
      ? "Cleared all AI time range highlights"
      : `AI highlighted ${context.timeRanges.length} time range${context.timeRanges.length === 1 ? "" : "s"}${context.description ? `: ${context.description}` : ""}`;

    return {
      success: true,
      highlightedRanges: context.action === "clear" ? 0 : context.timeRanges.length,
      message,
      type: "ai-highlight" as const
    };
  }
});