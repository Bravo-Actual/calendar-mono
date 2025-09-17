import { MastraStorage } from '@mastra/core/storage';
import { PostgresMemoryAdapter } from './PostgresMemoryAdapter.js';
import type { MemoryConfig } from './types.js';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type { StorageGetMessagesArg, TABLE_NAMES, StorageColumn, StorageResourceType, PaginationInfo, EvalRow, PaginationArgs, StorageGetTracesArg, StorageGetTracesPaginatedArg, ThreadSortOptions } from '@mastra/core/storage';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/scores';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState, WorkflowRun, WorkflowRuns } from '@mastra/core/workflows';
import { Pool } from 'pg';

/**
 * Custom storage implementation that bridges our database tables to Mastra's Memory interface
 * This allows us to use our custom ai_memory_* tables with Mastra's memory system
 */
export class CustomMastraStorage extends MastraStorage {
  private adapter: PostgresMemoryAdapter;
  private pool: Pool;

  constructor(config: MemoryConfig) {
    super({ name: 'CustomMastraStorage' });
    console.log('🔥 CustomMastraStorage constructor called!', { config });
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections || 20,
      ssl: config.ssl,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.adapter = new PostgresMemoryAdapter(this.pool);
  }

  // Override abstract methods from MastraStorage
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    console.log('🔥 CustomMastraStorage.saveThread called!', { threadId: thread.id, resourceId: thread.resourceId });
    const threadId = await this.adapter.createThread({
      workspaceId: thread.workspaceId,
      resourceType: thread.resourceType || 'agent',
      resourceId: thread.resourceId,
      title: thread.title,
      metadata: thread.metadata || {},
      createdBy: thread.createdBy,
    });

    return {
      ...thread,
      id: threadId,
      createdAt: new Date(),
    };
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.adapter.getThread(threadId);
    if (!thread) return null;

