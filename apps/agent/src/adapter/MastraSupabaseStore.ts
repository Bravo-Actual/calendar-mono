import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { extractTextForEmbedding } from "./text.js";
import { splitResourceId, makeResourceId, type StorageThreadType, type MastraMessageV2, type MastraMessageV1 } from "./mapping.js";
import type { Telemetry } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/di";
import type { IMastraLogger } from "@mastra/core/logger";

export type Embedder = (texts: string[]) => Promise<number[][]>;

// Simple memory type for our custom methods
export type MastraMemory = {
  id: string;
  resourceId: string;
  type: string;
  content: string;
  contentJson?: any;
  importance?: string;
  createdAt: Date;
};

// Content normalization helpers
type Part = { type: string; [k: string]: any };

function sanitizePart(p: any): Part {
  if (!p || typeof p !== "object") return { type: "text", text: String(p ?? "") };
  if (!p.type && typeof p.text === "string") return { type: "text", text: p.text };
  if (p.type === "text") return { type: "text", text: String(p.text ?? "") };
  if (p.type === "function_call") {
    return { type: "function_call", name: String(p.name ?? ""), arguments: p.arguments ?? {} };
  }
  if (p.type === "tool") {
    return { type: "tool", name: String(p.name ?? ""), toolCallId: String(p.toolCallId ?? ""), args: p.args ?? {} };
  }
  return p as Part;
}

function normalizeContent(raw: unknown): Part[] {
  if (Array.isArray(raw)) return raw.map(sanitizePart);
  if (typeof raw === "string") return [{ type: "text", text: raw }];
  if (raw && typeof raw === "object") return [sanitizePart(raw)];
  return [];
}

type Ctor = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  getToken?: () => Promise<string>;  // Optional: caller's Supabase JWT (RLS) - for "user" mode
  embed?: Embedder;                  // Optional: embeddings
  mode?: "user" | "service";         // "user" = JWT auth (default), "service" = service role
  serviceKey?: string;               // Service role key (for "service" mode)
  runtimeContext?: RuntimeContext<any>; // Optional: runtime context for extracting JWT
};

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

