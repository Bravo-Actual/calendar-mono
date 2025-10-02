# calendar-ai — Express Server Plan (LangGraph, Supabase, OpenRouter)

Single-process Node service that hosts:

- **Express** HTTP API
- **LangGraph/LangChain** agent orchestration
- **Local LangChain tools (no MCP in v1)**
- **SSE chat streaming** endpoint compatible with AI SDK UIs
- **Supabase** auth (Bearer) + Postgres storage (migrations only; no runtime DDL)
- **OpenRouter** models via LangChain `ChatOpenAI`
- **Swagger UI** served from generated OpenAPI spec

---

## 0) Tech & versions

- Node 20+
- TypeScript 5+
- **Express 5.1+ (stable)**
- **LangChain JS 0.3.x (stable line)**
- **LangGraph JS 0.4.x (stable line)**
- **Supabase JS 2.57+**
- swagger-ui-express 5.x
- zod-to-openapi 8.x

---

## 1) Repo layout
```
calendar-ai/
├─ src/
│  ├─ server.ts                  # boot express, mount routes, swagger
│  ├─ env.ts                     # env validation (zod)
│  ├─ auth/
│  │  └─ supabase.ts            # bearer verification → req.user, req.supabase
│  ├─ llm/
│  │  └─ openrouter.ts          # ChatOpenAI factory (baseURL+headers)
│  ├─ graph/
│  │  ├─ index.ts               # LangGraph compile; bind tools
│  │  └─ tools/
│  │     ├─ time.ts             # sample tool: get_current_datetime
│  │     └─ index.ts            # export ALL_TOOLS
│  ├─ routes/
│  │  ├─ chat.ts                # POST /api/chat/stream, /generate
│  │  ├─ threads.ts             # POST /api/threads (upsert by client-supplied id)
│  │  ├─ messages.ts            # GET/POST /api/messages/:threadId
│  │  └─ memory.ts              # GET/POST /api/memory/:personaId
│  ├─ storage/
│  │  ├─ types.ts               # Storage interface + Message/Role types
│  │  ├─ memory.ts              # dev in-memory impl
│  │  ├─ supabase.ts            # prod impl (upserts + RLS-safe)
│  │  └─ index.ts               # choose impl via env.DB_MODE
│  └─ openapi/
│     └─ spec.ts                # zod-to-openapi → swagger-ui-express
├─ supabase/
│  └─ migrations/
│     ├─ 000001_init.sql        # tables + triggers
│     ├─ 000002_rls.sql         # RLS policies
│     └─ 000003_indexes.sql     # indexes
├─ package.json
├─ tsconfig.json
├─ .env.example
└─ README.md
```

**Notes**
- Keep **tools** pure and stateless; pass user/thread context through inputs.
- All **DB writes** (threads/messages/memory) happen server-side in routes using `storage/*`.
- Client may generate `threadId` and per-message `id` (UUIDv4) for idempotency; server upserts.
- Add `/tests` later for route + storage integration tests.

---

## 2) package.json
```jsonc
{
  "name": "calendar-ai",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup src/server.ts --format esm --dts",
    "start": "node dist/server.js",
    "db:login": "supabase login",
    "db:new": "supabase migration new",
    "db:push": "supabase db push",
    "db:reset": "supabase db reset"
  },
  "dependencies": {
    "express": "^5.1.0",
    "langchain": "^0.3.33",
    "@langchain/core": "^0.3.75",
    "@langchain/openai": "^0.6.11",
    "@langchain/langgraph": "^0.4.9",
    "@supabase/supabase-js": "^2.57.2",
    "zod": "^3.23.8",
    "swagger-ui-express": "^5.0.1",
    "@asteasolutions/zod-to-openapi": "^8.1.0"
  },
  "devDependencies": {
    "tsup": "^8.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.5.0"
  }
}
```jsonc
{
  "name": "calendar-ai",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup src/server.ts --format esm --dts",
    "start": "node dist/server.js",
    "db:login": "supabase login",
    "db:new": "supabase migration new",
    "db:push": "supabase db push",
    "db:reset": "supabase db reset"
  },
  "dependencies": {
    "express": "^5.1.0",
    "langchain": "^0.3.33",
    "@langchain/core": "^0.3.75",
    "@langchain/openai": "^0.6.11",
    "@langchain/langgraph": "^0.4.9",
    "@supabase/supabase-js": "^2.57.2",
    "zod": "^3.23.8",
    "swagger-ui-express": "^5.0.1",
    "@asteasolutions/zod-to-openapi": "^8.1.0",
    "@modelcontextprotocol/sdk": "^1.18.2",
    "@modelcontextprotocol/sdk/server": "^1.18.2"
  },
  "devDependencies": {
    "tsup": "^8.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.5.0"
  }
}
````

