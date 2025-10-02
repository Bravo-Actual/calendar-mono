# calendar-ai — Express Server Plan v2 (LangGraph 0.4.9, Supabase, OpenRouter)

**Updated for:**
- LangGraph 0.4.9 with Annotation.Root API
- Latest stable dependencies as of January 2025
- Zod v4.x compatibility

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
- TypeScript 5.5+
- **Express 5.1.0**
- **LangChain JS 0.3.35**
- **LangGraph JS 0.4.9** (uses Annotation.Root API)
- **@langchain/core 0.3.78**
- **@langchain/openai 0.6.14**
- **Supabase JS 2.58.0**
- **Zod 4.1.11** (v4 required for zod-to-openapi 8.x)
- swagger-ui-express 5.0.1
- @asteasolutions/zod-to-openapi 8.1.0

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
├─ package.json
├─ tsconfig.json
├─ .env.example
└─ README.md
```

**Notes**
- Keep **tools** pure and stateless; pass user/thread context through inputs.
- All **DB writes** (threads/messages/memory) happen server-side in routes using `storage/*`.
- Client may generate `threadId` and per-message `id` (UUIDv4) for idempotency; server upserts.

---

## 2) package.json

```json
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
    "langchain": "^0.3.35",
    "@langchain/core": "^0.3.78",
    "@langchain/openai": "^0.6.14",
    "@langchain/langgraph": "^0.4.9",
    "@supabase/supabase-js": "^2.58.0",
    "zod": "^4.1.11",
    "swagger-ui-express": "^5.0.1",
    "@asteasolutions/zod-to-openapi": "^8.1.0"
  },
  "devDependencies": {
    "tsup": "^8.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.5.0",
    "@types/express": "^5.0.0",
    "@types/swagger-ui-express": "^4.1.6"
  }
}
```

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
import { env } from "../env.js";
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
import { env } from "../env.js";

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

## 7) LangGraph orchestrator (Annotation.Root API for 0.4.9)

**IMPORTANT:** LangGraph 0.4.9 requires using `Annotation.Root` for state definition. Use `MessagesAnnotation` for messages to get proper append/merge semantics instead of overwriting.

```ts
// src/graph/index.ts
import {
  StateGraph,
  START,
  END,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import type { BaseMessageLike } from "@langchain/core/messages";
import { makeLLM } from "../llm/openrouter.js";
import { ALL_TOOLS } from "./tools/index.js";

// Define state using Annotation.Root (recommended for 0.4.x)
const State = Annotation.Root({
  messages: MessagesAnnotation, // ✅ append/merge semantics for chat
  runtime: Annotation<Record<string, unknown> | undefined>(),
  result: Annotation<string | undefined>(),
});

export type GraphState = typeof State.State;

const llm = makeLLM().bindTools(ALL_TOOLS);

export const graph = new StateGraph(State)
  .addNode("decide", async (s: GraphState) => {
    const res = await llm.invoke(s.messages as BaseMessageLike[]);
    const text =
      typeof res.content === "string"
        ? res.content
        : JSON.stringify(res.content);
    return { result: text }; // ✅ partial state update
  })
  .addEdge(START, "decide")
  .addEdge("decide", END)
  .compile();
```

> **Note:** Later you can swap in a plan→act(tool loop)→respond multi-node graph and stream tokens/steps.

---

## 8) Local LangChain tools

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
    const local = now.toLocaleString(undefined, { timeZone: tz, hour12: false });
    return JSON.stringify({ nowISO, epochMs: now.getTime(), timezone: tz, local });
  },
});
```

```ts
// src/graph/tools/index.ts
export { getCurrentDateTime } from "./time.js";
export const ALL_TOOLS = [getCurrentDateTime];
```

---

## 9) Storage interface + implementations

```ts
// src/storage/types.ts
export type Role = "user" | "assistant" | "tool" | "system";
export type Message = { id: string; role: Role; content: any; ts: string };

export interface Storage {
  ensureReady(): Promise<void>;
  upsertThread(threadId: string, userId: string, personaId?: string | null, title?: string | null, metadata?: any): Promise<void>;
  insertMessage(threadId: string, userId: string, role: Role, content: any, ts: string, id?: string): Promise<void>;
  listMessages(threadId: string, limit?: number): Promise<Message[]>;
  getMemory(userId: string, personaId: string): Promise<any | null>;
  upsertMemory(userId: string, personaId: string, content: any): Promise<{ updated_at: string }>;
}
```

```ts
// src/storage/memory.ts
import { Storage, Role, Message } from "./types.js";

export class MemoryStorage implements Storage {
  private threads = new Map<string, { userId: string; personaId?: string | null; title?: string | null; metadata?: any }>();
  private messages = new Map<string, Message[]>();
  private memory = new Map<string, any>();

  async ensureReady() {}

  async upsertThread(threadId: string, userId: string, personaId?: string | null, title?: string | null, metadata?: any) {
    this.threads.set(threadId, { userId, personaId, title, metadata });
  }

  async insertMessage(threadId: string, userId: string, role: Role, content: any, ts: string, id?: string) {
    const arr = this.messages.get(threadId) ?? [];
    if (id && arr.some(m => m.id === id)) return;
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
import { env } from "../env.js";
import { Storage, Role, Message } from "./types.js";

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
import { env } from "../env.js";
import { MemoryStorage } from "./memory.js";
import { SupabaseStorage } from "./supabase.js";

export const storage = env.DB_MODE === "supabase" ? new SupabaseStorage() : new MemoryStorage();
```

---

## 10) Chat routes (SSE & non-stream)

```ts
// src/routes/chat.ts
import { Router } from "express";
import { graph, type GraphState } from "../graph/index.js";
import { storage } from "../storage/index.js";

export const chat = Router();

const sse = (data: unknown, event = "message") => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function loadPersonaAndMemory(req: any, personaId?: string) {
  if (!personaId) return { system: null };

  const { data: persona } = await req.supabase
    .from("ai_personas")
    .select("name,instructions,traits")
    .eq("id", personaId)
    .maybeSingle();

  const { data: mem } = await req.supabase
    .from("ai_memory")
    .select("content")
    .eq("user_id", req.user.id)
    .eq("persona_id", personaId)
    .maybeSingle();

  const buildSystem = (p: any, runtime: any, memory: any) => {
    const lines: string[] = [];
    if (p?.name) lines.push(`You are ${p.name}.`);
    if (p?.instructions) lines.push(String(p?.instructions));
    if (p?.traits) lines.push(String(p?.traits));

    const tz = runtime?.timezone ?? "UTC";
    const nowISO = runtime?.nowISO ?? new Date().toISOString();

    lines.push(`Current time: ${nowISO}.`);
    lines.push(`Timezone: ${tz}.`);

    if (memory?.content) {
      lines.push(`# User preferences\n${JSON.stringify(memory.content)}`);
    }

    lines.push(`# Operating rules
- Execute tools silently; do not narrate steps.
- Prefer concise, plain language.
- Never expose internal IDs.`);

    return lines.filter(Boolean).join("\n\n");
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
  if (threadId) await storage.upsertThread(threadId, user.id, personaId, null, {});

  const { system } = await loadPersonaAndMemory(req, personaId);
  const systemMsg = system ? [{ role: "system" as const, content: system(runtimeContext) }] : [];

  if (threadId && Array.isArray(messages)) {
    for (const m of messages) {
      if (m.role === "user") {
        await storage.insertMessage(threadId, user.id, "user", m.content, m.ts ?? new Date().toISOString(), (m as any).id);
      }
    }
  }

  res.write(sse({ type: "start" }, "start"));

  try {
    const result = await graph.invoke({
      messages: [...systemMsg, ...messages],
      runtime: runtimeContext
    });

    if (threadId) {
      await storage.insertMessage(threadId, user.id, "assistant", { type: "text", text: result.result ?? "" }, new Date().toISOString());
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
  const systemMsg = system ? [{ role: "system" as const, content: system(runtimeContext) }] : [];

  if (threadId && Array.isArray(messages)) {
    for (const m of messages) {
      if (m.role === "user") {
        await storage.insertMessage(threadId, user.id, "user", m.content, m.ts ?? new Date().toISOString(), (m as any).id);
      }
    }
  }

  const result = await graph.invoke({ messages: [...systemMsg, ...messages], runtime: runtimeContext });

  if (threadId) {
    await storage.insertMessage(threadId, user.id, "assistant", { type: "text", text: result.result ?? "" }, new Date().toISOString());
  }

  res.json({ text: result.result ?? "" });
});
```

---

## 11) Threads, Messages, Memory routes

```ts
// src/routes/threads.ts
import { Router } from "express";
import { storage } from "../storage/index.js";

export const threads = Router();

threads.post("/", async (req: any, res) => {
  const { threadId, personaId, title, metadata } = req.body ?? {};
  const id = threadId || crypto.randomUUID();
  await storage.upsertThread(id, req.user.id, personaId ?? null, title ?? null, metadata ?? {});
  res.status(201).json({ thread_id: id });
});

threads.get("/", async (_req, res) => {
  res.json({ items: [] });
});
```

```ts
// src/routes/messages.ts
import { Router } from "express";
import { storage } from "../storage/index.js";

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
import { storage } from "../storage/index.js";

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
import { env } from "./env.js";
import { supabaseAuth } from "./auth/supabase.js";
import { chat } from "./routes/chat.js";
import { threads } from "./routes/threads.js";
import { messages } from "./routes/messages.js";
import { memory } from "./routes/memory.js";
import { openapiDoc } from "./openapi/spec.js";

const app = express();

app.use(express.json());

// Public routes
app.get("/health", (_req, res) => res.json({ ok: true }));

// Protected routes
app.use("/api/chat", supabaseAuth, chat);
app.use("/api/threads", supabaseAuth, threads);
app.use("/api/messages", supabaseAuth, messages);
app.use("/api/memory", supabaseAuth, memory);

// API docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

app.listen(Number(env.PORT), () => console.log(`calendar-ai on :${env.PORT}`));
```

---

## 13) OpenAPI (zod-to-openapi)

```ts
// src/openapi/spec.ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

const registry = new OpenAPIRegistry();

const ChatMessage = z.object({
  id: z.string().uuid().optional(),
  role: z.enum(["user","assistant","tool","system"]),
  content: z.any(),
  ts: z.string().datetime().optional()
});

const StreamBody = z.object({
  threadId: z.string().optional(),
  personaId: z.string().optional(),
  messages: z.array(ChatMessage),
  runtimeContext: z.record(z.any()).optional()
});

registry.registerPath({
  method: "post",
  path: "/api/chat/stream",
  request: { body: { content: { "application/json": { schema: StreamBody } } } },
  responses: { 200: { description: "SSE stream" } }
});

export const openapiDoc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: { title: "Calendar AI", version: "2.0.0" }
});
```

---

## Key Changes from v1

1. **LangGraph State Definition:** Uses `Annotation.Root` instead of `StateGraph<T>()` (required for 0.4.9)
2. **Import Extensions:** All imports use `.js` extensions (ES modules requirement)
3. **Zod v4:** Updated to Zod 4.1.11 (required by zod-to-openapi 8.x)
4. **Type Safety:** Exported `GraphState` type from graph/index.ts for use in routes
5. **Simplified Persona Query:** Fixed persona query to use `id` column instead of `persona_id`

---

## Database Requirements

The existing migration `20240924120000_users_and_ai.sql` already includes:
- `ai_threads` table
- `ai_messages` table
- `ai_memory` table with UNIQUE(user_id, persona_id)
- `ai_personas` table
- RLS policies
- Indexes

**No new migrations required.**
