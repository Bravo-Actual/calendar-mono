import { Router } from "express";
import { HumanMessage } from "@langchain/core/messages";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { graph } from "../agent.js";
import { supabaseAuth } from "../middleware/auth.js";
import { SupabaseStorage } from "../storage/supabase.js";

export const chatRouter = Router();

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

        // Execute LangGraph and stream response
        const langGraphStream = await graph.stream({
          messages: [new HumanMessage(messageText)],
        });

        let assistantResponse = "";

        for await (const chunk of langGraphStream) {
          // Extract content from LangGraph chunk
          if (chunk.agent?.messages) {
            const messages = Array.isArray(chunk.agent.messages)
              ? chunk.agent.messages
              : [chunk.agent.messages];

            for (const msg of messages) {
              if (msg.content) {
                const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
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

    // Save user message
    await storage.addMessage({
      thread_id: threadId,
      user_id: user.id,
      role: "user",
      content: { parts: [{ type: "text", text: message }] },
      metadata: {},
    });

    // Invoke LangGraph (non-streaming)
    const result = await graph.invoke({
      messages: [new HumanMessage(message)],
    });

    const messages = result.messages as any[];
    const assistantMessage = messages[messages.length - 1];
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