---

## 3) .env.example

```
PORT=3030
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # optional for server writes under RLS
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_SITE_URL=https://your.app
OPENROUTER_SITE_NAME=Calendar AI
DB_MODE=memory                   # memory | supabase
```

---

## 4) env.ts

```ts
import { z } from "zod";

const Env = z.object({
  PORT: z.string().default("3030"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  OPENROUTER_SITE_URL: z.string().url().default("http://localhost:3030"),
  OPENROUTER_SITE_NAME: z.string().default("Calendar AI"),
  DB_MODE: z.enum(["memory", "supabase"]).default("memory"),
});

export const env = Env.parse(process.env);
```

---

## 5) Supabase auth middleware

```ts
// src/auth/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
import type { Request, Response, NextFunction } from "express";

export async function supabaseAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).end();

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return res.status(401).end();
  (req as any).user = data.user;
  (req as any).supabase = supabase; // per-request client (RLS-safe)
  return next();
}
```

---

## 6) OpenRouter LLM factory

```ts
// src/llm/openrouter.ts
import { ChatOpenAI } from "@langchain/openai";
import { env } from "../env";

export function makeLLM(model = env.OPENROUTER_MODEL, temperature = 0.3) {
  return new ChatOpenAI(
    { model, temperature, apiKey: env.OPENROUTER_API_KEY, streaming: true },
    {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": env.OPENROUTER_SITE_URL,
        "X-Title": env.OPENROUTER_SITE_NAME,
      },
    }
  );
}
```

---

## 7) LangGraph orchestrator (start simple)

```ts
// src/graph/index.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { makeLLM } from "../llm/openrouter";
import { ALL_TOOLS } from "./tools";

export type ChatMsg = { role: "user" | "assistant" | "system" | "tool"; content: string };
export type Ctx = { messages: ChatMsg[]; runtime?: Record<string, any>; result?: string };

const llm = makeLLM().bindTools(ALL_TOOLS); // v1: local LC tools only

export const graph = new StateGraph<Ctx>()
  .addNode("decide", async (s) => {
    const res: any = await llm.invoke(s.messages as any);
    s.result = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
    return s;
  })
  .addEdge(START, "decide")
  .addEdge("decide", END)
  .compile();
```

> Later swap in a plan→act(tool loop)→respond graph and stream tokens/steps.ts // src/graph/index.ts import { StateGraph, START, END } from "@langchain/langgraph"; import { makeLLM } from "../llm/openrouter";

export type ChatMsg = { role: "user" | "assistant" | "system" | "tool"; content: string }; export type Ctx = { messages: ChatMsg[]; runtime?: Record\<string, any>; result?: string };

const llm = makeLLM(); // later: .bindTools([...])

export const graph = new StateGraph() .addNode("decide", async (s) => { const res: any = await llm.invoke(s.messages as any); s.result = typeof res.content === "string" ? res.content : JSON.stringify(res.content); return s; }) .addEdge(START, "decide") .addEdge("decide", END) .compile();

````

> Later swap in a plan→act(tool loop)→respond graph and stream tokens/steps.

---

## 8) Local LangChain tools (no MCP in v1)

Add tools under `src/graph/tools/` and export them from `index.ts`. Here’s a simple **get current date/time** tool you can use to test tool calling.