    return {
      id: thread.id,
      workspaceId: thread.workspace_id,
      resourceType: thread.resource_type,
      resourceId: thread.resource_id,
      title: thread.title || 'Conversation',
      metadata: thread.metadata,
      createdBy: thread.created_by || undefined,
      createdAt: thread.created_at,
    };
  }

  // Message handling - implement the required saveMessages method
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(args: any): Promise<any> {
    console.log('🔥 CustomMastraStorage.saveMessages called!', { messageCount: args.messages?.length, format: args.format });
    const { messages, format } = args;
    const savedMessages = [];

    for (const message of messages) {
      // Normalize content to JSONB format
      const content = typeof message.content === 'string'
        ? { text: message.content }
        : message.content;

      await this.adapter.appendMessage({
        threadId: message.threadId,
        role: message.role,
        content,
        tokens: message.tokens,
        runId: message.runId,
      });

      savedMessages.push({
        ...message,
        id: message.id || `msg_${Date.now()}_${Math.random()}`,
        createdAt: message.createdAt || new Date(),
      });
    }

    return savedMessages;
  }

  // Implement overloaded getMessages methods
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const { threadId, last } = args;
    const messages = await this.adapter.getMessages(threadId, last);

    return messages.map(msg => ({
      id: msg.id,
      threadId: msg.thread_id,
      role: msg.role,
      content: msg.content,
      tokens: msg.tokens,
      runId: msg.run_id || undefined,
      createdAt: msg.created_at,
    }));
  }

  async getMessagesById({ messageIds, format }: { messageIds: string[]; format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    // For now, return empty array - can implement if needed
    return [];
  }

  async getThreadsByResourceId({ resourceId, orderBy, sortDirection }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    try {
      const workspaceId = await this.getDefaultWorkspaceId();
      const query = `
        SELECT * FROM ai_memory_threads
        WHERE workspace_id = $1 AND resource_id = $2
        ORDER BY created_at DESC
      `;

      const res = await this.pool.query(query, [workspaceId, resourceId]);

      return res.rows.map(thread => ({
        id: thread.id,
        workspaceId: thread.workspace_id,
        resourceType: thread.resource_type,
        resourceId: thread.resource_id,
        title: thread.title || 'Conversation',
        metadata: thread.metadata,
        createdBy: thread.created_by || undefined,
        createdAt: thread.created_at,
      }));
    } catch (error) {
      console.error('Error getting threads by resource ID:', error);
      return [];
    }
  }

  async getThreadsByResourceIdPaginated(args: { resourceId: string; page: number; perPage: number } & ThreadSortOptions): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const threads = await this.getThreadsByResourceId(args);
    return {
      threads,
      totalCount: threads.length,
      page: args.page,
      perPage: args.perPage,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  async getMessagesPaginated(args: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const messages = await this.getMessages(args);
    return {
      messages,
      totalCount: messages.length,
      page: 1,
      perPage: messages.length,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  async deleteThread(threadId: string) {
    try {
      await this.pool.query('DELETE FROM ai_memory_threads WHERE id = $1', [threadId]);
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  }

  async deleteMessage(messageId: string) {
    try {
      await this.pool.query('DELETE FROM ai_memory_messages WHERE id = $1', [messageId]);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }

  // Working memory methods
  async setWorkingMemory(threadId: string, key: string, value: any, ttlSeconds?: number) {
    const workspaceId = await this.getDefaultWorkspaceId();
    await this.adapter.upsertWorkingMemory({
      workspaceId,
      threadId,
      key,
      value,
      ttlSeconds,
    });
  }

  async getWorkingMemory(threadId: string) {
    const workspaceId = await this.getDefaultWorkspaceId();
    const items = await this.adapter.getWorkingMemory(workspaceId, threadId);

    return items.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);
  }

  // Helper methods
  private async getDefaultWorkspaceId(): Promise<string> {
    const workspace = await this.adapter.getDefaultWorkspace();
    if (!workspace) {
      throw new Error('No default workspace found. Please create a workspace first.');
    }
    return workspace.id;
  }

  async disconnect() {
    await this.adapter.disconnect();
  }

  // Required abstract methods from MastraStorage
  async updateThread({ id, title, metadata }: { id: string; title: string; metadata: Record<string, unknown> }): Promise<StorageThreadType> {
    await this.pool.query(
      'UPDATE ai_memory_threads SET title = $2, metadata = $3 WHERE id = $1',
      [id, title, JSON.stringify(metadata)]
    );

    const thread = await this.getThreadById({ threadId: id });
    if (!thread) throw new Error('Thread not found after update');
    return thread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.pool.query('DELETE FROM ai_memory_threads WHERE id = $1', [threadId]);
  }

  async updateMessages({ messages }: { messages: any[] }): Promise<MastraMessageV2[]> {
    // Placeholder implementation
    return [];
  }

  async createTable({ tableName, schema }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    // Our tables already exist, so this is a no-op
  }

  async alterTable({ tableName, schema, ifNotExists }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn>; ifNotExists: string[] }): Promise<void> {
    // Our tables already exist, so this is a no-op
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    // Implement if needed
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    // Implement if needed
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    // Implement if needed
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    // Implement if needed
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    // Implement if needed
    return null;
  }

  // Resource methods for working memory
  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      const res = await this.pool.query('SELECT * FROM ai_resources WHERE resource_id = $1', [resourceId]);
      if (res.rows.length === 0) return null;

      const row = res.rows[0];
      return {
        resourceId: row.resource_id,
        workingMemory: row.working_memory,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      return null;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.pool.query(`
      INSERT INTO ai_resources (resource_id, working_memory, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (resource_id) DO UPDATE SET
        working_memory = $2,
        metadata = $3,
        updated_at = NOW()
    `, [resource.resourceId, resource.workingMemory, JSON.stringify(resource.metadata)]);

    return resource;
  }

  async updateResource({ resourceId, workingMemory, metadata }: { resourceId: string; workingMemory?: string; metadata?: Record<string, unknown> }): Promise<StorageResourceType> {
    await this.pool.query(`
      INSERT INTO ai_resources (resource_id, working_memory, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (resource_id) DO UPDATE SET
        working_memory = COALESCE($2, ai_resources.working_memory),
        metadata = COALESCE($3, ai_resources.metadata),
        updated_at = NOW()
    `, [resourceId, workingMemory, metadata ? JSON.stringify(metadata) : null]);

    const resource = await this.getResourceById({ resourceId });
    if (!resource) throw new Error('Resource not found after update');
    return resource;
  }

  // Placeholder implementations for other abstract methods
  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> { return []; }
  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    return { traces: [], totalCount: 0, page: 1, perPage: 10, hasNextPage: false, hasPreviousPage: false };
  }
  async updateWorkflowResults(args: any): Promise<any> { return {}; }
  async updateWorkflowState(args: any): Promise<any> { return undefined; }
  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> { return null; }
  async saveScore(score: ValidatedSaveScorePayload): Promise<{ score: ScoreRowData }> { throw new Error('Not implemented'); }
  async getScoresByScorerId(args: any): Promise<any> { return { pagination: {}, scores: [] }; }
  async getScoresByRunId(args: any): Promise<any> { return { pagination: {}, scores: [] }; }
  async getScoresByEntityId(args: any): Promise<any> { return { pagination: {}, scores: [] }; }
  async getEvals(options: any): Promise<any> { return { evals: [], totalCount: 0, page: 1, perPage: 10 }; }
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> { return []; }
  async getWorkflowRuns(args?: any): Promise<WorkflowRuns> { return { runs: [], totalCount: 0 }; }
  async getWorkflowRunById(args: any): Promise<WorkflowRun | null> { return null; }
}