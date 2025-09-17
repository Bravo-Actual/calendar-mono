/**
 * Memory types for Mastra integration
 */

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface MemoryThread {
  id: string;
  workspace_id: string;
  created_by?: string;
  resource_type: string;
  resource_id: string;
  title?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface MemoryMessage {
  id: string;
  thread_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: Record<string, any>;
  tokens?: number;
  run_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WorkingMemoryItem {
  id: string;
  workspace_id: string;
  thread_id?: string;
  key: string;
  value: Record<string, any>;
  score?: number;
  expires_at?: string;
  updated_at: string;
}

export interface DirectiveItem {
  id: string;
  workspace_id: string;
  user_id?: string;
  key: string;
  value: Record<string, any>;
  updated_at: string;
}

export interface ThreadWithMessages {
  thread: MemoryThread;
  messages: MemoryMessage[];
}

export interface ThreadStats {
  message_count: number;
  total_tokens?: number;
  first_message?: string;
  last_message?: string;
}

// Configuration types
export interface MemoryConfig {
  connectionString: string;
  maxConnections?: number;
  ssl?: {
    rejectUnauthorized: boolean;
  };
}

// Input types for adapter methods
export interface CreateThreadInput {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  title?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface AppendMessageInput {
  threadId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: Record<string, any>;
  runId?: string;
  metadata?: Record<string, any>;
  tokens?: number;
}

export interface UpsertWorkingMemoryInput {
  workspaceId: string;
  threadId?: string | null;
  key: string;
  value: any;
  score?: number | null;
  ttlSeconds?: number | null;
}

export interface UpsertDirectiveInput {
  workspaceId: string;
  userId?: string | null;
  key: string;
  value: any;
}