```ts
// src/graph/tools/time.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentDateTime = new DynamicStructuredTool({
  name: "get_current_datetime",
  description: "Return the current UTC time and a localized display string for an optional IANA timezone.",
  schema: z.object({
    timezone: z.string().describe("IANA tz like 'America/New_York'").optional(),
  }),
  func: async ({ timezone }) => {
    const now = new Date();
    const nowISO = now.toISOString();
    const tz = timezone || "UTC";
    // Localized string for display; ISO remains UTC for consistency
    const local = now.toLocaleString(undefined, { timeZone: tz, hour12: false });
    return JSON.stringify({ nowISO, epochMs: now.getTime(), timezone: tz, local });
  },
});
````

```ts
// src/graph/tools/index.ts
export { getCurrentDateTime } from "./time";
export const ALL_TOOLS = [getCurrentDateTime];
```

## That’s it—your agent can now call `get_current_datetime` when it needs the current time (optionally localized).



## 9) Storage interface + implementations

```ts
// src/storage/types.ts
export type Role = "user" | "assistant" | "tool" | "system";
export type Message = { id: string; role: Role; content: any; ts: string };

export interface Storage {
  ensureReady(): Promise<void>;
  upsertThread(threadId: string, userId: string, personaId?: string | null, title?: string | null, metadata?: any): Promise<void>;
  /** Insert a single message. If `id` is provided, implementations should de-dupe on `message_id`. */
  insertMessage(threadId: string, userId: string, role: Role, content: any, ts: string, id?: string): Promise<void>;
  listMessages(threadId: string, limit?: number): Promise<Message[]>;
  getMemory(userId: string, personaId: string): Promise<any | null>;
  upsertMemory(userId: string, personaId: string, content: any): Promise<{ updated_at: string }>;
}
```

```ts
// src/storage/memory.ts
import { Storage, Role, Message } from "./types";

export class MemoryStorage implements Storage {
  private threads = new Map<string, { userId: string; personaId?: string | null; title?: string | null; metadata?: any }>();
  private messages = new Map<string, Message[]>();
  private memory = new Map<string, any>(); // key `${userId}:${personaId}`
  async ensureReady() {}
  async upsertThread(threadId: string, userId: string, personaId?: string | null, title?: string | null, metadata?: any) {
    this.threads.set(threadId, { userId, personaId, title, metadata });
  }
  async insertMessage(threadId: string, userId: string, role: Role, content: any, ts: string, id?: string) {
    const arr = this.messages.get(threadId) ?? [];
    if (id && arr.some(m => m.id === id)) return; // de-dupe by client-provided id
    arr.push({ id: id ?? crypto.randomUUID(), role, content, ts });
    this.messages.set(threadId, arr);
  }
  async listMessages(threadId: string, limit = 100) {
    const arr = this.messages.get(threadId) ?? [];
    return arr.slice(-limit);
  }
  async getMemory(userId: string, personaId: string) {
    return this.memory.get(`${userId}:${personaId}`) ?? null;
  }
  async upsertMemory(userId: string, personaId: string, content: any) {
    this.memory.set(`${userId}:${personaId}`, content);
    return { updated_at: new Date().toISOString() };
  }
}
```

```ts
// src/storage/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
import { Storage, Role, Message } from "./types";

export class SupabaseStorage implements Storage {
  private admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY);
  async ensureReady() {}
  async upsertThread(threadId: string, userId: string, personaId?: string | null, title?: string | null, metadata?: any) {
    await this.admin.from("ai_threads").upsert({ thread_id: threadId, user_id: userId, persona_id: personaId, title, metadata }).select();
  }
  async insertMessage(threadId: string, userId: string, role: Role, content: any, ts: string, id?: string) {
    const row: any = { thread_id: threadId, user_id: userId, role, content, created_at: ts };
    if (id) row.message_id = id;
    await this.admin.from("ai_messages").upsert(row, { onConflict: "message_id" });
  }
  async listMessages(threadId: string, limit = 100): Promise<Message[]> {
    const { data } = await this.admin
      .from("ai_messages")
      .select("message_id, role, content, ts: created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(limit);
    return (data ?? []).map((r: any) => ({ id: r.message_id, role: r.role, content: r.content, ts: r.ts }));
  }
  async getMemory(userId: string, personaId: string) {
    const { data } = await this.admin.from("ai_memory").select("content, updated_at").eq("user_id", userId).eq("persona_id", personaId).maybeSingle();
    return data ? { content: data.content, updated_at: data.updated_at } : null;
  }
  async upsertMemory(userId: string, personaId: string, content: any) {
    const { data } = await this.admin
      .from("ai_memory")
      .upsert({ user_id: userId, persona_id: personaId, content })
      .select("updated_at")
      .single();
    return { updated_at: data?.updated_at ?? new Date().toISOString() };
  }
}
```

```ts
// src/storage/index.ts
import { env } from "../env";
import { MemoryStorage } from "./memory";
import { SupabaseStorage } from "./supabase";

