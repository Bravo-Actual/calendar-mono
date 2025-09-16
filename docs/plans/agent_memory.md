I want to implement memory for my mastra agents. 

https://mastra.ai/en/docs/memory/overview
https://mastra.ai/en/docs/memory/working-memory
https://mastra.ai/en/docs/memory/overview#conversation-history
https://mastra.ai/en/docs/memory/semantic-recall
https://mastra.ai/en/examples/memory/memory-with-pg

I'm using supabase for storage.

I need to have tables for threads / message / memories, etc. I need to build this out in stages and I want to get something working quickly. 

What tables do I need to create, and what do I need to do to Mastra? 


ChatGPT said:
Thought for 47s

Awesome—let’s get you a lean, “works-today” memory stack for Mastra on Supabase, and a path to grow it in stages.

I’ll give you:

the minimal tables to get chat history and working memory flowing,

the SQL DDL (copy-paste into Supabase),

the Mastra glue code to wire it up,

a staged plan to add semantic recall (pgvector) and quality-of-life bits.

I’m basing the Mastra-side method names on their Memory docs and reference API (e.g. Memory.createThread, Memory.query, etc.). 
Mastra
+1

For the recall step, we’ll align with their “Working Memory” and “Semantic Recall” guidance. 
Mastra
+1

There’s also a “Memory with PostgreSQL” example we’ll follow in spirit (connection + simple storage). 
Mastra

Stage 0 — decisions (quick)

IDs: use UUIDs (Supabase defaults).

Message content: store as jsonb so you can keep role, text, tool calls, function arguments, etc.

Tenancy: tie everything to workspace_id (or org_id) and (optionally) user_id from Supabase Auth.

Thread scoping: threads represent a conversation “session” with an agent (or user).

Working memory: key/value facts scoped to a thread (short-term context).

Future recall: a memories table with embeddings for semantic lookup; pgvector index.

Stage 1 — Minimal tables (threads + messages + working memory)
SQL (run in Supabase SQL editor)
-- Enable pgcrypto for gen_random_uuid (if not already)
create extension if not exists pgcrypto;

-- Optional but recommended for Stage 3 (semantic recall)
create extension if not exists pgvector;

-- Workspaces / tenants (optional if you already have this elsewhere)
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Threads: a conversation session (agent <-> user)
create table if not exists ai_memory_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- If you use Supabase Auth, keep who started/owns it:
  created_by uuid null, -- references auth.users(id) in RLS, not FK to keep flexibility
  resource_type text not null default 'agent', -- e.g. 'agent','user','workflow'
  resource_id text not null,                 -- your agent id / user id / workflow id
  title text null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Messages: chronological chat items inside a thread
create table if not exists ai_memory_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references ai_memory_threads(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content jsonb not null,                     -- { text, parts, toolCalls, etc. }
  tokens int null,
  run_id text null,                           -- correlate to Mastra run if needed
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_thread_created
  on ai_memory_messages (thread_id, created_at);

-- Working memory: short-term key/value scoped to a thread (or global by project)
create table if not exists ai_working_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  thread_id uuid null references ai_memory_threads(id) on delete cascade,
  key text not null,
  value jsonb not null,
  score real null,                 -- importance/recency score if you want
  expires_at timestamptz null,     -- TTL for ephemeral items
  updated_at timestamptz not null default now(),
  unique (workspace_id, thread_id, key)
);

create index if not exists idx_ai_working_memory_project_thread
  on ai_working_memory (workspace_id, thread_id);

-- (Optional) A thin preferences/profile layer you can query quickly
create table if not exists ai_directives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid null,                 -- Supabase auth user id
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, key)
);


RLS: If you need per-user isolation, add RLS policies on these tables (scoping workspace_id and/or created_by). Supabase Auth JWT claims can be used in policies.

Stage 2 — Wire Mastra to Supabase (Postgres)

Mastra needs a storage + memory binding. The “Memory Class” exposes helpers like createThread, getThreadById, getThreadsByResourceIdPaginated, deleteMessages, query (for recall/context fetching). You’ll implement a PostgresMemoryAdapter (or use the Storage API if you prefer) that talks to these tables, then register it in your Mastra app. 
Mastra

Example TypeScript (server side)
// src/memory/PostgresMemoryAdapter.ts
import { Pool } from "pg";

export class PostgresMemoryAdapter {
  constructor(private pool: Pool) {}

  async createThread(input: {
    projectId: string;
    resourceType: string;
    resourceId: string;
    title?: string;
    metadata?: any;
    createdBy?: string;
  }) {
    const res = await this.pool.query(
      `insert into ai_memory_threads
       (workspace_id, resource_type, resource_id, title, metadata, created_by)
       values ($1,$2,$3,$4,$5,$6)
       returning id`,
      [
        input.projectId,
        input.resourceType,
        input.resourceId,
        input.title ?? null,
        input.metadata ?? {},
        input.createdBy ?? null,
      ],
    );
    return res.rows[0].id as string;
  }

