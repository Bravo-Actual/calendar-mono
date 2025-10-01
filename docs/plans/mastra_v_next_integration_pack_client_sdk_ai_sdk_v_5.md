# Overview
A complete, drop‑in update to use the **Mastra Client SDK** with the **vNext** chat API while keeping your current `useChat` UX. This pack provides:

- ✅ Typed Mastra client initializer
- ✅ **Custom AI SDK transport** wired to `agent.streamVNext(..., { format: 'aisdk' })`
- ✅ **Agent payload helpers** with a clean registry (per‑agent overrides)
- ✅ Minimal updates to your chat panel and agent selector
- ✅ **Runtime context per message** (small scalars, no headers) via `__runtime`
- ✅ Guidance for **large context** (instructions, traits, selections) handling

> vNext conventions in this pack
> - **Model settings** via `modelSettings` (temperature, topP, optional topK, etc.)
> - **Memory** via `memory.resource` (user id) and `memory.thread` (thread id + metadata)
> - **Runtime context** (tiny, per‑message) passed in options as `__runtime`, hydrated server‑side
> - **Large context** goes into `system` (instructions/traits) or message content (selections/ranges) or is hydrated server‑side by IDs

---

## 1) `src/lib/mastra-client.ts`
Initialize the Mastra **Client SDK** once and reuse it.

```ts
// src/lib/mastra-client.ts
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: process.env.NEXT_PUBLIC_AGENT_URL!,
  headers: () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('sb:token');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  },
});
```

---

## 2) `src/lib/agents/payloads.ts`
Helper module that builds the **correct vNext options** per agent. It assembles:
- `system` (instructions + traits text, if you choose client-side composition)
- `memory` (`resource` user id, `thread` id + optional metadata)
- `modelSettings` (temperature, **topP**, **topK** when supported, etc.)

```ts
// src/lib/agents/payloads.ts
export type Persona = {
  id: string;
  name?: string;
  instructions?: string | null;
  traits?: unknown; // text or object (will be stringified)
  temperature?: number | null;
  top_p?: number | null;  // camel-cased to topP in modelSettings
  top_k?: number | null;  // camel-cased to topK in modelSettings (model-specific)
  model_id?: string | null;
  avatar_url?: string | null;
  agent_id: string;
};

export type MemoryInput = {
  resource?: string;                 // user id
  threadId?: string;                 // conversation id
  threadMetadata?: Record<string, any>;
};

export type VNextCommonOptions = {
  format: 'aisdk';
  system?: string;
  memory?: {
    resource?: string;
    thread?: { id: string; metadata?: Record<string, any> };
  };
  modelSettings?: {
    temperature?: number;
    topP?: number;                   // maps from persona.top_p
    topK?: number;                   // maps from persona.top_k (provider-specific)
    // add other provider-specific knobs here as needed
  };
};

export type AgentSpecificOptions = Record<string, any>;
export type BuiltVNextOptions = VNextCommonOptions & AgentSpecificOptions;

// ---- Utilities ------------------------------------------------------------
function stringifyTraits(traits: unknown, maxLen = 8000): string {
  if (!traits) return '';
  const raw = typeof traits === 'string' ? traits : JSON.stringify(traits);
  return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw;
}

function buildSystem(instructions?: string | null, traits?: unknown): string | undefined {
  const instr = (instructions || '').trim();
  const traitText = stringifyTraits(traits);
  const sys = [instr, traitText ? `

