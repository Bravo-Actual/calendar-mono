# Mastra + Supabase (Custom Schema) — End‑to‑End Plan & Drop‑in Connector

This doc is a complete, copy‑pasteable plan to move from a **generic Mastra** setup (using Mastra’s built‑in storage) to **your Supabase Postgres schema** (`ai_threads`, `ai_messages`, `ai_memory`, `ai_metadata`) with a typed, RLS‑safe data connector. It includes:

- Step‑by‑step migration plan (fresh DB or reset)
- Supabase type generation
- A **drop‑in Mastra store** (TypeScript) backed by your tables
- Example Agent/Memory wiring
- Optional Hono API with JWT passthrough (SSE streaming)
- Sanity tests + operational notes

> Uses **@mastra/core@latest** and **@mastra/memory@latest**.

---

## 0) Prereqs

- **Node** ≥ 18
- **Supabase CLI** (local dev DB is fine)
- **pgvector** extension enabled (the migration does this)
- **OpenAI (or other) API key** if you want embeddings

Environment variables (dev):

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # for admin scripts only
OPENAI_API_KEY=...              # if using OpenAI embeddings
```

---

## 1) Database: reset & migrate (fresh project path)

If this is a clean slate, just apply your baseline SQL (the Users & AI migration) to your local Supabase Postgres.

```bash
# with supabase local running
supabase start           # if not already
supabase db reset        # wipes local db; optional if truly fresh
supabase db push         # applies your migrations
```

**Note:** the schema creates:
- `ai_threads` (owner‑scoped threads; immutable `persona_id`; auto‑updated `updated_at`)
- `ai_messages` (FK to `(thread_id,user_id)`; vector column; RLS mapping to owner)
- `ai_memory` (durable/working memory; optional vectors)
- `ai_metadata` (separate K/V table targeting exactly one of thread/message/memory/persona)

Your RLS policies expect the **caller’s Supabase JWT**.

---

## 2) Generate Supabase types

Generate typed DB definitions for compile‑time safety.

```bash
# local project
supabase gen types typescript --local > src/types/supabase.ts
# or remote project
# supabase gen types typescript --project-id <PROJECT_REF> > src/types/supabase.ts
```

This file should export a `Database` type with `public.Tables` → we’ll import it in the store.

---

## 3) Install deps (Mastra + Supabase + optional embeddings)

```bash
npm i @mastra/core@latest @mastra/memory@latest
npm i @supabase/supabase-js zod
# optional embedder
npm i @ai-sdk/openai
# server (optional)
npm i hono
```

> If you’re in Next.js, add `serverExternalPackages: ["@mastra/*"]` in `next.config.js` to avoid bundling issues.

---

## 4) Adapter Files (drop‑in)

Create the following files. They map exactly to your tables and enforce RLS by passing the **caller’s JWT** into the Supabase client.

### 4.1 `src/adapter/mapping.ts`

```ts
export const PERSONA_SENTINEL = "00000000-0000-0000-0000-000000000000";

export function makeResourceId(userId: string, personaId?: string | null) {
  return `${userId}:${personaId ?? PERSONA_SENTINEL}`;
}

export function splitResourceId(resourceId: string): { userId: string; personaId: string | null } {
  const [userId, p] = resourceId.split(":");
  return { userId, personaId: p === PERSONA_SENTINEL ? null : p };
}

export type MastraThread = {
  id: string;
  title?: string | null;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
};

export type MastraMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: Array<{ type: string; [k: string]: any }>;
  createdAt: string;
  similarity?: number;
};