  async appendMessage(input: {
    threadId: string;
    role: "system" | "user" | "assistant" | "tool";
    content: any; // { text: string, ... }
    runId?: string;
    metadata?: any;
    tokens?: number;
  }) {
    await this.pool.query(
      `insert into ai_memory_messages
       (thread_id, role, content, run_id, metadata, tokens)
       values ($1,$2,$3,$4,$5,$6)`,
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

  async getThreadById(threadId: string) {
    const t = await this.pool.query(
      `select * from ai_memory_threads where id = $1`,
      [threadId],
    );
    const m = await this.pool.query(
      `select * from ai_memory_messages
       where thread_id = $1
       order by created_at asc`,
      [threadId],
    );
    return { thread: t.rows[0], messages: m.rows };
  }

  async getThreadsByResourceId(projectId: string, resourceType: string, resourceId: string, limit = 20, offset = 0) {
    const r = await this.pool.query(
      `select * from ai_memory_threads
       where workspace_id = $1 and resource_type = $2 and resource_id = $3
       order by created_at desc
       limit $4 offset $5`,
      [projectId, resourceType, resourceId, limit, offset],
    );
    return r.rows;
  }

  async deleteMessages(threadId: string) {
    await this.pool.query(
      `delete from ai_memory_messages where thread_id = $1`,
      [threadId],
    );
  }

  // Working memory
  async upsertWorkingMemory(input: {
    projectId: string;
    threadId?: string | null;
    key: string;
    value: any;
    score?: number | null;
    ttlSeconds?: number | null;
  }) {
    const expiresAt =
      input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000) : null;
    await this.pool.query(
      `insert into ai_working_memory (workspace_id, thread_id, key, value, score, expires_at)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (workspace_id, thread_id, key)
       do update set value = excluded.value,
                     score = excluded.score,
                     expires_at = excluded.expires_at,
                     updated_at = now()`,
      [
        input.projectId,
        input.threadId ?? null,
        input.key,
        input.value,
        input.score ?? null,
        expiresAt,
      ],
    );
  }

  async getWorkingMemory(projectId: string, threadId?: string | null) {
    const r = await this.pool.query(
      `select * from ai_working_memory
       where workspace_id = $1
         and (thread_id is distinct from $2) is false
         and (expires_at is null or expires_at > now())
       order by updated_at desc`,
      [projectId, threadId ?? null],
    );
    return r.rows;
  }
}


Register in your Mastra app:

// src/mastra.ts
import { Mastra } from "mastra"; // your app bootstrap
import { Pool } from "pg";
import { PostgresMemoryAdapter } from "./memory/PostgresMemoryAdapter";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL, // use the "postgres" connection string
  ssl: { rejectUnauthorized: false },            // Supabase prod
});

const memory = new PostgresMemoryAdapter(pool);

export const mastra = new Mastra({
  // ... other config
});

// Expose a getter if your agents call mastra.getMemory()
export function getMemory() {
  return memory;
}


Then in agents or your server routes, call the adapter to create threads, append messages, and read context before Agent.generate().

Mastra’s Memory API lists the same conceptual operations we implemented (createThread, getThreadById, paginated thread fetch, delete messages), so your adapter mirrors that surface area. 
Mastra

Stage 3 — Semantic Recall (pgvector)

Add a memories table with an embedding column and an IVF/LSH index for fast top-k. This powers Mastra’s “semantic recall” step when building prompts. 
Mastra

SQL
-- Pick the dimension for your embedding model (e.g., 1536 for text-embedding-3-small)
-- If you plan to swap models, keep this in a config table.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'vector') then
    create extension if not exists pgvector;
  end if;
end $$;

create table if not exists ai_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- Scope to a user/agent/thread if you wish to bias recall:
  user_id uuid null,                             -- Supabase auth user id
  thread_id uuid null references ai_memory_threads(id) on delete cascade,
  kind text not null default 'fact',             -- 'fact','preference','profile','summary', etc.
  text text not null,
  embedding vector(1536) not null,               -- set dims to your model
  importance real null,                          -- manual or computed (1-10)
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_recalled_at timestamptz null,
  recall_count int not null default 0
);

-- IVF index (works well for >10k rows). Adjust lists/probes as needed.
create index if not exists idx_ai_memories_embedding
  on ai_memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Also add a plain trigram / full-text index for hybrid search (optional)