# Persona Traits
${traitText}` : '']
    .filter(Boolean)
    .join('');
  return sys || undefined;
}

// ---- Agent builders -------------------------------------------------------
function baseOptions(persona: Persona | null, memory: MemoryInput): VNextCommonOptions {
  return {
    format: 'aisdk',
    system: buildSystem(persona?.instructions ?? null, persona?.traits ?? null),
    memory: {
      resource: memory.resource,
      thread: memory.threadId ? { id: memory.threadId, metadata: memory.threadMetadata } : undefined,
    },
    modelSettings: {
      temperature: persona?.temperature ?? undefined,
      topP: persona?.top_p ?? undefined,
      topK: persona?.top_k ?? undefined,
    },
  };
}

function buildCalendarAgent(persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  return {
    ...baseOptions(persona, memory),
    // tools: ['create_event', 'list_events'], // example
  };
}

function buildGeneralAssistant(persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  return {
    ...baseOptions(persona, memory),
  };
}

export const AGENT_BUILDERS: Record<string, (p: Persona | null, m: MemoryInput) => BuiltVNextOptions> = {
  calendar_assistant: buildCalendarAgent,
  general_assistant: buildGeneralAssistant,
};

export function buildVNextOptions(agentId: string, persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  const builder = AGENT_BUILDERS[agentId] ?? buildGeneralAssistant;
  return builder(persona, memory);
}
```ts
// src/lib/agents/payloads.ts
export type Persona = {
  id: string;
  name?: string;
  instructions?: string | null;
  temperature?: number | null;
  top_p?: number | null;
  model_id?: string | null;
  traits?: unknown;
  avatar_url?: string | null;
  agent_id: string; // Your persona system stores which agent to talk to
};

export type MemoryInput = {
  resource?: string; // usually the user id
  threadId?: string; // your active conversation id
  threadMetadata?: Record<string, any>;
};

export type VNextCommonOptions = {
  format: 'aisdk'; // keep AI SDK compatibility
  system?: string; // persona/system instructions
  memory?: {
    resource?: string;
    thread?: { id: string; metadata?: Record<string, any> };
  };
  modelSettings?: {
    temperature?: number;
    topP?: number;
  };
};

// Optional per-agent extra options (e.g., tools)
export type AgentSpecificOptions = Record<string, any>;

export type BuiltVNextOptions = VNextCommonOptions & AgentSpecificOptions;

// ---- Agent builders -------------------------------------------------------
function buildCalendarAgent(persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  return {
    format: 'aisdk',
    system: persona?.instructions || undefined,
    memory: {
      resource: memory.resource,
      thread: memory.threadId ? { id: memory.threadId, metadata: memory.threadMetadata } : undefined,
    },
    modelSettings: {
      temperature: persona?.temperature ?? undefined,
      topP: persona?.top_p ?? undefined,
    },
    // tools: [ 'create_event', 'list_events' ], // example
  };
}

function buildGeneralAssistant(persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  return {
    format: 'aisdk',
    system: persona?.instructions || undefined,
    memory: {
      resource: memory.resource,
      thread: memory.threadId ? { id: memory.threadId, metadata: memory.threadMetadata } : undefined,
    },
    modelSettings: {
      temperature: persona?.temperature ?? undefined,
      topP: persona?.top_p ?? undefined,
    },
  };
}

// ---- Registry -------------------------------------------------------------
export const AGENT_BUILDERS: Record<string, (p: Persona | null, m: MemoryInput) => BuiltVNextOptions> = {
  calendar_assistant: buildCalendarAgent,
  general_assistant: buildGeneralAssistant,
};