export const storage = env.DB_MODE === "supabase" ? new SupabaseStorage() : new MemoryStorage();
```

---

## 10) Chat routes (SSE & non-stream)

```ts
// src/routes/chat.ts
import { Router } from "express";
import { graph, type Ctx } from "../graph";
import { storage } from "../storage";

export const chat = Router();

const sse = (data: unknown, event = "message") => `event: ${event}
data: ${JSON.stringify(data)}

`;

async function loadPersonaAndMemory(req: any, personaId?: string) {
  if (!personaId) return { system: null };
  // ai_personas table assumed to exist in your DB. Adjust column names as needed.
  const { data: persona } = await req.supabase
    .from("ai_personas")
    .select("name,instructions,traits,style")
    .eq("persona_id", personaId)
    .maybeSingle();

  const { data: mem } = await req.supabase
    .from("ai_memory")
    .select("content")
    .eq("user_id", req.user.id)
    .eq("persona_id", personaId)
    .maybeSingle();

  // Compose a compact system message using DB persona instructions + runtime context + memory
  const buildSystem = (p: any, runtime: any, memory: any) => {
    const lines: string[] = [];
    if (p?.name) lines.push(`You are ${p.name}.`);
    if (p?.instructions) lines.push(String(p?.instructions));
    if (p?.traits) lines.push(String(p?.traits));

    const tz = runtime?.timezone ?? "UTC";
    const nowISO = runtime?.nowISO ?? new Date().toISOString();
    const view = runtime?.view;
    const viewLine = view?.start && view?.end
      ? `Current calendar view: ${view.start} → ${view.end} (${tz}).`
      : Array.isArray(view?.dates) && view.dates.length
        ? `Current calendar dates: ${view.dates.join(", ")} (${tz}).`
        : `Timezone: ${tz}.`;

    lines.push(`Current time: ${nowISO}.`);
    lines.push(viewLine);

    if (memory?.content) {
      lines.push(`# User preferences (memory)
${JSON.stringify(memory.content)}`);
    }

    lines.push(`# Operating rules
- Execute tools silently; do not narrate steps.
- Prefer concise, plain language.
- Confirm title/date/time/attendees/location when scheduling.
- Never expose internal IDs.
- Ask at most one targeted follow-up if needed.`);

    return lines.filter(Boolean).join("

");
  };

  return { system: (runtime: any) => buildSystem(persona, runtime, mem) };
}

chat.post("/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const user = (req as any).user;
  const { threadId, personaId, messages = [], runtimeContext = {} } = req.body ?? {};

  await storage.ensureReady();

  // ✅ Idempotent thread create: client can specify threadId to avoid UI re-renders
  if (threadId) await storage.upsertThread(threadId, user.id, personaId, null, {});

  // Build system message from DB persona + memory (if personaId provided)
  const { system } = await loadPersonaAndMemory(req, personaId);
  const systemMsg = system ? [{ role: "system", content: system(runtimeContext) }] : [];

  // ✅ Persist ALL inbound user messages for this request (de-dupe when messages carry an id)
  if (threadId && Array.isArray(messages)) {
    for (const m of messages) {
      if (m.role === "user") {
        await storage.insertMessage(
          threadId,
          user.id,
          "user",
          m.content,
          m.ts ?? new Date().toISOString(),
          (m as any).id
        );
      }
    }
  }

  res.write(sse({ type: "start" }, "start"));
  try {
    const ctx: Ctx = { messages: [...systemMsg, ...messages], runtime: runtimeContext };
    const result = await graph.invoke(ctx);

    if (threadId) {
      await storage.insertMessage(
        threadId,
        user.id,
        "assistant",
        { type: "text", text: result.result ?? "" },
        new Date().toISOString()
      );
    }

    res.write(sse({ type: "finish", text: result.result ?? "" }, "finish"));
  } catch (e: any) {
    res.write(sse({ type: "error", message: e?.message ?? "stream error" }, "error"));
  }
  res.end();
});

