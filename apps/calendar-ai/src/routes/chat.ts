import { Router } from "express";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { createAgentGraph } from "../agent.js";
import { supabaseAuth } from "../middleware/auth.js";
import { SupabaseStorage, type Persona } from "../storage/supabase.js";

export const chatRouter = Router();

/**
 * Build system message from persona data
 */
function buildSystemMessage(persona: Persona): SystemMessage {
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

    // Fetch persona to get instructions and create graph
    let systemMessage: SystemMessage | null = null;
    let persona = null;
    if (personaId) {
      persona = await storage.getPersona(personaId);
      if (persona) {
        systemMessage = buildSystemMessage(persona);
      }
    }

    // Create agent graph with persona-specific model configuration
    const graph = createAgentGraph(persona ?? undefined);

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

    // Fetch persona to get instructions and create graph
    let systemMessage: SystemMessage | null = null;
    let persona = null;
    if (personaId) {
      persona = await storage.getPersona(personaId);
      if (persona) {
        systemMessage = buildSystemMessage(persona);
      }
    }

    // Create agent graph with persona-specific model configuration
    const graph = createAgentGraph(persona ?? undefined);

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