export function buildVNextOptions(agentId: string, persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  const builder = AGENT_BUILDERS[agentId] ?? buildGeneralAssistant;
  return builder(persona, memory);
}
```ts
// src/lib/agents/payloads.ts
export type Persona = {
  id: string;
  name?: string;
  instructions?: string | null;
  temperature?: number | null;
  top_p?: number | null;
  model_id?: string | null;
  traits?: unknown;
  avatar_url?: string | null;
  agent_id: string; // Your persona system stores which agent to talk to
};

export type MemoryInput = {
  resource?: string; // usually the user id
  threadId?: string; // your active conversation id
  threadMetadata?: Record<string, any>;
};

export type VNextCommonOptions = {
  system?: string;
  memory?: {
    resource?: string;
    thread?: { id: string; metadata?: Record<string, any> };
  };
  modelSettings?: {
    temperature?: number;
    topP?: number;
  };
  metadata?: Record<string, any>;
  // Keep format to aisdk for useChat compatibility
  format: 'aisdk';
};

// Optional per-agent extra options. E.g., tools, routing, etc.
export type AgentSpecificOptions = Record<string, any>;

export type BuiltVNextOptions = VNextCommonOptions & AgentSpecificOptions;

// ---- Agent builders -------------------------------------------------------
// Each builder receives the persona + memory and returns vNext options.
// Add new agents by adding more entries to AGENT_BUILDERS below.

function buildCalendarAgent(persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  return {
    format: 'aisdk',
    system: persona?.instructions || undefined,
    memory: {
      resource: memory.resource,
      thread: memory.threadId ? { id: memory.threadId, metadata: memory.threadMetadata } : undefined,
    },
    modelSettings: {
      temperature: persona?.temperature ?? undefined,
      topP: persona?.top_p ?? undefined,
    },
    metadata: {
      personaId: persona?.id,
      personaName: persona?.name,
      personaTraits: persona?.traits,
      personaAvatar: persona?.avatar_url,
      modelId: persona?.model_id,
      agentKind: 'calendar',
    },
    // Example: if your Calendar agent expects specialized metadata or tool config
    // tools: [ 'create_event', 'list_events' ],
  };
}

function buildGeneralAssistant(persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  return {
    format: 'aisdk',
    system: persona?.instructions || undefined,
    memory: {
      resource: memory.resource,
      thread: memory.threadId ? { id: memory.threadId, metadata: memory.threadMetadata } : undefined,
    },
    modelSettings: {
      temperature: persona?.temperature ?? undefined,
      topP: persona?.top_p ?? undefined,
    },
    metadata: {
      personaId: persona?.id,
      personaName: persona?.name,
      personaTraits: persona?.traits,
      personaAvatar: persona?.avatar_url,
      modelId: persona?.model_id,
      agentKind: 'general',
    },
  };
}

// ---- Registry -------------------------------------------------------------
export const AGENT_BUILDERS: Record<string, (p: Persona | null, m: MemoryInput) => BuiltVNextOptions> = {
  // Key by your agent ids in Mastra
  calendar_assistant: buildCalendarAgent,
  general_assistant: buildGeneralAssistant,
};

export function buildVNextOptions(agentId: string, persona: Persona | null, memory: MemoryInput): BuiltVNextOptions {
  const builder = AGENT_BUILDERS[agentId] ?? buildGeneralAssistant;
  return builder(persona, memory);
}
```

> If you prefer one file per agent, split `buildCalendarAgent`/`buildGeneralAssistant` into `src/lib/agents/calendar.ts`, `src/lib/agents/general.ts`, and re‑export a registry from `index.ts`. The rest of the app calls `buildVNextOptions(agentId, ...)` unchanged.

---

## 3) `src/lib/mastra-transport.ts`
**Custom AI SDK v5 transport** using the Client SDK. Supports **per-message runtime context** via a tiny `__runtime` object.

