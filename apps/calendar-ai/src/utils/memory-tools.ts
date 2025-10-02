import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseStorage } from "../storage/supabase.js";

/**
 * Create memory management tools for a specific user/persona combination
 */
export function createMemoryTools(
  storage: SupabaseStorage,
  userId: string,
  personaId: string,
  threadId: string
) {
  const saveUserMemory = new DynamicStructuredTool({
    name: "save_user_memory",
    description: `Save an important fact or preference about the user for long-term recall. Use this when the user expresses:
- Personal preferences (e.g., "I prefer morning meetings")
- Important constraints (e.g., "I'm unavailable Fridays after 3pm")
- Habits or routines (e.g., "I always take lunch at 12:30")
- Personal information (e.g., "My birthday is June 15th")
- Goals or objectives (e.g., "I want to exercise 3 times per week")
- Significant facts that should be remembered across conversations

Only save information that is clearly stated by the user and would be useful for future scheduling or assistance.`,
    schema: z.object({
      content: z.string().describe("The fact or preference to remember (be specific and clear)"),
      memory_type: z
        .enum(["preference", "constraint", "habit", "personal_info", "goal", "fact"])
        .describe("Category: preference, constraint, habit, personal_info, goal, or fact"),
      importance: z
        .enum(["low", "normal", "high", "critical"])
        .default("normal")
        .describe("Priority level: low, normal, high, or critical"),
      expires_at: z
        .string()
        .optional()
        .describe("Optional ISO 8601 expiration date (e.g., '2025-12-31T23:59:59Z'). Omit for permanent memory."),
    }),
    func: async ({ content, memory_type, importance, expires_at }: { content: string; memory_type: string; importance?: string; expires_at?: string }) => {
      try {
        const memory = await storage.saveMemory({
          user_id: userId,
          persona_id: personaId,
          memory_type,
          content,
          importance: importance || "normal",
          expires_at: expires_at || null,
          source_thread_id: threadId,
          metadata: {},
        });

        return `Memory saved successfully (ID: ${memory.memory_id}). I'll remember: "${content}"`;
      } catch (error) {
        return `Failed to save memory: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });

  const recallMemories = new DynamicStructuredTool({
    name: "recall_memories",
    description: `Retrieve ALL stored memories of a specific type. Returns complete list (could be many).

NOTE: User preferences and constraints are already in your system message - you don't need to recall those unless checking for updates.

Use this when you need to see everything in a category (all habits, all goals, etc.). For finding specific information, use search_user_memories instead.`,
    schema: z.object({
      memory_type: z
        .enum(["preference", "constraint", "habit", "personal_info", "goal", "fact", "all"])
        .optional()
        .describe("Filter by type, or omit to see all memories"),
    }),
    func: async ({ memory_type }: { memory_type?: string }) => {
      try {
        let memories = await storage.getMemories(userId, personaId);

        // Filter by type if specified
        if (memory_type && memory_type !== "all") {
          memories = memories.filter((m) => m.memory_type === memory_type);
        }

        if (memories.length === 0) {
          return "No memories found.";
        }

        // Format memories for display
        const formatted = memories.map((m) => {
          const parts = [
            `[${m.memory_type.toUpperCase()}]`,
            m.content,
            `(Importance: ${m.importance})`,
          ];
          if (m.expires_at) {
            parts.push(`(Expires: ${new Date(m.expires_at).toLocaleDateString()})`);
          }
          return parts.join(" ");
        });

        return `Found ${memories.length} memories:\n${formatted.join("\n")}`;
      } catch (error) {
        return `Failed to recall memories: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });

  const updateUserMemory = new DynamicStructuredTool({
    name: "update_user_memory",
    description: `Update an existing memory. Use when the user corrects or updates previously stored information. You must know the memory_id to update it.`,
    schema: z.object({
      memory_id: z.string().describe("UUID of the memory to update"),
      content: z.string().optional().describe("Updated content"),
      importance: z.enum(["low", "normal", "high", "critical"]).optional().describe("Updated importance"),
      expires_at: z.string().optional().describe("Updated expiration date (ISO 8601) or null to make permanent"),
    }),
    func: async ({ memory_id, content, importance, expires_at }: { memory_id: string; content?: string; importance?: string; expires_at?: string }) => {
      try {
        const updates: {
          content?: string;
          importance?: string;
          expires_at?: string | null;
        } = {};
        if (content) updates.content = content;
        if (importance) updates.importance = importance;
        if (expires_at !== undefined) updates.expires_at = expires_at || null;

        await storage.updateMemory(memory_id, updates);
        return `Memory ${memory_id} updated successfully.`;
      } catch (error) {
        return `Failed to update memory: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });

  const deleteUserMemory = new DynamicStructuredTool({
    name: "delete_user_memory",
    description: `Delete a stored memory. Use when the user explicitly asks to forget something or when information becomes outdated. You must know the memory_id to delete it.`,
    schema: z.object({
      memory_id: z.string().describe("UUID of the memory to delete"),
    }),
    func: async ({ memory_id }: { memory_id: string }) => {
      try {
        await storage.deleteMemory(memory_id);
        return `Memory ${memory_id} deleted successfully.`;
      } catch (error) {
        return `Failed to delete memory: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });

  const searchUserMemories = new DynamicStructuredTool({
    name: "search_user_memories",
    description: `PRIMARY TOOL for finding specific information about the user. Uses semantic full-text search to find relevant memories.

This is MORE POWERFUL than recall_memories because it finds contextually relevant information across ALL memory types, ranked by relevance.

When to use: Anytime you need specific information (dog's name, favorite restaurant, meeting preferences, etc.)
Returns: Ranked results with memory IDs that you can use for updates/deletes

Examples:
- "dog" or "pet" → finds pet-related memories
- "meetings" → meeting preferences, constraints, habits
- "Friday" → Friday-specific schedules, preferences
- "morning" → morning routines and preferences`,
    schema: z.object({
      query: z.string().describe("Natural language search query (e.g., 'meeting preferences', 'Friday schedule')"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results to return (default: 10)"),
    }),
    func: async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        const results = await storage.searchMemories(userId, personaId, query, limit || 10);

        if (results.length === 0) {
          return `No memories found matching "${query}".`;
        }

        // Format results with relevance ranking
        const formatted = results.map((m, idx) => {
          const parts = [
            `${idx + 1}. [${m.memory_type.toUpperCase()}]`,
            m.content,
            `(Relevance: ${(m.rank * 100).toFixed(1)}%, Importance: ${m.importance})`,
          ];
          if (m.expires_at) {
            parts.push(`(Expires: ${new Date(m.expires_at).toLocaleDateString()})`);
          }
          parts.push(`[ID: ${m.memory_id}]`);
          return parts.join(" ");
        });

        return `Found ${results.length} memories matching "${query}":\n${formatted.join("\n")}`;
      } catch (error) {
        return `Failed to search memories: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });

  return [saveUserMemory, recallMemories, searchUserMemories, updateUserMemory, deleteUserMemory];
}