create extension if not exists pg_trgm;
create index if not exists idx_ai_memories_text_trgm
  on ai_memories using gin (text gin_trgm_ops);

Adapter additions
// Recall top-k memories for (projectId, optional threadId/userId)
async semanticRecall({
  projectId, threadId, userId, embeddedQuery, k = 8, probe = 10
}: {
  projectId: string;
  threadId?: string | null;
  userId?: string | null;
  embeddedQuery: number[]; // embedding vector for the query
  k?: number;
  probe?: number;
}) {
  // Optional: set ivfflat probes per session
  await this.pool.query(`set ivfflat.probes = $1`, [probe]);

  const r = await this.pool.query(
    `
    select id, text, metadata, 1 - (embedding <=> $1::vector) as score
    from ai_memories
    where workspace_id = $2
      and ($3::uuid is null or thread_id = $3)
      and ($4::uuid is null or user_id = $4)
    order by embedding <-> $1::vector
    limit $5
    `,
    [embeddedQuery, projectId, threadId ?? null, userId ?? null, k],
  );
  return r.rows;
}

async upsertMemory(input: {
  projectId: string;
  text: string;
  embedding: number[];
  kind?: string;
  threadId?: string | null;
  userId?: string | null;
  importance?: number | null;
  metadata?: any;
}) {
  await this.pool.query(
    `insert into ai_memories
     (workspace_id, user_id, thread_id, kind, text, embedding, importance, metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.projectId,
      input.userId ?? null,
      input.threadId ?? null,
      input.kind ?? 'fact',
      input.text,
      input.embedding,
      input.importance ?? null,
      input.metadata ?? {},
    ],
  );
}


Where to call it in Mastra flows: before Agent.generate(), fetch:

N most recent ai_memory_messages (conversation history),

ai_working_memory items (not expired),

semanticRecall() with the user’s latest message embedding.

Then compose them into the model’s context window as Mastra’s “Working Memory” + “Semantic Recall” sections. 
Mastra
+1

Stage 4 — Prompt-time integration (Mastra)

A common prompt assembly flow:

import { embed } from "./yourEmbedding"; // however you call your embedder
import { getMemory } from "../mastra";   // our adapter getter

export async function buildContext({
  projectId, threadId, userId, latestUserText
}: {
  projectId: string;
  threadId: string;
  userId?: string;
  latestUserText: string;
}) {
  const memory = getMemory();

  // 1) recent chat
  const { messages } = await memory.getThreadById(threadId);
  const recent = messages.slice(-20); // tune based on tokens

  // 2) working memory
  const wm = await memory.getWorkingMemory(projectId, threadId);

  // 3) semantic recall
  const qvec = await embed(latestUserText);    // 1536-dim for example
  const recall = await memory.semanticRecall({
    projectId, threadId, userId, embeddedQuery: qvec, k: 8
  });

  return { recent, working: wm, recall };
}


You can then format these into Mastra’s agent instructions / input context right before agent.generate().

The Mastra Memory pages describe using “Working Memory” and adding “Semantic Recall” when you need long-term facts—this flow mirrors that. 
Mastra
+1

Stage 5 — Operational niceties (quick wins)

Sweeper: a CRON job to delete from ai_working_memory where expires_at < now().

Summarize long threads: write periodic message summaries into ai_memories(kind='summary') and prune old messages; keep token usage down.

RLS: if multi-tenant, require workspace_id IN jwt() claims.

Indices: already included for hot paths; add idx_threads_resource on (workspace_id, resource_type, resource_id) if you list threads often.

Hybrid search: combine vector top-k and trigram full-text for better recall, then rerank.

What you need to change in Mastra (TL;DR)

Provide a memory adapter (above) that implements the handful of Memory operations Mastra expects (create thread, read threads, append messages, delete messages, plus your recall & working memory helpers). The method names and responsibilities are aligned with the Memory reference list. 
Mastra

At agent runtime, before generate(), assemble context by pulling:

recent ai_memory_messages,

ai_working_memory,

semanticRecall() results,
and place them into the prompt (Mastra’s working/semantic memory sections). 
Mastra
+1

(Optional now / later): create UI/API endpoints to:

start a thread,

append a message,

upsert working memory,

add long-term memory (with embeddings).

Quick checklist to “get something working today”

 Run Stage-1 SQL.

 Create PostgresMemoryAdapter and wire to Mastra.

 In your chat route:

create a thread on the first message,

append each user/assistant turn,

fetch last N messages + working memory and include them in the prompt.

 (Optional) Add Stage-3 tables; compute embeddings on incoming “facts” and enable recall.

If you want, tell me your embedding model (e.g., OpenAI text-embedding-3-small = 1536 dims), and I’ll tailor the vector(dim) and the recall SQL to match.