```ts
// src/lib/mastra-transport.ts
import type { ChatRequest, ChatResponseChunk, ChatTransport } from 'ai';
import { mastraClient } from './mastra-client';
import type { Persona, MemoryInput } from './agents/payloads';
import { buildVNextOptions } from './agents/payloads';

export type RuntimeOverrides = Partial<{
  personaId: string;
  personaName: string;
  timezone: string;                     // e.g., "America/New_York"
  nowISO: string;                        // current date/time ISO string
  calendarView: 'day' | 'week' | 'month' | 'agenda';
}>;

export function createMastraTransport(opts: {
  agentId: string;
  persona: Persona | null;
  memory: MemoryInput;
  getRuntimeOverrides?: () => RuntimeOverrides | undefined; // small scalars only
}): ChatTransport {
  return {
    async stream(request: ChatRequest): Promise<ReadableStream<ChatResponseChunk>> {
      const agent = mastraClient.getAgent(opts.agentId);
      const baseOptions = buildVNextOptions(opts.agentId, opts.persona, opts.memory);
      const options = { ...baseOptions, __runtime: opts.getRuntimeOverrides?.() } as any;
      const vnextStream = await agent.streamVNext(request.messages as any, options);
      return vnextStream.body as ReadableStream<ChatResponseChunk>;
    },

    async respond(request) {
      const agent = mastraClient.getAgent(opts.agentId);
      const baseOptions = buildVNextOptions(opts.agentId, opts.persona, opts.memory);
      const options = { ...baseOptions, __runtime: opts.getRuntimeOverrides?.() } as any;
      const result = await agent.generateVNext(request.messages as any, options);
      return new Response(result.body);
    },
  };
}
```ts
// src/lib/mastra-transport.ts
import type { ChatRequest, ChatResponseChunk, ChatTransport } from 'ai';
import { mastraClient } from './mastra-client';
import type { Persona, MemoryInput } from './agents/payloads';
import { buildVNextOptions } from './agents/payloads';

export function createMastraTransport(opts: {
  agentId: string;
  persona: Persona | null;
  memory: MemoryInput;
}): ChatTransport {
  return {
    async stream(request: ChatRequest): Promise<ReadableStream<ChatResponseChunk>> {
      const agent = mastraClient.getAgent(opts.agentId);
      const options = buildVNextOptions(opts.agentId, opts.persona, opts.memory);
      const vnextStream = await agent.streamVNext(request.messages as any, options);
      return vnextStream.body as ReadableStream<ChatResponseChunk>;
    },

    async respond(request) {
      const agent = mastraClient.getAgent(opts.agentId);
      const options = buildVNextOptions(opts.agentId, opts.persona, opts.memory);
      const result = await agent.generateVNext(request.messages as any, options);
      return new Response(result.body);
    },
  };
}
```ts
// src/lib/mastra-transport.ts
import type { ChatRequest, ChatResponseChunk, ChatTransport } from 'ai';
import { mastraClient } from './mastra-client';
import type { Persona, MemoryInput } from './agents/payloads';
import { buildVNextOptions } from './agents/payloads';

export function createMastraTransport(opts: {
  agentId: string;
  persona: Persona | null;
  memory: MemoryInput;
}): ChatTransport {
  return {
    async stream(request: ChatRequest): Promise<ReadableStream<ChatResponseChunk>> {
      const agent = mastraClient.getAgent(opts.agentId);

      // vNext with AI SDK v5 compatibility
      const options = buildVNextOptions(opts.agentId, opts.persona, opts.memory);

      // `request.messages` is already UIMessage[] in useChat
      const vnextStream = await agent.streamVNext(request.messages as any, options);

      // The SDK returns a Response-like stream that AI SDK can consume directly
      return vnextStream.body as ReadableStream<ChatResponseChunk>;
    },

    async respond(request) {
      const agent = mastraClient.getAgent(opts.agentId);
      const options = buildVNextOptions(opts.agentId, opts.persona, opts.memory);
      const result = await agent.generateVNext(request.messages as any, options);
      return new Response(result.body);
    },
  };
}
```

---

## 4) `src/components/AgentConversationSelector.tsx`
Your current component likely already selects the persona and conversation. If you want a minimal, typed baseline:

```tsx
// src/components/AgentConversationSelector.tsx
import * as React from 'react';

export type Conversation = { id: string; title?: string | null };
export type PersonaRef = { id: string; label: string; agent_id: string };

export function AgentConversationSelector(props: {
  personas: PersonaRef[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}) {
  const {
    personas,
    selectedPersonaId,
    onSelectPersona,
    conversations,
    activeConversationId,
    onSelectConversation,
  } = props;

  return (
    <div className="flex items-center gap-2">
      <select
        className="border rounded px-2 py-1"
        value={selectedPersonaId ?? ''}
        onChange={(e) => onSelectPersona(e.target.value)}
      >
        <option value="">Choose persona</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        className="border rounded px-2 py-1"
        value={activeConversationId ?? ''}
        onChange={(e) => onSelectConversation(e.target.value)}
      >
        <option value="">New conversation</option>
        {conversations.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title ?? c.id}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## 5) `src/components/AIAssistantPanel.tsx`
Update the panel to pass persona, memory, and **per-message runtime overrides**.

```tsx
// src/components/AIAssistantPanel.tsx
'use client';

import * as React from 'react';
import { useChat } from 'ai/react';
import { createMastraTransport } from '@/lib/mastra-transport';
import type { Persona } from '@/lib/agents/payloads';