chat.post("/generate", async (req, res) => {
  const user = (req as any).user;
  const { threadId, personaId, messages = [], runtimeContext = {} } = req.body ?? {};

  await storage.ensureReady();
  if (threadId) await storage.upsertThread(threadId, user.id, personaId, null, {});

  const { system } = await loadPersonaAndMemory(req, personaId);
  const systemMsg = system ? [{ role: "system", content: system(runtimeContext) }] : [];

  // ✅ Persist ALL inbound user messages (de-dupe when `id` provided)
  if (threadId && Array.isArray(messages)) {
    for (const m of messages) {
      if (m.role === "user") {
        await storage.insertMessage(
          threadId,
          user.id,
          "user",
          m.content,
          m.ts ?? new Date().toISOString(),
          (m as any).id
        );
      }
    }
  }

  const result = await graph.invoke({ messages: [...systemMsg, ...messages], runtime: runtimeContext });

  if (threadId) {
    await storage.insertMessage(
      threadId,
      user.id,
      "assistant",
      { type: "text", text: result.result ?? "" },
      new Date().toISOString()
    );
  }

  res.json({ text: result.result ?? "" });
});
```

---

## 11) Threads, Messages, Memory routes

```ts
// src/routes/threads.ts
import { Router } from "express";
import { storage } from "../storage";
export const threads = Router();

// Explicit create (server is source of truth). Client may generate UUID and send in body for idempotency.
threads.post("/", async (req: any, res) => {
  const { threadId, personaId, title, metadata } = req.body ?? {};
  const id = threadId || crypto.randomUUID();
  await storage.upsertThread(id, req.user.id, personaId ?? null, title ?? null, metadata ?? {});
  res.status(201).json({ thread_id: id });
});

// (Optional) list user threads — implement via Supabase query when switching to DB storage
threads.get("/", async (_req, res) => {
  res.json({ items: [] });
});
```

```ts
// src/routes/messages.ts
import { Router } from "express";
import { storage } from "../storage";
export const messages = Router();

messages.get("/:threadId", async (req, res) => {
  const items = await storage.listMessages(req.params.threadId, Number(req.query.limit ?? 100));
  res.json({ items });
});

messages.post("/:threadId", async (req: any, res) => {
  const { role = "user", content, id, ts } = req.body ?? {};
  await storage.insertMessage(req.params.threadId, req.user.id, role, content, ts ?? new Date().toISOString(), id);
  res.status(201).end();
});
```

```ts
// src/routes/memory.ts
import { Router } from "express";
import { storage } from "../storage";
export const memory = Router();

memory.get("/:personaId", async (req: any, res) => {
  const data = await storage.getMemory(req.user.id, req.params.personaId);
  res.json(data ?? { content: null, updated_at: null });
});

memory.post("/:personaId", async (req: any, res) => {
  const { content, mode = "replace" } = req.body ?? {};
  const current = await storage.getMemory(req.user.id, req.params.personaId);
  const merged = mode === "merge" && current?.content && typeof content === "object"
    ? { ...current.content, ...content }
    : content;
  const out = await storage.upsertMemory(req.user.id, req.params.personaId, merged);
  res.json({ user_id: req.user.id, persona_id: req.params.personaId, content: merged, updated_at: out.updated_at });
});
```

---

## 12) server.ts (bootstrap + Swagger)

```ts
// src/server.ts
import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./env";
import { supabaseAuth } from "./auth/supabase";
import { chat } from "./routes/chat";
import { memory } from "./routes/memory";


// docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

app.listen(Number(env.PORT), () => console.log(`calendar-ai on :${env.PORT}`));
```

---

## 13) OpenAPI (zod-to-openapi sketch)

```ts
// src/openapi/spec.ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

const registry = new OpenAPIRegistry();

// Schemas
const ChatMessage = z.object({ id: z.string().uuid().optional(), role: z.enum(["user","assistant","tool","system"]), content: z.any(), ts: z.string().datetime().optional() });
const StreamBody = z.object({ threadId: z.string().optional(), personaId: z.string().optional(), messages: z.array(ChatMessage), runtimeContext: z.record(z.any()).optional() });
registry.registerPath({
  method: "post",
  path: "/api/chat/stream",
  request: { body: { content: { "application/json": { schema: StreamBody } } } },
  responses: { 200: { description: "SSE stream" } }
});

// ✅ Threads: server upsert; client may provide threadId for idempotency (avoids UI re-renders)
const ThreadsPost = z.object({
  threadId: z.string().uuid().optional(),
  personaId: z.string().optional(),
  title: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});
registry.registerPath({
  method: "post",
  path: "/api/threads",
  request: { body: { content: { "application/json": { schema: ThreadsPost } } } },
  responses: { 201: { description: "Upserted thread (returns thread_id)" } }
});

const MemoryPost = z.object({ content: z.any(), mode: z.enum(["replace","merge"]).optional() });
registry.registerPath({
  method: "post",
  path: "/api/memory/{personaId}",
  request: { params: z.object({ personaId: z.string() }), body: { content: { "application/json": { schema: MemoryPost } } } },
  responses: { 200: { description: "Upserted memory" } }
});

export const openapiDoc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: { title: "Calendar AI", version: "1.0.0" }
});
```

---

## 14) Supabase migrations

### 000001\_init.sql

```sql
create extension if not exists pgcrypto;