type Ins<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export class MastraSupabaseStore {
  private url: string;
  private anon: string;
  private getToken?: () => Promise<string>;
  private embed?: Embedder;
  private mode: "user" | "service";
  private serviceKey?: string;
  private runtimeContext?: RuntimeContext<any>;

  // Match MastraBase interface
  protected logger?: IMastraLogger;
  protected telemetry?: Telemetry;

  constructor(opts: Ctor) {
    this.url = opts.supabaseUrl;
    this.anon = opts.supabaseAnonKey;
    this.getToken = opts.getToken;
    this.embed = opts.embed;
    this.mode = opts.mode || "user";
    this.serviceKey = opts.serviceKey;
    this.runtimeContext = opts.runtimeContext;
  }

  // Feature flags getter matching PostgresStore pattern
  get supports() {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      aiTracing: false,
      indexManagement: false,
      getScoresBySpan: false,
    };
  }

  async init(): Promise<void> {
    // No-op: Supabase tables already exist via migrations
  }

  __setTelemetry(telemetry: Telemetry): void {
    this.telemetry = telemetry;
  }

  __setLogger(logger: IMastraLogger): void {
    this.logger = logger;
  }

  // ---------- Table Operations (stubbed - not used) ----------

  async createTable(_args: { tableName: any; schema: Record<string, any> }): Promise<void> {
    throw new Error('createTable not implemented - tables managed via Supabase migrations');
  }

  async clearTable(_args: { tableName: any }): Promise<void> {
    throw new Error('clearTable not implemented');
  }

  async dropTable(_args: { tableName: any }): Promise<void> {
    throw new Error('dropTable not implemented');
  }

  async alterTable(_args: { tableName: any; schema: Record<string, any>; ifNotExists: string[] }): Promise<void> {
    throw new Error('alterTable not implemented - tables managed via Supabase migrations');
  }

  async insert(_args: { tableName: any; record: Record<string, any> }): Promise<void> {
    throw new Error('insert not implemented - use domain-specific methods');
  }

  async batchInsert(_args: { tableName: any; records: Record<string, any>[] }): Promise<void> {
    throw new Error('batchInsert not implemented - use domain-specific methods');
  }

  async load<R>(_args: { tableName: any; keys: Record<string, any> }): Promise<R | null> {
    throw new Error('load not implemented - use domain-specific methods');
  }

  // ---------- Tracing (stubbed - not used) ----------

  async batchTraceInsert(_args: { records: Record<string, any>[] }): Promise<void> {
    // No-op: tracing not implemented
  }

  async getTraces(_args: any): Promise<any[]> {
    return [];
  }

  async getTracesPaginated(_args: any): Promise<any> {
    return { traces: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  }

  // ---------- Workflows (stubbed - not used) ----------

  async updateWorkflowResults(_args: any): Promise<void> {
    // No-op: workflows not implemented
  }

  async updateWorkflowState(_args: any): Promise<void> {
    // No-op: workflows not implemented
  }

  async getWorkflowRuns(_args?: any): Promise<any> {
    return { runs: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  }

  async getWorkflowRunById(_args: any): Promise<any> {
    return null;
  }

  async loadWorkflowSnapshot({ workflowName, runId }: { workflowName: string; runId: string }): Promise<any> {
    // Workflows not implemented - return null so agent can start fresh
    return null;
  }

  async persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot }: { workflowName: string; runId: string; resourceId?: string; snapshot: any }): Promise<void> {
    // Workflows not implemented - no-op
  }

  // ---------- Scores (stubbed - not used) ----------

  async getScoreById(_args: { id: string }): Promise<any> {
    return null;
  }

  async saveScore(_score: any): Promise<any> {
    throw new Error('saveScore not implemented');
  }

  async getScoresByScorerId(_args: any): Promise<any> {
    return { scores: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  }

  async getScoresByRunId(_args: any): Promise<any> {
    return { scores: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  }

  async getScoresByEntityId(_args: any): Promise<any> {
    return { scores: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  }

  // ---------- Evals (stubbed - not used) ----------

  async getEvals(_options?: any): Promise<any> {
    return { evals: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  }

  async getEvalsByAgentName(_agentName: string, _type?: 'test' | 'live'): Promise<any[]> {
    return [];
  }

  // ---------- Pagination variants ----------

  async getThreadsByResourceIdPaginated(args: { resourceId: string; page: number; perPage: number }): Promise<any> {
    const threads = await this.getThreadsByResourceId({ resourceId: args.resourceId });
    const start = (args.page - 1) * args.perPage;
    const paginated = threads.slice(start, start + args.perPage);
    return {
      threads: paginated,
      pagination: {
        page: args.page,
        perPage: args.perPage,
        total: threads.length,
        totalPages: Math.ceil(threads.length / args.perPage),
      },
    };
  }

  async getMessagesPaginated(args: any): Promise<any> {
    const messages = await this.getMessages(args);
    return {
      messages,
      pagination: {
        page: 1,
        perPage: messages.length,
        total: messages.length,
        totalPages: 1,
      },
    };
  }

  async getMessagesById(_args: { messageIds: string[]; format?: 'v1' | 'v2' }): Promise<any[]> {
    return [];
  }

  async updateMessages(_args: { messages: any[] }): Promise<any[]> {
    throw new Error('updateMessages not implemented');
  }

  async updateThread(args: { id: string; title: string; metadata: Record<string, unknown> }): Promise<StorageThreadType> {
    const sb = await this.sb();
    const { data, error } = await sb
      .from("ai_threads")
      .update({
        title: args.title,
        metadata: JSON.stringify(args.metadata),
      })
      .eq("thread_id", args.id)
      .select("*")
      .single();
    if (error) throw error;
    return this._toThread(data);
  }

  private async sb(): Promise<SupabaseClient<Database>> {
    if (this.mode === "service") {
      // Service role mode: bypasses RLS (use for Memory API)
      // Security: Mastra auth middleware ensures resourceId matches authenticated user
      if (!this.serviceKey) {
        throw new Error('Service role key required for service mode');
      }
      return createClient<Database>(this.url, this.serviceKey, {
        auth: { persistSession: false, detectSessionInUrl: false },
      });
    }

    // User mode: JWT auth with RLS (use for agent calls)
    // Try runtime context first, then fall back to getToken
    let token: string | null = null;

    if (this.runtimeContext) {
      token = this.runtimeContext.get('jwt-token') as string | null;
    }

    if (!token && this.getToken) {
      token = await this.getToken();
    }

    if (!token) {
      throw new Error('No JWT token available: neither runtimeContext nor getToken provided a token');
    }

    return createClient<Database>(this.url, this.anon, {
      auth: { persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  // ---------- Threads ----------

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const sb = await this.sb();
    const { data, error } = await sb.from("ai_threads").select("*").eq("thread_id", threadId).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows
      throw error;
    }
    return this._toThread(data);
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    // Get userId, personaId, and threadId from runtime context (preferred) or fallback
    let userId: string | undefined;
    let personaId: string | null = null;
    let threadId: string | undefined;

    if (this.runtimeContext) {
      userId = this.runtimeContext.get('user-id') as string | undefined;
      personaId = this.runtimeContext.get('persona-id') as string || null;
      threadId = this.runtimeContext.get('threadId') as string | undefined;
    }

    if (!userId) {
      const split = splitResourceId(thread.resourceId);
      userId = split.userId;
      personaId = split.personaId;
    }

    if (!threadId) {
      threadId = thread.id;
    }

    const sb = await this.sb();

    // Use timestamps from thread object if available, otherwise let DB set defaults
    const payload: any = {
      thread_id: threadId,
      user_id: userId,
      persona_id: personaId ?? null,
      title: thread.title ?? null,
      metadata: thread.metadata ? JSON.stringify(thread.metadata) : null,
    };

    // Only include timestamps if thread object has them
    if (thread.createdAt) {
      payload.created_at = thread.createdAt.toISOString();
      payload.created_at_z = thread.createdAt.toISOString();
    }
    if (thread.updatedAt) {
      payload.updated_at = thread.updatedAt.toISOString();
      payload.updated_at_z = thread.updatedAt.toISOString();
    }

    const { data, error } = await sb.from("ai_threads").upsert(payload, {
      onConflict: 'thread_id'
    }).select("*").single();

    if (error) throw error;
    return this._toThread(data);
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const sb = await this.sb();
    const { error } = await sb.from("ai_threads").delete().eq("thread_id", threadId);
    if (error) throw error;
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const sb = await this.sb();
    const { data, error } = await sb
      .from("ai_threads")
      .select("*")
      .eq("resource_key", resourceId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map(this._toThread);
  }

  // ---------- Messages ----------

  async getMessages({ threadId, limit }: { threadId: string; limit?: number; format?: 'v1' | 'v2' }): Promise<MastraMessageV2[]> {
    const sb = await this.sb();
    let q = sb
      .from("ai_messages")
      .select("message_id,thread_id,role,content,type,created_at,created_at_z")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(this._toMessage);
  }

  async saveMessages({ messages, format }: { messages: MastraMessageV2[]; format?: 'v1' | 'v2' }): Promise<MastraMessageV2[]> {
    if (!messages.length) return [];
    const sb = await this.sb();

    // Get userId and personaId from runtime context (required)
    const userId = this.runtimeContext?.get('user-id') as string;
    const personaId = this.runtimeContext?.get('persona-id') as string;

    if (!userId || !personaId) {
      throw new Error('userId and personaId must be provided in runtime context for saveMessages');
    }

    if (!format) {
      throw new Error('format parameter is required for saveMessages');
    }

    // Mastra provides message IDs - use upsert like PostgresStore does
    const rows: Ins<"ai_messages">[] = messages.map(m => ({
      message_id: m.id, // Use Mastra-provided ID
      thread_id: m.threadId!,
      user_id: userId,
      persona_id: personaId,
      role: m.role,
      content: JSON.stringify(m.content.parts),
      type: format,
    }));

    const { data, error } = await sb
      .from("ai_messages")
      .upsert(rows, { onConflict: 'message_id' })
      .select("message_id,thread_id,role,content,type,created_at,created_at_z");

    if (error) throw error;
    return (data as any[]).map(this._toMessage);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    const sb = await this.sb();
    const { error } = await sb.from("ai_messages").delete().in("message_id", messageIds);
    if (error) throw error;
  }

  // ---------- Semantic recall (messages) ----------

  async searchMessages(opts: {
    scope: "thread" | "resource";
    threadId?: string;
    resourceId?: string;
    query: string;
    topK?: number;
    neighborRange?: number;
  }): Promise<MastraMessageV2[]> {
    const sb = await this.sb();

    if (!this.embed) {
      // text fallback - content is TEXT (JSON stringified)
      const base = await this._selectMessagesForScope(sb, opts);
      const q = opts.query.toLowerCase();
      return base.filter((r) => {
        try {
          const parsed = JSON.parse(r.content);
          const txt = extractTextForEmbedding(Array.isArray(parsed) ? parsed : [parsed]);
          return txt.toLowerCase().includes(q);
        } catch {
          return r.content.toLowerCase().includes(q);
        }
      }).map(this._toMessage);
    }

    const [qv] = await this.embed([opts.query]);
    const { data, error } = await sb.rpc("ai_search_messages_vector", {
      p_query: qv as unknown as any,
      p_thread_id: opts.scope === "thread" ? opts.threadId : undefined,
      p_resource_key: opts.scope === "resource" ? opts.resourceId : undefined,
      p_top_k: opts.topK ?? 8,
    });
    if (error) throw error;

    const hits = (data ?? []).map((r: any) => ({ ...this._toMessage(r), similarity: r.similarity }));
    if (!opts.neighborRange || opts.neighborRange <= 0) return hits;

    // neighbor expansion (simple in-memory pass)
    const threadIds = Array.from(new Set(hits.map((h) => h.threadId).filter((id): id is string => !!id)));
    const expanded: MastraMessageV2[] = [];
    for (const tid of threadIds) {
      const all = await this.getMessages({ threadId: tid });
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
    return [...dedup.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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

  // ---------- Durable / working memory (custom methods) ----------

  async saveCustomMemory(args: {
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

  async searchCustomMemories(args: {
    userId: string;
    personaId: string;
    query?: string;
    topK?: number;
    useVectors?: boolean;
  }): Promise<MastraMemory[]> {
    const sb = await this.sb();

    if (args.useVectors && this.embed) {
      // TODO: Implement RPC ai_search_memories_vector for semantic search
      // const [qv] = await this.embed([args.query ?? ""]);
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

  // ---------- Resource Methods (Mastra interface - uses ai_memory for storage) ----------

  // Mastra interface methods (keep for compatibility)
  async getResourceById({ resourceId }: { resourceId: string }): Promise<any> {
    const { userId, personaId } = splitResourceId(resourceId);
    if (!personaId) throw new Error(`Invalid resourceId: ${resourceId} - personaId is required`);
    return this.getMemory({ userId, personaId });
  }

  async saveResource({ resource }: { resource: any }): Promise<any> {
    const { userId, personaId } = splitResourceId(resource.id);
    if (!personaId) throw new Error(`Invalid resourceId: ${resource.id} - personaId is required`);
    return this.saveMemory({ userId, personaId, workingMemory: resource.workingMemory, metadata: resource.metadata });
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    const { userId, personaId } = splitResourceId(resourceId);
    if (!personaId) throw new Error(`Invalid resourceId: ${resourceId} - personaId is required`);
    return this.updateMemory({ userId, personaId, workingMemory, metadata });
  }

  // Client-facing methods (accept userId and personaId separately)
  async getMemory({ userId, personaId }: { userId: string; personaId: string }): Promise<any> {
    const sb = await this.sb();
    const resourceId = makeResourceId(userId, personaId);

    const { data, error } = await sb
      .from("ai_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .eq("memory_type", "working")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows
      throw error;
    }

    return {
      id: resourceId,
      workingMemory: data.content || undefined,
      metadata: data.content_json || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async saveMemory({ userId, personaId, workingMemory, metadata }: {
    userId: string;
    personaId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    const sb = await this.sb();
    const resourceId = makeResourceId(userId, personaId);

    const payload: any = {
      user_id: userId,
      persona_id: personaId,
      memory_type: 'working',
      content: workingMemory || '',
      content_json: metadata || null,
    };

    const { data, error } = await sb
      .from("ai_memory")
      .upsert(payload)
      .select("*")
      .single();

    if (error) throw error;

    return {
      id: resourceId,
      workingMemory: data.content || undefined,
      metadata: data.content_json || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateMemory({
    userId,
    personaId,
    workingMemory,
    metadata
  }: {
    userId: string;
    personaId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    const sb = await this.sb();
    const resourceId = makeResourceId(userId, personaId);

    const updates: any = {};
    if (workingMemory !== undefined) updates.content = workingMemory;
    if (metadata !== undefined) updates.content_json = metadata;

    if (Object.keys(updates).length === 0) {
      return this.getMemory({ userId, personaId });
    }

    const { data, error } = await sb
      .from("ai_memory")
      .update(updates)
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .eq("memory_type", "working")
      .select("*")
      .single();

    if (error) throw error;

    return {
      id: resourceId,
      workingMemory: data.content || undefined,
      metadata: data.content_json || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  // ---------- Mappers ----------

  private _toThread = (r: Row<"ai_threads">): StorageThreadType => ({
    id: r.thread_id,
    title: r.title || undefined,
    resourceId: r.resource_key!,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  });

  private _toMessage = (r: Pick<Row<"ai_messages">, "message_id"|"thread_id"|"role"|"content"|"created_at"> & { similarity?: number }): MastraMessageV2 => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.content);
    } catch {
      parsed = r.content;
    }

    return {
      id: r.message_id,
      threadId: r.thread_id,
      role: r.role as 'user' | 'assistant' | 'system',
      content: {
        format: 2 as const,
        parts: normalizeContent(parsed) as unknown,
      } as any,
      createdAt: new Date(r.created_at),
    };
  };

  private _toMemory = (r: Row<"ai_memory">): MastraMemory => ({
    id: r.memory_id,
    resourceId: r.resource_key!,
    type: r.memory_type,
    content: r.content,
    contentJson: r.content_json ?? undefined,
    importance: r.importance ?? "normal",
    createdAt: new Date(r.created_at),
  });
}
