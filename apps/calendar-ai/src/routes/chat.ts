import { Router, type Router as ExpressRouter } from "express";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { createAgentGraph } from "../agent.js";
import { supabaseAuth } from "../middleware/auth.js";
import { SupabaseStorage, type Persona, type UserProfile, type WorkPeriod, type Memory } from "../storage/supabase.js";
import { createMemoryTools } from "../utils/memory-tools.js";

export const chatRouter: ExpressRouter = Router();

/**
 * Format work periods for display
 */
function formatWorkPeriods(periods: WorkPeriod[]): string {
  if (periods.length === 0) return "Not configured";

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const grouped = periods.reduce((acc, period) => {
    if (!acc[period.weekday]) acc[period.weekday] = [];
    acc[period.weekday].push(`${period.start_time}-${period.end_time}`);
    return acc;
  }, {} as Record<number, string[]>);

  const lines = ["Working Hours by Weekday:"];
  for (let i = 0; i < 7; i++) {
    const dayName = dayNames[i];
    const times = grouped[i];
    if (times && times.length > 0) {
      lines.push(`  • ${dayName}: ${times.join(", ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build system message from persona data and user context
 */
function buildSystemMessage(
  persona: Persona,
  userProfile?: UserProfile | null,
  workPeriods?: WorkPeriod[],
  memories?: Memory[]
): SystemMessage {
  const systemParts = [];

  // Include persona name/identity
  systemParts.push(`You are ${persona.name}, an AI assistant for calendar and scheduling tasks. ** Important**: Always reply in character speech and tone.`);

  // Include personality traits
  if (persona.traits) {
    systemParts.push(`Personality traits: ** IMPORTANT **: You must always respond in character. ${persona.traits}`);
  }

  // Include custom instructions
  if (persona.instructions) {
    systemParts.push(`Instructions: ${persona.instructions}`);
  }

  // Include user context
  if (userProfile) {
    const now = new Date();
    const contextParts = [
      "CONTEXT",
      "========================================",
      `Today: ${now.toLocaleDateString("en-US", { timeZone: userProfile.timezone || "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      `Current Time: ${now.toISOString()} (ISO 8601)`,
      `User Timezone (The user is viewing their calendar in this timezone): ${userProfile.timezone || "UTC"}`,
      `Time Format (The user prefers to see times in this format): ${userProfile.time_format === "12_hour" ? "12-hour" : "24-hour"}`,
      `Week Start Day (The user prefers to start their week on this day): ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parseInt(userProfile.week_start_day || "0")]}`,
    ];

    if (workPeriods && workPeriods.length > 0) {
      contextParts.push(`Work Schedule / Work Hours (This is the users weekly working schedule):\n${formatWorkPeriods(workPeriods)}`);
    }

    contextParts.push("========================================");
    systemParts.push(contextParts.join("\n"));
  }

  // Include only high-priority memories in system message (preferences, constraints)
  // Other memories can be dynamically searched using the search_user_memories tool
  if (memories && memories.length > 0) {
    // Filter to only critical memory types that should always be in context
    const criticalTypes = ["preference", "constraint"];
    const criticalMemories = memories.filter((m) => criticalTypes.includes(m.memory_type));

    if (criticalMemories.length > 0) {
      const memoryParts = [
        "REMEMBERED INFORMATION",
        "========================================",
        "Key preferences and constraints you must always consider:",
      ];

      // Group critical memories by type
      const grouped: Record<string, Memory[]> = {};
      for (const memory of criticalMemories) {
        if (!grouped[memory.memory_type]) grouped[memory.memory_type] = [];
        grouped[memory.memory_type].push(memory);
      }

      const typeLabels: Record<string, string> = {
        preference: "Preferences",
        constraint: "Constraints",
      };

      for (const [type, typeMemories] of Object.entries(grouped)) {
        memoryParts.push(`\n${typeLabels[type]}:`);
        for (const mem of typeMemories) {
          const parts = [`  • ${mem.content}`];
          if (mem.expires_at) {
            parts.push(` (expires ${new Date(mem.expires_at).toLocaleDateString()})`);
          }
          memoryParts.push(parts.join(""));
        }
      }

      memoryParts.push("========================================");
      memoryParts.push(
        "For other information (habits, goals, facts, personal info), use the search_user_memories tool to find relevant details on demand."
      );
      systemParts.push(memoryParts.join("\n"));
    }
  }

  return new SystemMessage(systemParts.join("\n\n"));
}

/**
 * POST /api/chat/stream
 * Stream AI responses using LangGraph + persist to Supabase
 * Accepts AI SDK UIMessage format
 */
chatRouter.post("/stream", supabaseAuth, async (req, res) => {
  const { messages, metadata } = req.body;
  const user = (req as any).user;
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Missing required field: messages (array)" });
    return;
  }

  // Extract metadata (threadId, personaId, etc.)
  const threadId = metadata?.threadId;
  const personaId = metadata?.personaId;

  if (!threadId) {
    res.status(400).json({ error: "Missing required field: metadata.threadId" });
    return;
  }

  // Extract text from last message (AI SDK UIMessage format)
  const lastMessage = messages[messages.length - 1];
  const messageText = lastMessage.parts
    ?.filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("") || "";

  if (!messageText) {
    res.status(400).json({ error: "No text content in message" });
    return;
  }

  const storage = new SupabaseStorage(authToken);

  try {
    // Ensure thread exists
    let thread = await storage.getThread(threadId);
    if (!thread) {
      thread = await storage.createThread({
        thread_id: threadId,
        user_id: user.id,
        persona_id: personaId,
        title: messageText.slice(0, 50),
        metadata: {},
      });
    }

    // Load last 15 messages from conversation history
    const historyMessages = await storage.getMessages(threadId, 15);

    // Fetch user profile and work periods
    const userProfile = await storage.getUserProfile(user.id);
    const workPeriods = await storage.getWorkPeriods(user.id);

    // Fetch persona to get instructions and create graph
    let systemMessage: SystemMessage | null = null;
    let persona = null;
    let memories: Memory[] = [];
    if (personaId) {
      persona = await storage.getPersona(personaId);
      if (persona) {
        // Load memories for this user/persona combination
        memories = await storage.getMemories(user.id, personaId);
        systemMessage = buildSystemMessage(persona, userProfile, workPeriods, memories);
      }
    }

    // Create memory tools for this user/persona/thread
    const memoryTools = personaId ? createMemoryTools(storage, user.id, personaId, threadId) : [];

    // Create agent graph with persona-specific model configuration and memory tools
    const graph = createAgentGraph(persona ?? undefined, memoryTools);

    // Save user message to database
    await storage.addMessage({
      thread_id: threadId,
      user_id: user.id,
      role: "user",
      content: { parts: [{ type: "text", text: messageText }] },
      metadata: {},
    });

    // Create AI SDK UIMessageStream
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Generate text ID for this stream
        const textId = `text-${Date.now()}`;

        // Send text-start chunk
        writer.write({
          type: "text-start",
          id: textId,
        });

        // Build messages array with conversation history
        const inputMessages = [];

        // Always add system message to maintain persona context
        if (systemMessage) {
          inputMessages.push(systemMessage);
        }

        // Add conversation history
        for (const msg of historyMessages) {
          const text = (msg.content as any)?.parts?.[0]?.text || "";
          if (msg.role === "user") {
            inputMessages.push(new HumanMessage(text));
          } else if (msg.role === "assistant") {
            inputMessages.push(new AIMessage(text));
          }
        }

        // Add current user message
        inputMessages.push(new HumanMessage(messageText));

        // Execute LangGraph with streamEvents for token-level streaming
        const eventStream = graph.streamEvents(
          {
            messages: inputMessages,
          },
          { version: "v2" }
        );

        let assistantResponse = "";

        for await (const event of eventStream) {
          // Stream token chunks from the LLM
          if (
            event.event === "on_chat_model_stream" &&
            event.data?.chunk?.content
          ) {
            const content = event.data.chunk.content;
            if (typeof content === "string" && content) {
              assistantResponse += content;

              // Send text-delta chunk (AI SDK v5 streaming protocol)
              writer.write({
                type: "text-delta",
                id: textId,
                delta: content,
              });
            }
          }
        }

        // Send text-end chunk
        writer.write({
          type: "text-end",
          id: textId,
        });

        // Save assistant message to database
        if (assistantResponse) {
          await storage.addMessage({
            thread_id: threadId,
            user_id: user.id,
            role: "assistant",
            content: { parts: [{ type: "text", text: assistantResponse }] },
            metadata: {},
          });
        }
      },
    });

    // Convert stream to Response using AI SDK helper
    const response = createUIMessageStreamResponse({ stream });

    // Pipe response to Express res
    response.body?.pipeTo(
      new WritableStream({
        write(chunk) {
          res.write(chunk);
        },
        close() {
          res.end();
        },
      })
    );
  } catch (error) {
    console.error("Stream error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * POST /api/chat/generate
 * Non-streaming version - returns complete response
 */
chatRouter.post("/generate", supabaseAuth, async (req, res) => {
  const { message, threadId, personaId } = req.body;
  const user = (req as any).user;
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!message || !threadId) {
    res.status(400).json({ error: "Missing required fields: message, threadId" });
    return;
  }

  const storage = new SupabaseStorage(authToken);

  try {
    // Ensure thread exists
    let thread = await storage.getThread(threadId);
    if (!thread) {
      thread = await storage.createThread({
        thread_id: threadId,
        user_id: user.id,
        persona_id: personaId,
        title: message.slice(0, 50),
        metadata: {},
      });
    }

    // Load last 15 messages from conversation history
    const historyMessages = await storage.getMessages(threadId, 15);

    // Fetch user profile and work periods
    const userProfile = await storage.getUserProfile(user.id);
    const workPeriods = await storage.getWorkPeriods(user.id);

    // Fetch persona to get instructions and create graph
    let systemMessage: SystemMessage | null = null;
    let persona = null;
    let memories: Memory[] = [];
    if (personaId) {
      persona = await storage.getPersona(personaId);
      if (persona) {
        // Load memories for this user/persona combination
        memories = await storage.getMemories(user.id, personaId);
        systemMessage = buildSystemMessage(persona, userProfile, workPeriods, memories);
      }
    }

    // Create memory tools for this user/persona/thread
    const memoryTools = personaId ? createMemoryTools(storage, user.id, personaId, threadId) : [];

    // Create agent graph with persona-specific model configuration and memory tools
    const graph = createAgentGraph(persona ?? undefined, memoryTools);

    // Save user message
    await storage.addMessage({
      thread_id: threadId,
      user_id: user.id,
      role: "user",
      content: { parts: [{ type: "text", text: message }] },
      metadata: {},
    });

    // Build messages array with conversation history
    const inputMessages = [];

    // Always add system message to maintain persona context
    if (systemMessage) {
      inputMessages.push(systemMessage);
    }

    // Add conversation history
    for (const msg of historyMessages) {
      const text = (msg.content as any)?.parts?.[0]?.text || "";
      if (msg.role === "user") {
        inputMessages.push(new HumanMessage(text));
      } else if (msg.role === "assistant") {
        inputMessages.push(new AIMessage(text));
      }
    }

    // Add current user message
    inputMessages.push(new HumanMessage(message));

    // Invoke LangGraph (non-streaming)
    const result = await graph.invoke({
      messages: inputMessages,
    });

    const resultMessages = result.messages as any[];
    const assistantMessage = resultMessages[resultMessages.length - 1];
    const content = assistantMessage.content;

    // Save assistant message
    await storage.addMessage({
      thread_id: threadId,
      user_id: user.id,
      role: "assistant",
      content: { parts: [{ type: "text", text: typeof content === "string" ? content : JSON.stringify(content) }] },
      metadata: {},
    });

    res.json({
      message: content,
      threadId,
    });
  } catch (error) {
    console.error("Generate error:", error);
    res.status(500).json({ error: "Generation failed" });
  }
});