create table if not exists ai_threads (
  thread_id   uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  persona_id  uuid,
  title       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists ai_messages (
  message_id  uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references ai_threads(thread_id) on delete cascade,
  user_id     uuid not null,
  role        text not null check (role in ('user','assistant','tool','system')),
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists ai_memory (
  memory_id   uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  persona_id  uuid not null,
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, persona_id)
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_ai_threads_updated
before update on ai_threads
for each row execute function set_updated_at();

create trigger trg_ai_messages_updated
before update on ai_messages
for each row execute function set_updated_at();

create trigger trg_ai_memory_updated
before update on ai_memory
for each row execute function set_updated_at();
```

### 000002\_rls.sql

```sql
alter table ai_threads enable row level security;
alter table ai_messages enable row level security;
alter table ai_memory  enable row level security;

create policy ai_threads_owner_all on ai_threads for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ai_messages_via_thread on ai_messages for all to authenticated
using (exists (select 1 from ai_threads t where t.thread_id = ai_messages.thread_id and t.user_id = auth.uid()))
with check (exists (select 1 from ai_threads t where t.thread_id = ai_messages.thread_id and t.user_id = auth.uid()));

create policy ai_memory_owner_all on ai_memory for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 000003\_indexes.sql

```sql
create index if not exists idx_ai_threads_user_updated on ai_threads(user_id, updated_at desc);
create index if not exists idx_ai_messages_thread_created on ai_messages(thread_id, created_at asc);
-- optional jsonb GIN indexes when you start querying on content fields
-- create index if not exists idx_ai_messages_content_gin on ai_messages using gin (content);
```

---

## 15) Rollout checklist

-

---

## 17) Persona/system message wiring (DB-sourced)

**We will not hardcode a buildSystemPrompt helper.** Instead, we compose the system message at request time from the **ai\_personas** row + runtime context and (optional) memory.

**Where:** in `routes/chat.ts`, `loadPersonaAndMemory()` reads:

- `ai_personas(name, instructions, traits, style)` by `persona_id`
- `ai_memory(content)` for `(user_id, persona_id)`
- `runtimeContext` supplied by the client (e.g., `{ timezone, nowISO, view }`)

It then emits a single **system** message prepended to the user messages. This keeps persona in the DB (source of truth) and avoids sending large headers.

**Client payload example**

```jsonc
{
  "threadId": "2f8a...",            // optional: client-generated UUID for idempotent threads
  "personaId": "cal-default",       // selects ai_personas row
  "runtimeContext": {
    "timezone": "America/New_York",
    "nowISO": "2025-10-01T14:03:00Z",
    "view": { "start": "2025-10-06", "end": "2025-10-12" }
  },
  "messages": [
    { "role": "user", "content": "Find 30m free next week for Sam & me." }
  ]
}
```

---

## 18) Data flow for threads/messages/memory

### Recommended (server‑centric, simplest)

- **Threads:** **Upsert** on the **server**. The **client may specify **`` (UUID v4) to make the operation idempotent and **avoid UI re-renders**—the client doesn’t need to wait for a generated ID. If the thread already exists and belongs to the same user, upsert is a no-op; otherwise it inserts.
- **Messages:** Server persists both the **inbound user** message (on receive) and the **assistant** message (on send). This keeps the server the single source of truth.
- **Memory:** Server upserts via `POST /api/memory/:personaId` (merge/replace). Read during chat to build the system message.

**Sequence (explicit thread)**

1. Client → `POST /api/threads` with optional `threadId` → server upsert → `{ thread_id }` returned.
2. Client → `POST /api/chat/stream` with `{ threadId, personaId, runtimeContext, messages:[{role:'user',...}] }`.
3. Server:
   - Upsert `ai_threads` (idempotent)
   - Persist the last inbound **user** message
   - Load persona + memory → prepend **system** message
   - Run LangGraph → stream tokens
   - Persist **assistant** message

**Sequence (lazy thread)**

- Client generates `threadId` and includes it directly in `/api/chat/*`. Server upserts the thread on first call, persists user/assistant messages as above.

### Alternative (client‑RLS, offline‑first)

- Client writes `ai_threads` / `ai_messages` directly under RLS with Supabase JS; server mostly reads and appends assistant messages.
- **Trade‑offs:** duplicated validation, harder auditing/limits, more client complexity. Prefer server‑centric writes unless offline-first is required.



---

## Update — Persist all messages server‑side (users + assistant)

**Decision:** The server is the single source of truth. It **persists all inbound user messages** on each chat request and the **assistant message** it generates. To avoid duplicates when the client resends history, the client should attach a **stable **`` (UUID v4) per message; the server will de‑dupe on `message_id`.

### API + schema adjustments

- **Request message shape** (no breaking change; we add optional fields):
  ```ts
  type ChatMessage = {
    id?: string;                 // client-generated UUID (for de-dupe)
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: any;                // text or structured
    ts?: string;                 // optional client timestamp (ISO)
  }
  ```
- **Storage interface** now supports optional client IDs for de‑dupe:
  ```ts
  insertMessage(
    threadId: string,
    userId: string,
    role: Role,
    content: any,
    ts: string,
    id?: string,                // if provided, storage should upsert on this id
  ): Promise<void>;
  ```

### Supabase implementation

- Use **upsert** with `onConflict: 'message_id'` so re-sends don’t duplicate rows when a `message_id` is provided.
- If the client omits `id`, the DB will generate one as usual (duplicates are possible if you resend the same turn without an id).

### In-memory implementation

- Skip insert if an entry with the same `id` already exists in the thread’s array.

### Chat route behavior

- On **both** `/api/chat/stream` and `/api/chat/generate`:
  - **Before** invoking the graph, loop through the incoming `messages` and **persist every **``** message** using `insertMessage(...)` with the provided `id` (when present).
  - **After** the graph returns, persist the assistant reply as another message.

**Note on client behavior**

- For the simplest shape, send **only the newly typed user turn** in `messages` each call (no history). The server pulls any needed history from storage when you add that feature.
- If you do send history on each call, attach `` per message to guarantee idempotent upserts.

### OpenAPI note

- The `ChatMessage` schema in the OpenAPI spec now includes `id?: string` and `ts?: string` (both optional). No changes to existing clients are required.

