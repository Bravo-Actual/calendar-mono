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

  // Include persona name/identity and critical response guidelines
  systemParts.push(`You are ${persona.name}, an AI assistant for calendar and scheduling tasks.

** CRITICAL: SILENT TOOL EXECUTION **:
NEVER narrate, mention, or explain your tool usage to the user. Execute tools silently in the background.

❌ WRONG: "I'm tracking this down", "Let me save that", "I'm searching for that", "Hold on, I'm updating"
✅ CORRECT: [Just use the tool silently and respond with the result]

Examples:
User: "My dog's name is Max"
❌ WRONG: "Let me save that for you, hold on..." → "Okay, saved!"
✅ CORRECT: [uses save_user_memory silently] "Got it."

User: "Change my dog's name to Bruno"
❌ WRONG: "I'm tracking down your dog memory first... updating it now..."
✅ CORRECT: [uses save_user_memory silently] "Updated."

** TOOL USAGE GUIDELINES **:

1. NEVER EXPOSE SYSTEM IDs:
   - Don't mention UUIDs, database IDs, memory IDs, or other system identifiers to the user
   - Use friendly names, titles, descriptions instead
   - Tool responses may contain IDs for internal operations - ignore them in user-facing messages

2. MULTI-PART RESPONSES:
   - Within a single turn (one user prompt), never repeat information from earlier in that same turn
   - When responding to a NEW user prompt, you CAN reference previous conversation context

   Example - Single turn:
   User: "What's my name, email, and dog's name?"
   ✅ Part 1: "Your name is John Smith and your email is john@example.com. Let me check on that dog's name..."
   ✅ Part 2: "Your dog's name is Max." (only new info)
   ❌ Part 2: "Your name is John Smith, email is john@example.com, and your dog's name is Max." (repeated!)

** MEMORY MANAGEMENT **:

STEP 1 - SCAN EVERY USER MESSAGE:
Before responding, scan the user's message for ANY personal information. Common patterns include (but are not limited to):
- Names (pets, people, places): "my dog is Gabby", "my boss Sarah", "I live in Seattle"
- Quantities/Lists: "I have 4 dogs", "my dogs are named X, Y, Z"
- Preferences: "I prefer X", "I like X", "I don't like X"
- Constraints: "I'm unavailable X", "I can't X", "I don't work X"
- Habits: "I always X", "I usually X", "I typically X"
- Goals: "I want to X", "I'm trying to X"
- Work facts: "I work at X", "my team X", "I'm working on X"
- Any other facts about the user's life, work, or situation

STEP 2 - SAVE WHAT YOU FIND:
For EACH piece of personal information found, call save_user_memory BEFORE responding.

Examples:
User: "I have 4 dogs named Gabby, Bruno, Tonka, and Pepper"
→ Call save_user_memory(content="Has 4 dogs: Gabby, Bruno, Tonka, and Pepper", memory_type="personal_info")

User: "My office is in Seattle and I prefer morning meetings"
→ Call save_user_memory(content="Office location: Seattle", memory_type="personal_info")
→ Call save_user_memory(content="Prefers morning meetings", memory_type="preference")

The tool handles deduplication automatically - call it for every piece of information you identify.

Before searching for information, check conversation history and the CONTEXT/REMEMBERED INFORMATION sections below first.

Stay in character. Be concise.`);

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
      "YOU ARE ASSISTING:",
    ];

    // User identity information
    if (userProfile.display_name || userProfile.first_name || userProfile.last_name) {
      const name = userProfile.display_name ||
                   (userProfile.first_name && userProfile.last_name
                     ? `${userProfile.first_name} ${userProfile.last_name}`
                     : userProfile.first_name || userProfile.last_name);
      contextParts.push(`Name: ${name}`);
    }

    if (userProfile.email) {
      contextParts.push(`Email: ${userProfile.email}`);
    }

    if (userProfile.title) {
      contextParts.push(`Title: ${userProfile.title}`);
    }

    if (userProfile.organization) {
      contextParts.push(`Organization: ${userProfile.organization}`);
    }

    contextParts.push(""); // Blank line separator
    contextParts.push("TEMPORAL CONTEXT:");
    contextParts.push(`Today: ${now.toLocaleDateString("en-US", { timeZone: userProfile.timezone || "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
    contextParts.push(`Current Time: ${now.toISOString()} (ISO 8601)`);
    contextParts.push(`User Timezone: ${userProfile.timezone || "UTC"}`);
    contextParts.push(`Time Format Preference: ${userProfile.time_format === "12_hour" ? "12-hour" : "24-hour"}`);
    contextParts.push(`Week Start Day: ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parseInt(userProfile.week_start_day || "0")]}`);

    if (workPeriods && workPeriods.length > 0) {
      contextParts.push("");
      contextParts.push("WORK SCHEDULE:");
      contextParts.push(formatWorkPeriods(workPeriods));
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

  // Extract metadata (threadId, personaId, forceRefresh, etc.)
  const threadId = metadata?.threadId;
  const personaId = metadata?.personaId;
  const forceRefresh = metadata?.forceRefresh === true;

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
    console.log('[CHAT] Processing message for thread:', threadId);

    // Ensure thread exists
    let thread = await storage.getThread(threadId);
    if (!thread) {
      console.log('[CHAT] Creating new thread:', threadId);
      thread = await storage.createThread({
        thread_id: threadId,
        user_id: user.id,
        persona_id: personaId,
        title: messageText.slice(0, 50),
        metadata: {},
      });
    }
    console.log('[CHAT] Thread ready:', thread.id);

    // Load last 15 messages from conversation history
    const historyMessages = await storage.getMessages(threadId, 15);
    console.log('[CHAT] Loaded history:', historyMessages.length, 'messages');

    // Fetch user profile and work periods
    const userProfile = await storage.getUserProfile(user.id);
    const workPeriods = await storage.getWorkPeriods(user.id);
    console.log('[CHAT] User profile loaded');

    // Fetch persona to get instructions and create graph
    let systemMessage: SystemMessage | null = null;
    let persona = null;
    let memories: Memory[] = [];
    if (personaId) {
      persona = await storage.getPersona(personaId, forceRefresh);
      if (persona) {
        // Load memories for this user/persona combination
        memories = await storage.getMemories(user.id, personaId);
        systemMessage = buildSystemMessage(persona, userProfile, workPeriods, memories);
        console.log('[CHAT] Persona loaded:', persona.name, 'with', memories.length, 'memories', forceRefresh ? '(cache invalidated)' : '');
      }
    }

    // Create memory tools for this user/persona/thread
    const memoryTools = personaId ? createMemoryTools(storage, user.id, personaId, threadId) : [];
    console.log('[CHAT] Created', memoryTools.length, 'memory tools');

    // Create calendar and base tools with JWT for auth
    const { createTools } = await import("../utils/tools.js");
    const baseTools = createTools(authToken!);
    console.log('[CHAT] Created', baseTools.length, 'base tools');

    // Combine all tools
    const allTools = [...baseTools, ...memoryTools];
    console.log('[CHAT] Total tools:', allTools.length);
    console.log('[CHAT] Tool names:', allTools.map(t => t.name).join(', '));

    // Log tool descriptions for debugging
    if (forceRefresh) {
      console.log('\n[CHAT] Tool descriptions being sent to LLM:');
      allTools.forEach(tool => {
        console.log(`\n--- ${tool.name} ---`);
        console.log('Description:', tool.description);
        console.log('Schema:', JSON.stringify(tool.schema, null, 2).substring(0, 500));
      });
      console.log('\n');
    }

    // Create agent graph with persona-specific model configuration and all tools
    console.log('[CHAT] Creating agent graph...');
    const graph = createAgentGraph(persona ?? undefined, allTools);
    console.log('[CHAT] Agent graph created');

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
        try {
          console.log('[STREAM] Starting stream execution');

          // Generate text ID for this stream
          const textId = `text-${Date.now()}`;

          // Send text-start chunk
          writer.write({
            type: "text-start",
            id: textId,
          });
          console.log('[STREAM] Sent text-start chunk');

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
          console.log('[STREAM] Built input messages:', inputMessages.length, 'messages');

          // Execute LangGraph with streamEvents for token-level streaming
          console.log('[STREAM] Starting LangGraph streamEvents...');
          const eventStream = graph.streamEvents(
            {
              messages: inputMessages,
            },
            { version: "v2" }
          );
          console.log('[STREAM] Event stream created, waiting for events...');

          let assistantResponse = "";
          let eventCount = 0;

          for await (const event of eventStream) {
            eventCount++;
            if (eventCount === 1) {
              console.log('[STREAM] Received first event');
            }

            // Debug: log ALL event types to see what we're getting
            if (eventCount <= 5 || event.event.includes('chat')) {
              console.log(`[EVENT ${eventCount}] ${event.event}`);
            }

            // Log tool calls for debugging memory issues
            if (event.event === "on_tool_start") {
              console.log(`[TOOL START] ${event.name}:`, JSON.stringify(event.data?.input));
            }
            if (event.event === "on_tool_end") {
              console.log(`[TOOL END] ${event.name}:`, JSON.stringify(event.data?.output).substring(0, 200));
            }
            if (event.event === "on_tool_error") {
              console.error(`[TOOL ERROR] ${event.name}:`, (event.data as any)?.error);
            }

            // Stream token chunks from the LLM
            if (
              event.event === "on_chat_model_stream" &&
              event.data?.chunk?.content
            ) {
              const content = event.data.chunk.content;
              if (typeof content === "string" && content) {
                // Log suspicious output patterns
                if (content.length > 200 || content.includes('\\x')) {
                  console.warn('[STREAM WARNING] Suspicious content:', content.substring(0, 100));
                }

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
        } catch (streamError) {
          console.error('[STREAM ERROR]', streamError);
          throw streamError;
        }
      },
    });

    // Convert stream to Response using AI SDK helper
    const response = createUIMessageStreamResponse({ stream });

    // Pipe response to Express using AI SDK's built-in handling
    response.body?.pipeTo(
      new WritableStream({
        write(chunk) {
          res.write(chunk);
        },
        close() {
          console.log('[STREAM] Stream completed');
          res.end();
        },
        abort(err) {
          console.error('[STREAM ABORT]', err);
          res.end();
        },
      })
    ).catch(err => {
      console.error('[PIPE ERROR]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream failed' });
      }
    });
  } catch (error) {
    console.error("Stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
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

    // Create calendar and base tools with JWT for auth
    const { createTools } = await import("../utils/tools.js");
    const baseTools = createTools(authToken!);

    // Combine all tools
    const allTools = [...baseTools, ...memoryTools];

    // Create agent graph with persona-specific model configuration and all tools
    const graph = createAgentGraph(persona ?? undefined, allTools);

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