export type MastraMemory = {
  id: string;
  resourceId: string;
  type: string;
  content: string;
  contentJson?: any;
  importance?: string;
  createdAt: string;
};
```

### 4.2 `src/adapter/text.ts`

```ts
export function extractTextForEmbedding(parts: Array<{ type: string; [k: string]: any }>): string {
  return parts
    .map((p) => {
      if (p.type === "text" && typeof p.text === "string") return p.text;
      if (p.type === "reasoning" && typeof p.text === "string") return p.text;
      if (p.type === "function_call" && p.name) return `call:${p.name}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
```

### 4.3 `src/adapter/MastraSupabaseStore.ts`

A typed storage adapter that implements the primitives Memory needs: threads, messages, semantic recall (vector RPC or text fallback), durable memory, and metadata.

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { extractTextForEmbedding } from "./text";
import type { MastraThread, MastraMessage, MastraMemory } from "./mapping";

export type Embedder = (texts: string[]) => Promise<number[][]>;

type Ctor = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  getToken: () => Promise<string>;   // caller’s Supabase JWT (RLS)
  embed?: Embedder;                  // optional embeddings
};

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

type Ins<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export class MastraSupabaseStore {
  private url: string;
  private anon: string;
  private getToken: () => Promise<string>;
  private embed?: Embedder;

  constructor(opts: Ctor) {
    this.url = opts.supabaseUrl;
    this.anon = opts.supabaseAnonKey;
    this.getToken = opts.getToken;
    this.embed = opts.embed;
  }

  private async sb(): Promise<SupabaseClient<Database>> {
    const token = await this.getToken();
    return createClient<Database>(this.url, this.anon, {
      auth: { persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  // ---------- Threads ----------

  async createThread(args: {
    userId: string;
    personaId?: string | null;
    title?: string | null;
    metadata?: Record<string, any>;
  }): Promise<MastraThread> {
    const sb = await this.sb();

    const payload: Ins<"ai_threads"> = {
      user_id: args.userId,
      persona_id: args.personaId ?? null,
      title: args.title ?? null,
    };

    const { data, error } = await sb.from("ai_threads").insert(payload).select("*").single();
    if (error) throw error;

    if (args.metadata && Object.keys(args.metadata).length) {
      const rows: Ins<"ai_metadata">[] = Object.entries(args.metadata).map(([k, v]) => ({
        thread_id: data.thread_id,
        key: k,
        value: v as any,
      }));
      const { error: mdErr } = await sb.from("ai_metadata").insert(rows);
      if (mdErr) throw mdErr;
    }

    return this._toThread(data);
  }

  async getThread(threadId: string): Promise<MastraThread> {
    const sb = await this.sb();
    const { data, error } = await sb.from("ai_threads").select("*").eq("thread_id", threadId).single();
    if (error) throw error;
    return this._toThread(data);
  }

  async listThreads(args: { personaId?: string | null; limit?: number } = {}): Promise<MastraThread[]> {
    const sb = await this.sb();
    let q = sb.from("ai_threads").select("*").order("updated_at", { ascending: false }).limit(args.limit ?? 50);
    if (args.personaId) q = q.eq("persona_id", args.personaId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(this._toThread);
  }

  async updateThreadTitle(threadId: string, title: string | null) {
    const sb = await this.sb();
    const { error } = await sb.from("ai_threads").update({ title }).eq("thread_id", threadId);
    if (error) throw error;
  }

  // ---------- Messages ----------

  async appendMessages(messages: Array<{
    threadId: string;
    role: Row<"ai_messages">["role"];
    content: Row<"ai_messages">["content"];
    metadata?: Record<string, any>;
  }>): Promise<MastraMessage[]> {
    if (!messages.length) return [];
    const sb = await this.sb();

    // optional embeddings
    let embs: number[][] = [];
    if (this.embed) {
      const texts = messages.map((m) => extractTextForEmbedding(m.content as any[]));
      try { embs = await this.embed(texts); } catch { embs = []; }
    }

    const rows: Ins<"ai_messages">[] = messages.map((m, i) => ({
      thread_id: m.threadId,
      role: m.role,
      content: m.content as any,
      message_embedding: (embs[i] ?? null) as unknown as any,
    }));

    const { data, error } = await sb
      .from("ai_messages")
      .insert(rows)
      .select("message_id,thread_id,role,content,created_at");
    if (error) throw error;

    // optional metadata per message
    const md: Ins<"ai_metadata">[] = [];
    messages.forEach((m, idx) => {
      if (!m.metadata) return;
      const mid = (data as any[])[idx].message_id as string;
      for (const [k, v] of Object.entries(m.metadata)) {
        md.push({ message_id: mid, key: k, value: v as any });
      }
    });
    if (md.length) {
      const { error: mdErr } = await sb.from("ai_metadata").insert(md);
      if (mdErr) throw mdErr;
    }

    return (data as any[]).map(this._toMessage);
  }

  async listMessages(threadId: string, args: { limit?: number; after?: string } = {}): Promise<MastraMessage[]> {
    const sb = await this.sb();
    let q = sb
      .from("ai_messages")
      .select("message_id,thread_id,role,content,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (args.after) q = q.gt("created_at", args.after);
    if (args.limit) q = q.limit(args.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(this._toMessage);
  }

  // ---------- Semantic recall (messages) ----------

  async searchMessages(opts: {
    scope: "thread" | "resource";
    threadId?: string;
    resourceId?: string;
    query: string;
    topK?: number;
    neighborRange?: number;
  }): Promise<MastraMessage[]> {
    const sb = await this.sb();

    if (!this.embed) {
      // text fallback
      const base = await this._selectMessagesForScope(sb, opts);
      const q = opts.query.toLowerCase();
      return base.filter((r) => {
        const txt = extractTextForEmbedding(r.content as any[]);
        return txt.toLowerCase().includes(q);
      }).map(this._toMessage);
    }

    const [qv] = await this.embed([opts.query]);
    const { data, error } = await sb.rpc("ai_search_messages_vector", {
      p_query: qv as unknown as any,
      p_thread_id: opts.scope === "thread" ? opts.threadId ?? null : null,
      p_resource_key: opts.scope === "resource" ? opts.resourceId ?? null : null,
      p_top_k: opts.topK ?? 8,
    });
    if (error) throw error;

    const hits = (data ?? []).map((r: any) => ({ ...this._toMessage(r), similarity: r.similarity }));
    if (!opts.neighborRange || opts.neighborRange <= 0) return hits;

    // neighbor expansion (simple in-memory pass)
    const threadIds = Array.from(new Set(hits.map((h) => h.threadId)));
    const expanded: MastraMessage[] = [];
    for (const tid of threadIds) {
      const all = await this.listMessages(tid);
      const byId = new Map(all.map((m, i) => [m.id, { i, m }]));
      const used = new Set<string>();
      for (const h of hits.filter((x) => x.threadId === tid)) {
        const pos = byId.get(h.id);
        if (!pos) continue;
        const range = opts.neighborRange ?? 2;
        const start = Math.max(0, pos.i - range);
        const end = Math.min(all.length - 1, pos.i + range);
        for (let i = start; i <= end; i++) {
          const mm = all[i];
          if (!used.has(mm.id)) {
            used.add(mm.id);
            expanded.push(mm);
          }
        }
      }
    }
    // de-dup + chronological
    const dedup = new Map(expanded.map((m) => [m.id, m]));
    return [...dedup.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private async _selectMessagesForScope(
    sb: SupabaseClient<Database>,
    opts: { scope: "thread" | "resource"; threadId?: string; resourceId?: string }
  ) {
    let q = sb.from("ai_messages").select("message_id,thread_id,role,content,created_at").order("created_at", { ascending: true });
    if (opts.scope === "thread" && opts.threadId) q = q.eq("thread_id", opts.threadId);
    if (opts.scope === "resource" && opts.resourceId) q = q.eq("resource_key", opts.resourceId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Row<"ai_messages">[];
  }

  // ---------- Durable / working memory ----------

  async saveMemory(args: {
    userId: string;
    personaId: string;
    memoryType: string;
    content: string;
    contentJson?: any;
    importance?: "low" | "normal" | "high" | "critical";
    sourceThreadId?: string | null;
    embed?: boolean;
  }): Promise<MastraMemory> {
    const sb = await this.sb();
    let vec: number[] | null = null;
    if (args.embed && this.embed) {
      try { [vec] = await this.embed([args.content]); } catch { vec = null; }
    }

    const payload: Ins<"ai_memory"> = {
      user_id: args.userId,
      persona_id: args.personaId,
      memory_type: args.memoryType,
      content: args.content,
      content_json: args.contentJson ?? null,
      importance: args.importance ?? "normal",
      source_thread_id: args.sourceThreadId ?? null,
      content_embedding: vec as unknown as any,
    };

    const { data, error } = await sb.from("ai_memory").insert(payload).select("*").single();
    if (error) throw error;
    return this._toMemory(data);
  }

  async searchMemories(args: {
    userId: string;
    personaId: string;
    query?: string;
    topK?: number;
    useVectors?: boolean;
  }): Promise<MastraMemory[]> {
    const sb = await this.sb();

    if (args.useVectors && this.embed) {
      const [qv] = await this.embed([args.query ?? ""]);
      // Replace with RPC ai_search_memories_vector if you add it
      const { data, error } = await sb
        .from("ai_memory")
        .select("*")
        .eq("user_id", args.userId)
        .eq("persona_id", args.personaId)
        .not("content_embedding", "is", null)
        .order("created_at", { ascending: false })
        .limit(args.topK ?? 10);
      if (error) throw error;
      return (data ?? []).map(this._toMemory);
    }

    // text fallback
    const { data, error } = await sb
      .from("ai_memory")
      .select("*")
      .eq("user_id", args.userId)
      .eq("persona_id", args.personaId)
      .order("created_at", { ascending: false })
      .limit(args.topK ?? 10);
    if (error) throw error;
    const rows = (data ?? []).filter((r) =>
      !args.query || `${r.content}`.toLowerCase().includes((args.query ?? "").toLowerCase())
    );
    return rows.map(this._toMemory);
  }

  // ---------- Metadata ----------

  async setMetadata(
    target: { threadId?: string; messageId?: string; memoryId?: string; personaRef?: string },
    key: string,
    value: any
  ): Promise<void> {
    const sb = await this.sb();
    const base: Partial<Ins<"ai_metadata">> = { key, value };
    if (target.threadId) base.thread_id = target.threadId;
    if (target.messageId) base.message_id = target.messageId;
    if (target.memoryId) base.memory_id = target.memoryId;
    if (target.personaRef) base.persona_ref = target.personaRef;

    const insert = await sb.from("ai_metadata").insert(base as any).select("metadata_id").single();
    if (!insert.error) return;           // success

    // Unique violation → update row (if you kept the per-target unique indexes)
    if ((insert.error as any).code === "23505") {
      let q = sb.from("ai_metadata").update({ value });
      if (target.threadId) q = q.eq("thread_id", target.threadId);
      if (target.messageId) q = q.eq("message_id", target.messageId);
      if (target.memoryId) q = q.eq("memory_id", target.memoryId);
      if (target.personaRef) q = q.eq("persona_ref", target.personaRef);
      q = q.eq("key", key);
      const { error: upErr } = await q;
      if (upErr) throw upErr;
      return;
    }

    throw insert.error; // unexpected
  }

  async getMetadata(
    target: { threadId?: string; messageId?: string; memoryId?: string; personaRef?: string },
    key: string
  ): Promise<any> {
    const sb = await this.sb();
    let q = sb.from("ai_metadata").select("value").eq("key", key).limit(1);
    if (target.threadId) q = q.eq("thread_id", target.threadId);
    if (target.messageId) q = q.eq("message_id", target.messageId);
    if (target.memoryId) q = q.eq("memory_id", target.memoryId);
    if (target.personaRef) q = q.eq("persona_ref", target.personaRef);
    const { data, error } = await q;
    if (error) throw error;
    return data?.[0]?.value ?? null;
  }

  // ---------- Mappers ----------

  private _toThread = (r: Row<"ai_threads">): MastraThread => ({
    id: r.thread_id,
    title: r.title ?? null,
    resourceId: r.resource_key!,
    createdAt: r.created_at as unknown as string,
    updatedAt: r.updated_at as unknown as string,
  });

  private _toMessage = (r: Pick<Row<"ai_messages">, "message_id"|"thread_id"|"role"|"content"|"created_at"> & { similarity?: number }): MastraMessage => ({
    id: r.message_id as string,
    threadId: r.thread_id as string,
    role: r.role as any,
    content: r.content as any[],
    createdAt: r.created_at as unknown as string,
    similarity: typeof r.similarity === "number" ? r.similarity : undefined,
  });

  private _toMemory = (r: Row<"ai_memory">): MastraMemory => ({
    id: r.memory_id,
    resourceId: r.resource_key!,
    type: r.memory_type,
    content: r.content,
    contentJson: r.content_json ?? null,
    importance: r.importance ?? "normal",
    createdAt: r.created_at as unknown as string,
  });
}
```

---

## 5) Wire into Mastra (Agent + Memory)

Create `src/mastra.ts` to construct your Agent with this storage. The `getSupabaseToken` callback should return the **end‑user JWT** you got from the client (or a server‑generated JWT when acting on behalf of the user) so RLS applies.

```ts
// src/mastra.ts
import { Agent } from "@mastra/core";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { MastraSupabaseStore } from "./adapter/MastraSupabaseStore";

// OPTIONAL: OpenAI embedder (text-embedding-3-small → 1536 dims)
async function embedder(texts: string[]): Promise<number[][]> {
  const client = openai.embedding("text-embedding-3-small");
  const out: number[][] = [];
  for (const t of texts) {
    const res = await client.generate(t);
    out.push(Array.from((res as any).embedding));
  }
  return out;
}

export function buildMastra(getSupabaseToken: () => Promise<string>) {
  const storage = new MastraSupabaseStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
    getToken: getSupabaseToken,
    embed: embedder, // omit to disable vectors (text fallback remains)
  });

  const memory = new Memory({
    storage,
    options: {
      lastMessages: 20,
      semanticRecall: { topK: 6, messageRange: 2, scope: "resource" }, // or "thread"
      workingMemory: { enabled: true },
      threads: { generateTitle: true },
    },
  });

  const agent = new Agent({
    name: "custom",
    instructions: "Be helpful and concise.",
    model: openai("gpt-4o-mini"),
    memory,
  });

  return { storage, memory, agent };
}
```

---

## 6) Hono API (JWT passthrough + SSE stream)

This is optional but helpful if you want a thin gateway that enforces **Supabase JWT** and forwards it to the store, keeping RLS intact. It exposes:
- `POST /api/threads` → create thread `{ personaId?, title? }`
- `POST /api/agents/:name/stream` → stream responses (expects `{ messages, threadId, resourceId }`)

```ts
// src/server.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildMastra } from "./mastra";

const app = new Hono();
app.use("*", cors());

function getBearer(c: any) {
  const auth = c.req.header("authorization") || c.req.header("Authorization");
  if (!auth) return null;
  const [type, token] = auth.split(" ");
  return type?.toLowerCase() === "bearer" ? token : null;
}

app.post("/api/threads", async (c) => {
  const jwt = getBearer(c);
  if (!jwt) return c.text("Missing bearer token", 401);
  const { agent } = buildMastra(async () => jwt);
  const body = await c.req.json();
  const { userId, personaId = null, title = null, metadata = {} } = body;

  // Create via storage directly to get the thread id
  const t = await (agent as any).memory.storage.createThread({ userId, personaId, title, metadata });
  return c.json(t);
});

app.post("/api/agents/:name/stream", async (c) => {
  const jwt = getBearer(c);
  if (!jwt) return c.text("Missing bearer token", 401);
  const { agent } = buildMastra(async () => jwt);

  const { messages, threadId, resourceId } = await c.req.json();
  const stream = await (agent as any).stream([messages.at(-1)], { threadId, resourceId });
  // Hono can return a Response directly
  return stream.toDataStreamResponse();
});

export default app;
```

> You can add more routes for listing threads, fetching messages, or saving durable memories via the store’s methods.

---

## 7) Quick sanity tests

**Create a user JWT** (client‑side sign‑in or admin Service Role for local scripted calls). Then:

```bash
# 1) create thread
curl -X POST http://localhost:8787/api/threads \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<auth.users.id>",
    "personaId": "<ai_personas.id or null>",
    "title": "Hello world thread"
  }'

# 2) stream a reply
curl -N -X POST http://localhost:8787/api/agents/custom/stream \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":[{"type":"text","text":"remember my favorite color is blue"}]}],
    "threadId": "<thread_id_from_step1>",
    "resourceId": "<userId:personaId-or-sentinel>"
  }'
```

Then check tables:

```sql
select * from ai_threads order by updated_at desc limit 5;
select * from ai_messages where thread_id = '<tid>' order by created_at asc;
select * from ai_metadata where thread_id = '<tid>';
select * from ai_memory where user_id = '<uid>' and persona_id = '<pid>' order by created_at desc;
```

---

## 8) Embeddings + indexes

- Vector dims in the schema are **1536** (OpenAI `text-embedding-3-small`). If you switch providers, align the column type and RPCs.
- For IVFFLAT performance, warm/rebuild after bulk loads:

```sql
-- tune list count as needed
ALTER INDEX idx_ai_messages_embedding SET (lists = 100);
REINDEX INDEX CONCURRENTLY idx_ai_messages_embedding;
```

(Do the same for `ai_memory` if you enable its vector recall and add the matching RPC.)

---

## 9) Operational notes

- **RLS**: Every call uses the caller’s Supabase JWT, so your existing policies/ownership rules hold.
- **Persona immutability**: Changing `ai_threads.persona_id` is blocked by trigger; messages auto‑touch the parent thread’s `updated_at`.
- **Metadata**: Stored in `ai_metadata` with one‑target rule; optional unique (target,key) upsert logic baked into `setMetadata`.
- **Resource model**: `resource_key = user_id:persona_id`, with a sentinel UUID when persona is null.

---

## 10) What you’re *not* using anymore

- Mastra’s built‑in LibSQL/PG stores and their default tables. Your store fully replaces them.
- Any implicit server: you’re fronting with **Hono** and your own Supabase project.

---

## 11) Future add‑ons (optional)

- **Memory vector RPC** parity: add an `ai_search_memories_vector` SQL function and call it in `searchMemories()`.
- **Tool‑based knowledge**: attach a vector RAG tool (eg. Postgres, Chroma) and keep your `resource_key` scoping.
- **Client SDK**: If you expose your Hono API, you can also use Mastra’s client JS SDK to call it from the webapp.

---

## 12) Done ✅

You can now run Mastra against your own Supabase schema, with RLS, typed queries, and drop‑in streaming via Hono. If you want me to tailor route handlers or add multi‑persona resource routing, say the word and I’ll extend this skeleton.

