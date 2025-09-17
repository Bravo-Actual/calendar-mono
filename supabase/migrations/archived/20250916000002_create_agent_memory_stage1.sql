-- Agent Memory Stage 1: Basic Tables
-- Creates minimal tables for threads, messages, working memory, and directives

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pgvector will be added in Stage 3 for semantic recall

-- Workspaces table (tenant isolation)
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Memory Threads: conversation sessions (agent <-> user)
CREATE TABLE IF NOT EXISTS ai_memory_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NULL, -- references auth.users(id) via RLS
  resource_type TEXT NOT NULL DEFAULT 'agent', -- 'agent', 'user', 'workflow'
  resource_id TEXT NOT NULL, -- agent id / user id / workflow id
  title TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Memory Messages: chronological chat items inside a thread
CREATE TABLE IF NOT EXISTS ai_memory_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES ai_memory_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content JSONB NOT NULL, -- { text, parts, toolCalls, etc. }
  tokens INT NULL,
  run_id TEXT NULL, -- correlate to Mastra run if needed
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Working Memory: short-term key/value scoped to a thread or workspace
CREATE TABLE IF NOT EXISTS ai_working_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id UUID NULL REFERENCES ai_memory_threads(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  score REAL NULL, -- importance/recency score
  expires_at TIMESTAMPTZ NULL, -- TTL for ephemeral items
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, thread_id, key)
);

-- AI Directives: persistent instructions and guidelines for agents
CREATE TABLE IF NOT EXISTS ai_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NULL, -- Supabase auth user id
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_memory_threads_workspace ON ai_memory_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_threads_resource ON ai_memory_threads(workspace_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_threads_created_by ON ai_memory_threads(created_by);

CREATE INDEX IF NOT EXISTS idx_ai_memory_messages_thread_created ON ai_memory_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_memory_messages_role ON ai_memory_messages(role);

CREATE INDEX IF NOT EXISTS idx_ai_working_memory_workspace_thread ON ai_working_memory(workspace_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_working_memory_expires ON ai_working_memory(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_directives_workspace_user ON ai_directives(workspace_id, user_id);

-- Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_working_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_directives ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be enhanced later with proper user isolation)
-- For now, enable basic access - will be tightened based on auth requirements

-- Workspaces: basic access for authenticated users
CREATE POLICY "Enable access to workspaces" ON workspaces FOR ALL
  USING (auth.role() = 'authenticated');

-- Memory threads: access based on workspace and user
CREATE POLICY "Enable access to memory threads" ON ai_memory_threads FOR ALL
  USING (auth.role() = 'authenticated');

-- Memory messages: access through thread ownership
CREATE POLICY "Enable access to memory messages" ON ai_memory_messages FOR ALL
  USING (auth.role() = 'authenticated');

-- Working memory: workspace-scoped access
CREATE POLICY "Enable access to working memory" ON ai_working_memory FOR ALL
  USING (auth.role() = 'authenticated');

-- Directives: user-scoped access
CREATE POLICY "Enable access to directives" ON ai_directives FOR ALL
  USING (auth.role() = 'authenticated');

-- Insert a default workspace for development
INSERT INTO workspaces (name)
VALUES ('Default Workspace')
ON CONFLICT DO NOTHING;