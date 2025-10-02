import { Router } from "express";
import { supabaseAuth } from "../middleware/auth.js";
import { SupabaseStorage } from "../storage/supabase.js";

export const threadsRouter = Router();

/**
 * GET /api/threads
 * Get all threads for the authenticated user
 */
threadsRouter.get("/", supabaseAuth, async (req, res) => {
  const user = (req as any).user;
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { personaId } = req.query;

  const storage = new SupabaseStorage(authToken);

  try {
    const threads = await storage.getThreads(user.id, personaId as string | undefined);
    res.json({ threads });
  } catch (error) {
    console.error("Get threads error:", error);
    res.status(500).json({ error: "Failed to get threads" });
  }
});

/**
 * POST /api/threads
 * Create a new thread
 */
threadsRouter.post("/", supabaseAuth, async (req, res) => {
  const user = (req as any).user;
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { threadId, personaId, title, metadata = {} } = req.body;

  const storage = new SupabaseStorage(authToken);

  try {
    const thread = await storage.createThread({
      thread_id: threadId || undefined,
      user_id: user.id,
      persona_id: personaId,
      title,
      metadata,
    });

    res.status(201).json({ thread });
  } catch (error) {
    console.error("Create thread error:", error);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

/**
 * GET /api/threads/:threadId
 * Get a specific thread
 */
threadsRouter.get("/:threadId", supabaseAuth, async (req, res) => {
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { threadId } = req.params;

  const storage = new SupabaseStorage(authToken);

  try {
    const thread = await storage.getThread(threadId);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    res.json({ thread });
  } catch (error) {
    console.error("Get thread error:", error);
    res.status(500).json({ error: "Failed to get thread" });
  }
});

/**
 * PATCH /api/threads/:threadId
 * Update a thread
 */
threadsRouter.patch("/:threadId", supabaseAuth, async (req, res) => {
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { threadId } = req.params;
  const { title, metadata } = req.body;

  const storage = new SupabaseStorage(authToken);

  try {
    const thread = await storage.updateThread(threadId, { title, metadata });
    res.json({ thread });
  } catch (error) {
    console.error("Update thread error:", error);
    res.status(500).json({ error: "Failed to update thread" });
  }
});

/**
 * DELETE /api/threads/:threadId
 * Delete a thread and all its messages
 */
threadsRouter.delete("/:threadId", supabaseAuth, async (req, res) => {
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { threadId } = req.params;

  const storage = new SupabaseStorage(authToken);

  try {
    await storage.deleteThread(threadId);
    res.status(204).end();
  } catch (error) {
    console.error("Delete thread error:", error);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

/**
 * GET /api/threads/:threadId/messages
 * Get all messages in a thread
 */
threadsRouter.get("/:threadId/messages", supabaseAuth, async (req, res) => {
  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { threadId } = req.params;
  const { limit = "50" } = req.query;

  const storage = new SupabaseStorage(authToken);

  try {
    const messages = await storage.getMessages(threadId, parseInt(limit as string));
    res.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});
