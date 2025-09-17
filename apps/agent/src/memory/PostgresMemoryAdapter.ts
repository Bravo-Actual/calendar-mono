import { Pool } from "pg";

/**
 * PostgreSQL Memory Adapter for Mastra
 * Implements memory operations for conversation history, working memory, and directives
 */
export class PostgresMemoryAdapter {
  constructor(private pool: Pool) {}

  // ============================
  // Thread Management
  // ============================

  async createThread(input: {
    workspaceId: string;
    resourceType: string;
    resourceId: string;
    title?: string;
    metadata?: any;
    createdBy?: string;
  }) {
    const res = await this.pool.query(
      `INSERT INTO ai_memory_threads
       (workspace_id, resource_type, resource_id, title, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        input.workspaceId,
        input.resourceType,
        input.resourceId,
        input.title ?? null,
        input.metadata ?? {},
        input.createdBy ?? null,
      ],
    );
    return res.rows[0].id as string;
  }

  async getThreadById(threadId: string) {
    const t = await this.pool.query(
      `SELECT * FROM ai_memory_threads WHERE id = $1`,
      [threadId],
    );
    const m = await this.pool.query(
      `SELECT * FROM ai_memory_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId],
    );
    return { thread: t.rows[0], messages: m.rows };
  }

  async getThreadsByResourceId(
    workspaceId: string,
    resourceType: string,
    resourceId: string,
    limit = 20,
    offset = 0
  ) {
    const r = await this.pool.query(
      `SELECT * FROM ai_memory_threads
       WHERE workspace_id = $1 AND resource_type = $2 AND resource_id = $3
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [workspaceId, resourceType, resourceId, limit, offset],
    );
    return r.rows;
  }

  async deleteThread(threadId: string) {
    // Messages will be deleted automatically due to CASCADE
    await this.pool.query(
      `DELETE FROM ai_memory_threads WHERE id = $1`,
      [threadId],
    );
  }

  // ============================
  // Message Management
  // ============================

  async appendMessage(input: {
    threadId: string;
    role: "system" | "user" | "assistant" | "tool";
    content: any; // { text: string, ... } or complex content
    runId?: string;
    metadata?: any;
    tokens?: number;
  }) {
    await this.pool.query(
      `INSERT INTO ai_memory_messages
       (thread_id, role, content, run_id, metadata, tokens)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.threadId,
        input.role,
        input.content,
        input.runId ?? null,
        input.metadata ?? {},
        input.tokens ?? null,
      ],
    );
  }

  async getMessages(threadId: string, limit?: number) {
    const query = limit
      ? `SELECT * FROM ai_memory_messages
         WHERE thread_id = $1
         ORDER BY created_at DESC
         LIMIT $2`
      : `SELECT * FROM ai_memory_messages
         WHERE thread_id = $1
         ORDER BY created_at ASC`;

    const params = limit ? [threadId, limit] : [threadId];
    const result = await this.pool.query(query, params);

    // If we used LIMIT, reverse to get chronological order
    return limit ? result.rows.reverse() : result.rows;
  }

  async deleteMessages(threadId: string) {
    await this.pool.query(
      `DELETE FROM ai_memory_messages WHERE thread_id = $1`,
      [threadId],
    );
  }

  // ============================
  // Working Memory
  // ============================

  async upsertWorkingMemory(input: {
    workspaceId: string;
    threadId?: string | null;
    key: string;
    value: any;
    score?: number | null;
    ttlSeconds?: number | null;
  }) {
    const expiresAt =
      input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000) : null;

    await this.pool.query(
      `INSERT INTO ai_working_memory (workspace_id, thread_id, key, value, score, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (workspace_id, thread_id, key)
       DO UPDATE SET value = excluded.value,
                     score = excluded.score,
                     expires_at = excluded.expires_at,
                     updated_at = now()`,
      [
        input.workspaceId,
        input.threadId ?? null,
        input.key,
        input.value,
        input.score ?? null,
        expiresAt,
      ],
    );
  }

  async getWorkingMemory(workspaceId: string, threadId?: string | null) {
    const r = await this.pool.query(
      `SELECT * FROM ai_working_memory
       WHERE workspace_id = $1
         AND (thread_id IS DISTINCT FROM $2) IS FALSE
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY updated_at DESC`,
      [workspaceId, threadId ?? null],
    );
    return r.rows;
  }

  async deleteWorkingMemory(workspaceId: string, threadId?: string | null, key?: string) {
    if (key) {
      // Delete specific key
      await this.pool.query(
        `DELETE FROM ai_working_memory
         WHERE workspace_id = $1
           AND (thread_id IS DISTINCT FROM $2) IS FALSE
           AND key = $3`,
        [workspaceId, threadId ?? null, key],
      );
    } else {
      // Delete all for workspace/thread
      await this.pool.query(
        `DELETE FROM ai_working_memory
         WHERE workspace_id = $1
           AND (thread_id IS DISTINCT FROM $2) IS FALSE`,
        [workspaceId, threadId ?? null],
      );
    }
  }

  // ============================
  // AI Directives
  // ============================

  async upsertDirective(input: {
    workspaceId: string;
    userId?: string | null;
    key: string;
    value: any;
  }) {
    await this.pool.query(
      `INSERT INTO ai_directives (workspace_id, user_id, key, value)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (workspace_id, user_id, key)
       DO UPDATE SET value = excluded.value,
                     updated_at = now()`,
      [
        input.workspaceId,
        input.userId ?? null,
        input.key,
        input.value,
      ],
    );
  }

  async getDirectives(workspaceId: string, userId?: string | null) {
    const r = await this.pool.query(
      `SELECT * FROM ai_directives
       WHERE workspace_id = $1
         AND (user_id IS DISTINCT FROM $2) IS FALSE
       ORDER BY updated_at DESC`,
      [workspaceId, userId ?? null],
    );
    return r.rows;
  }

  async deleteDirective(workspaceId: string, userId?: string | null, key?: string) {
    if (key) {
      await this.pool.query(
        `DELETE FROM ai_directives
         WHERE workspace_id = $1
           AND (user_id IS DISTINCT FROM $2) IS FALSE
           AND key = $3`,
        [workspaceId, userId ?? null, key],
      );
    } else {
      await this.pool.query(
        `DELETE FROM ai_directives
         WHERE workspace_id = $1
           AND (user_id IS DISTINCT FROM $2) IS FALSE`,
        [workspaceId, userId ?? null],
      );
    }
  }

  // ============================
  // Workspace Management
  // ============================

  async createWorkspace(name: string) {
    const res = await this.pool.query(
      `INSERT INTO workspaces (name) VALUES ($1) RETURNING id`,
      [name],
    );
    return res.rows[0].id as string;
  }

  async getWorkspaces() {
    const res = await this.pool.query(
      `SELECT * FROM workspaces ORDER BY created_at DESC`,
    );
    return res.rows;
  }

  async getDefaultWorkspace() {
    const res = await this.pool.query(
      `SELECT * FROM workspaces ORDER BY created_at ASC LIMIT 1`,
    );
    return res.rows[0] || null;
  }

  // ============================
  // Utility Methods
  // ============================

  async cleanupExpiredMemory() {
    const result = await this.pool.query(
      `DELETE FROM ai_working_memory WHERE expires_at < now()`,
    );
    return result.rowCount || 0;
  }

  async getThreadStats(threadId: string) {
    const stats = await this.pool.query(
      `SELECT
         COUNT(*) as message_count,
         SUM(tokens) as total_tokens,
         MIN(created_at) as first_message,
         MAX(created_at) as last_message
       FROM ai_memory_messages
       WHERE thread_id = $1`,
      [threadId],
    );
    return stats.rows[0];
  }

  // Close the connection pool
  async disconnect() {
    await this.pool.end();
  }
}