export function AIAssistantPanel(props: {
  userId: string;
  personas: Persona[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  calendarView?: 'day' | 'week' | 'month' | 'agenda';
}) {
  const { userId, personas, selectedPersonaId, activeConversationId, calendarView } = props;

  const persona = React.useMemo(() => (
    personas.find((p) => p.id === selectedPersonaId) ?? null
  ), [personas, selectedPersonaId]);

  const agentId = persona?.agent_id ?? 'general_assistant';

  // Example: user-controlled timezone that can change per message
  const [tz, setTz] = React.useState<string | undefined>(undefined);

  const transport = React.useMemo(() => createMastraTransport({
    agentId,
    persona,
    memory: {
      resource: userId,
      threadId: activeConversationId ?? undefined,
      threadMetadata: persona?.id ? { personaId: persona.id } : undefined,
    },
    getRuntimeOverrides: () => ({
      personaId: persona?.id,
      personaName: persona?.name,
      timezone: tz,
      nowISO: new Date().toISOString(),
      calendarView: calendarView ?? 'week',
    }),
  }), [agentId, persona, userId, activeConversationId, tz, calendarView]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, reload } = useChat({
    experimental_transport: transport,
    id: activeConversationId ?? undefined,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Render messages and composer (omitted for brevity) */}
      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <input className="flex-1 border rounded px-3 py-2" value={input} onChange={handleInputChange} />
        <button type="submit" className="px-3 py-2 rounded bg-black text-white" disabled={isLoading}>Send</button>
        <button type="button" onClick={stop} className="px-2">Stop</button>
        <button type="button" onClick={reload} className="px-2">Reload</button>
      </form>
    </div>
  );
}
```tsx
// src/components/AIAssistantPanel.tsx
'use client';

import * as React from 'react';
import { useChat } from 'ai/react';
import { createMastraTransport } from '@/lib/mastra-transport';
import type { Persona } from '@/lib/agents/payloads';

export function AIAssistantPanel(props: {
  userId: string;
  personas: Persona[]; // your persona records
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
}) {
  const { userId, personas, selectedPersonaId, activeConversationId } = props;

  const persona = React.useMemo(() => {
    return personas.find((p) => p.id === selectedPersonaId) ?? null;
  }, [personas, selectedPersonaId]);

  const agentId = persona?.agent_id ?? 'general_assistant';

  const transport = React.useMemo(() => {
    return createMastraTransport({
      agentId,
      persona,
      memory: {
        resource: userId,
        threadId: activeConversationId ?? undefined,
        threadMetadata: persona?.id ? { personaId: persona.id } : undefined,
      },
    });
  }, [agentId, persona, userId, activeConversationId]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
  } = useChat({
    // Keep your existing onToolCall, onError, etc. if applicable
    api: undefined, // not used because we pass a custom transport
    experimental_throttle: 50,
    body: undefined, // not needed
    headers: undefined, // handled by SDK
    credentials: undefined,
    id: activeConversationId ?? undefined,
    experimental_transport: transport,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
            <div className="inline-block rounded px-3 py-2 bg-gray-100">
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={isLoading}
        >
          Send
        </button>
        <button type="button" onClick={stop} className="px-2">Stop</button>
        <button type="button" onClick={reload} className="px-2">Reload</button>
      </form>
    </div>
  );
}
```

> If your existing panel already implements message rendering, tool UIs, attachments, etc., keep those as-is. Only the `experimental_transport` and the persona/memory mapping are new.

---

## 6) (Optional) Server route instead of client SDK
If you prefer server-only SDK usage, expose a streaming route. The request body carries `__runtime`, `memory`, and your UI messages.

```ts
// app/api/chat/stream/route.ts (Next.js App Router example)
import { NextRequest } from 'next/server';
import { mastraClient } from '@/lib/mastra-client';
import { buildVNextOptions } from '@/lib/agents/payloads';

export async function POST(req: NextRequest) {
  const { agentId, messages, persona, memory, __runtime } = await req.json();
  const agent = mastraClient.getAgent(agentId);
  const base = buildVNextOptions(agentId, persona, memory);
  const stream = await agent.streamVNext(messages, { ...base, __runtime } as any);
  return new Response(stream.body);
}
```ts
// src/pages/api/chat/stream.ts (Next.js Pages) or app/api/chat/stream/route.ts (App Router)
import type { NextApiRequest, NextApiResponse } from 'next';
import { mastraClient } from '@/lib/mastra-client';
import { buildVNextOptions } from '@/lib/agents/payloads';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { agentId, messages, persona, memory } = JSON.parse(req.body as string);
    const agent = mastraClient.getAgent(agentId);
    const options = buildVNextOptions(agentId, persona, memory);
    const stream = await agent.streamVNext(messages, options);
    // Pipe stream according to your runtime; omitted for brevity
    // Edge runtime: return new Response(stream.body)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
```ts
// src/pages/api/chat/stream.ts (Next.js Pages) or app/api/chat/stream/route.ts (App Router)
import type { NextApiRequest, NextApiResponse } from 'next';
import { mastraClient } from '@/lib/mastra-client';
import { buildVNextOptions } from '@/lib/agents/payloads';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { agentId, messages, persona, memory } = JSON.parse(req.body as string);
    const agent = mastraClient.getAgent(agentId);
    const options = buildVNextOptions(agentId, persona, memory);

    const stream = await agent.streamVNext(messages, options);

    // Pipe the web stream to Node response
    // @ts-ignore - adapt for your runtime (edge / node)
    res.setHeader('Content-Type', 'text/event-stream');
    // If your framework provides a helper to send web streams, use that instead
    // For Node 18+, you can also use the Edge runtime and return new Response(stream.body)

    // Fallback simple piping (ensure flushing in your environment)
    // @ts-ignore
    stream.body.pipeTo(res as any);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
```

Then your panel would swap to:

```tsx
import { DefaultChatTransport } from 'ai';

const transport = React.useMemo(() => new DefaultChatTransport({
  api: '/api/chat/stream',
}), []);
```

…but the **preferred path** for you (given your current architecture) is the client‑side SDK with `createMastraTransport`.

---

## 7) Migration checklist
- [ ] Install `@mastra/client-js`
- [ ] Add `NEXT_PUBLIC_AGENT_URL`
- [ ] Add `src/lib/mastra-client.ts`
- [ ] Add/replace `src/lib/agents/payloads.ts` (now supports **temperature/topP/topK**, system+traits)
- [ ] Add `src/lib/mastra-transport.ts` (supports per-message **runtime overrides**)
- [ ] Update your panel to pass **calendarView/timezone** and persona ids via `getRuntimeOverrides`
- [ ] Ensure **memory** wiring: `resource = userId`, `thread.id = conversationId` (IDs only in metadata)
- [ ] For **large context** (traits/instructions/selections/ranges), either:
  - compose **system** server-side from personaId, or
  - keep client system small and pass **IDs**; hydrate server-side per request

---

## 8) Extending to additional agents
Add new functions (e.g., `buildResearchAgent`, `buildSalesAgent`) and register them in `AGENT_BUILDERS`. You can attach specialized tools or metadata per agent in those builders without changing any UI code.

```ts
function buildResearchAgent(persona: Persona | null, memory: MemoryInput) {
  return {
    format: 'aisdk',
    system: persona?.instructions || 'You are a focused research assistant.',
    memory: {
      resource: memory.resource,
      thread: memory.threadId ? { id: memory.threadId, metadata: memory.threadMetadata } : undefined,
    },
    modelSettings: {
      temperature: persona?.temperature ?? 0.7,
      topP: persona?.top_p ?? 1,
    },
    metadata: {
      personaId: persona?.id,
      modelId: persona?.model_id,
      agentKind: 'research',
    },
    // tools: ['web_search', 'citation_formatter'],
  } as const;
}
```

Register it:

```ts
AGENT_BUILDERS.research_assistant = buildResearchAgent;
```

---

## 8) Server middleware for runtime context + hydration
Read `__runtime` from the body each call, set small scalars into runtime context, and hydrate large context from IDs. Keep large objects out of runtime context.

```ts
// src/server/runtime-context.ts
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: { /* ... */ },
  server: {
    middleware: [
      async (ctx, next) => {
        const rc = ctx.get('runtimeContext');
        const body = await ctx.req.json().catch(() => ({} as any));
        const options = body?.options ?? body;

        // 1) Small per-message overrides
        const rt = options?.__runtime ?? {};
        for (const [k, v] of Object.entries(rt)) {
          if (v !== undefined && v !== null && v !== '') rc.set(k, v);
        }

        // 2) Hydrate big context from IDs stored in memory.thread.metadata
        const personaId = options?.memory?.thread?.metadata?.personaId;
        const pinnedSelectionIds: string[] = options?.memory?.thread?.metadata?.pinnedSelectionIds ?? [];

        const persona = personaId ? await db.personas.get(personaId) : null; // { instructions, traits, ... }
        const selections = pinnedSelectionIds.length ? await db.items.bulkGet(pinnedSelectionIds) : [];

        // Attach large hydrated data to ctx.state (NOT runtimeContext)
        (ctx.state as any).persona = persona;
        (ctx.state as any).selections = selections;

        await next();
      },
    ],
  },
});
```

## 9) Agent example (reads runtime context; composes system server-side if desired)
```ts
// src/agents/calendar-assistant.ts
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

export const calendarAssistant = new Agent({
  name: 'Calendar Assistant',
  instructions: ({ runtimeContext, context }) => {
    const tz = (runtimeContext.get('timezone') as string) || 'UTC';
    const locale = (runtimeContext.get('locale') as string) || 'en-US';

    // Option A: client already sent system (instructions + traits) — then just add small suffixes
    const baseFromClient = context.options?.system as string | undefined;

    // Option B: compose system entirely server-side from hydrated persona
    const persona = (context.state as any).persona || null;
    const serverBase = persona?.instructions || 'You help manage calendars.';
    const traits = persona?.traits ? `

# Persona Traits
${JSON.stringify(persona.traits).slice(0, 8000)}` : '';

    const base = baseFromClient || (serverBase + traits);
    return `${base}

Use timezone: ${tz}; locale: ${locale}.`;
  },
  model: ({ runtimeContext }) => {
    const tier = (runtimeContext.get('userTier') as string) || 'free';
    return tier === 'enterprise' ? openai('gpt-4.1') : openai('gpt-4.1-mini');
  },
});
```

## 10) File map
```
src/
  lib/
    mastra-client.ts
    mastra-transport.ts
    agents/
      payloads.ts
  components/
    AgentConversationSelector.tsx
    AIAssistantPanel.tsx
  server/
    runtime-context.ts
  pages/ (or app/)
    api/
      chat/
        stream.ts   // optional
```

