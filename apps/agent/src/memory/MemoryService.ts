import { Pool } from 'pg';
import { PostgresMemoryAdapter } from './PostgresMemoryAdapter';
import type { MemoryConfig } from './types';

/**
 * Memory Service for Mastra integration
 * Provides high-level memory operations and configuration
 */
export class MemoryService {
  private adapter: PostgresMemoryAdapter;
  private pool: Pool;

  constructor(config: MemoryConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections || 20,
      ssl: config.ssl,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.adapter = new PostgresMemoryAdapter(this.pool);
  }

  // Expose the adapter for direct access if needed
  get memory() {
    return this.adapter;
  }

  // ============================
  // High-level Memory Operations for Agents
  // ============================

  /**
   * Initialize a conversation thread for an agent
   */
  async startAgentConversation(input: {
    agentId: string;
    userId?: string;
    title?: string;
    workspaceId?: string;
  }) {
    const workspaceId = input.workspaceId || (await this.getDefaultWorkspaceId());

    const threadId = await this.adapter.createThread({
      workspaceId,
      resourceType: 'agent',
      resourceId: input.agentId,
      title: input.title || `Conversation with ${input.agentId}`,
      createdBy: input.userId,
      metadata: {
        agentId: input.agentId,
        userId: input.userId,
      },
    });

    return threadId;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(input: {
    threadId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | Record<string, any>;
    tokens?: number;
    runId?: string;
  }) {
    // Normalize content to JSONB format
    const content = typeof input.content === 'string' ? { text: input.content } : input.content;

    await this.adapter.appendMessage({
      threadId: input.threadId,
      role: input.role,
      content,
      tokens: input.tokens,
      runId: input.runId,
    });
  }

  /**
   * Get conversation history for context building
   */
  async getConversationHistory(threadId: string, limit?: number) {
    const messages = await this.adapter.getMessages(threadId, limit);

    // Convert to Mastra-friendly format
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content.text || JSON.stringify(msg.content),
      timestamp: msg.created_at,
      tokens: msg.tokens,
    }));
  }

  /**
   * Store agent directive/rule
   */
  async setAgentDirective(input: {
    agentId: string;
    key: string;
    value: any;
    userId?: string;
    workspaceId?: string;
  }) {
    const workspaceId = input.workspaceId || (await this.getDefaultWorkspaceId());

    await this.adapter.upsertDirective({
      workspaceId,
      userId: input.userId,
      key: `agent:${input.agentId}:${input.key}`,
      value: input.value,
    });
  }

  /**
   * Get agent directives for context
   */
  async getAgentDirectives(input: { agentId: string; userId?: string; workspaceId?: string }) {
    const workspaceId = input.workspaceId || (await this.getDefaultWorkspaceId());

    const directives = await this.adapter.getDirectives(workspaceId, input.userId);

    // Filter for this agent and return as key-value pairs
    const agentPrefix = `agent:${input.agentId}:`;
    return directives
      .filter((d) => d.key.startsWith(agentPrefix))
      .reduce(
        (acc, d) => {
          const key = d.key.slice(agentPrefix.length);
          acc[key] = d.value;
          return acc;
        },
        {} as Record<string, any>
      );
  }

  /**
   * Store working memory for a conversation
   */
  async setWorkingMemory(input: {
    threadId: string;
    key: string;
    value: any;
    ttlSeconds?: number;
    workspaceId?: string;
  }) {
    const workspaceId = input.workspaceId || (await this.getDefaultWorkspaceId());

    await this.adapter.upsertWorkingMemory({
      workspaceId,
      threadId: input.threadId,
      key: input.key,
      value: input.value,
      ttlSeconds: input.ttlSeconds,
    });
  }

  /**
   * Get working memory for context building
   */
  async getWorkingMemory(input: { threadId: string; workspaceId?: string }) {
    const workspaceId = input.workspaceId || (await this.getDefaultWorkspaceId());

    const items = await this.adapter.getWorkingMemory(workspaceId, input.threadId);

    // Return as key-value pairs
    return items.reduce(
      (acc, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, any>
    );
  }

  /**
   * Build complete context for agent prompt
   */
  async buildAgentContext(input: {
    threadId: string;
    agentId: string;
    userId?: string;
    workspaceId?: string;
    messageLimit?: number;
  }) {
    const [history, directives, workingMemory] = await Promise.all([
      this.getConversationHistory(input.threadId, input.messageLimit || 20),
      this.getAgentDirectives({
        agentId: input.agentId,
        userId: input.userId,
        workspaceId: input.workspaceId,
      }),
      this.getWorkingMemory({
        threadId: input.threadId,
        workspaceId: input.workspaceId,
      }),
    ]);

    return {
      conversationHistory: history,
      directives,
      workingMemory,
    };
  }

  // ============================
  // Utility Methods
  // ============================

  private async getDefaultWorkspaceId(): Promise<string> {
    const workspace = await this.adapter.getDefaultWorkspace();
    if (!workspace) {
      throw new Error('No default workspace found. Please create a workspace first.');
    }
    return workspace.id;
  }

  /**
   * Cleanup expired working memory
   */
  async cleanup() {
    const deleted = await this.adapter.cleanupExpiredMemory();
    return { deletedItems: deleted };
  }

  /**
   * Get thread statistics
   */
  async getThreadStats(threadId: string) {
    return this.adapter.getThreadStats(threadId);
  }

  /**
   * Close all connections
   */
  async disconnect() {
    await this.adapter.disconnect();
  }
}
