import type { Telemetry } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/di';
import type { IMastraLogger } from '@mastra/core/logger';
import type { ScoreRowData } from '@mastra/core/scores';
import {
  MastraStorage,
  type AISpanRecord,
  type AITraceRecord,
  type AITracesPaginatedArg,
  type CreateIndexOptions,
  type EvalRow,
  type IndexInfo,
  type PaginationInfo,
  type StorageDomains,
  type StorageGetMessagesArg,
  type StorageIndexStats,
  type StorageResourceType,
  type StoragePagination,
  type WorkflowRun,
  type WorkflowRuns,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Database, Json } from '@repo/supabase';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MastraMessageV1 } from '@mastra/core/memory';
import {
  type MastraMessageV2,
  makeResourceId,
  type StorageThreadType,
  splitResourceId,
} from './mapping.js';
import { extractTextForEmbedding } from './text.js';

export type Embedder = (texts: string[]) => Promise<number[][]>;

// Runtime context type for extracting user/persona/JWT
type StoreRuntimeContext = {
  'jwt-token'?: string;
  'user-id'?: string;
  'persona-id'?: string;
  [key: string]: unknown;
};

// Simple memory type for our custom methods
export type MastraMemory = {
  id: string;
  resourceId: string;
  type: string;
  content: string;
  contentJson?: Json;
  importance?: string;
  createdAt: Date;
};

// Content normalization helpers
type Part = { type: string; [k: string]: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizePart(p: any): Part {
  if (!p || typeof p !== 'object') return { type: 'text', text: String(p ?? '') };
  if (!p.type && typeof p.text === 'string') return { type: 'text', text: p.text };
  if (p.type === 'text') return { type: 'text', text: String(p.text ?? '') };
  if (p.type === 'function_call') {
    return { type: 'function_call', name: String(p.name ?? ''), arguments: p.arguments ?? {} };
  }
  if (p.type === 'tool') {
    return {
      type: 'tool',
      name: String(p.name ?? ''),
      toolCallId: String(p.toolCallId ?? ''),
      args: p.args ?? {},
    };
  }
  return p as Part;
}

function normalizeContent(raw: unknown): Part[] {
  if (Array.isArray(raw)) return raw.map(sanitizePart);
  if (typeof raw === 'string') return [{ type: 'text', text: raw }];
  if (raw && typeof raw === 'object') return [sanitizePart(raw)];
  return [];
}

type Ctor = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  getToken?: () => Promise<string>; // Optional: caller's Supabase JWT (RLS) - for "user" mode
  embed?: Embedder; // Optional: embeddings
  mode?: 'user' | 'service'; // "user" = JWT auth (default), "service" = service role
  serviceKey?: string; // Service role key (for "service" mode)
  runtimeContext?: RuntimeContext<StoreRuntimeContext>; // Optional: runtime context for extracting JWT
};

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

type Ins<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];

export class MastraSupabaseStore extends MastraStorage {
  private url: string;
  private anon: string;
  private getToken?: () => Promise<string>;
  private embed?: Embedder;
  private mode: 'user' | 'service';
  private serviceKey?: string;
  private runtimeContext?: RuntimeContext<StoreRuntimeContext>;
  private _currentFormat: 'v1' | 'v2' = 'v2'; // Track current format for message mapping

  constructor(opts: Ctor) {
    super({ name: 'MastraSupabaseStore' });
    this.url = opts.supabaseUrl;
    this.anon = opts.supabaseAnonKey;
    this.getToken = opts.getToken;
    this.embed = opts.embed;
    this.mode = opts.mode || 'user';
    this.serviceKey = opts.serviceKey;
    this.runtimeContext = opts.runtimeContext;

    // Initialize stores after parent constructor
    this.stores = {
      legacyEvals: this as any,
      operations: this as any,
      workflows: this as any,
      scores: this as any,
      traces: this as any,
      memory: this as any,
      observability: this as any,
    };
  }

  // Feature flags getter matching PostgresStore pattern
  get supports() {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      aiTracing: true, // Now supported
      indexManagement: false,
      getScoresBySpan: true, // Now supported
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

  async createTable(_args: { tableName: string; schema: Record<string, unknown> }): Promise<void> {
    throw new Error('createTable not implemented - tables managed via Supabase migrations');
  }

  async clearTable(_args: { tableName: string }): Promise<void> {
    throw new Error('clearTable not implemented');
  }

  async dropTable(_args: { tableName: string }): Promise<void> {
    throw new Error('dropTable not implemented');
  }

  async alterTable(_args: {
    tableName: string;
    schema: Record<string, unknown>;
    ifNotExists: string[];
  }): Promise<void> {
    throw new Error('alterTable not implemented - tables managed via Supabase migrations');
  }

  async insert(_args: { tableName: string; record: Record<string, unknown> }): Promise<void> {
    throw new Error('insert not implemented - use domain-specific methods');
  }

  async batchInsert(_args: { tableName: string; records: Record<string, unknown>[] }): Promise<void> {
    throw new Error('batchInsert not implemented - use domain-specific methods');
  }

  async load<R>(_args: { tableName: string; keys: Record<string, unknown> }): Promise<R | null> {
    throw new Error('load not implemented - use domain-specific methods');
  }

  // ---------- AI Tracing / Observability ----------

  async createAISpan(span: AISpanRecord): Promise<void> {
    const sb = await this.sb();

    const payload = {
      trace_id: span.traceId,
      span_id: span.spanId,
      parent_span_id: span.parentSpanId || null,
      name: span.name,
      scope: (span.scope as Json) || null,
      span_type: span.spanType,
      attributes: (span.attributes as Json) || null,
      metadata: (span.metadata as Json) || null,
      links: span.links as Json,
      input: (span.input as Json) || null,
      output: (span.output as Json) || null,
      error: (span.error as Json) || null,
      started_at: span.startedAt.toISOString(),
      ended_at: span.endedAt ? span.endedAt.toISOString() : null,
      is_event: span.isEvent,
      // createdAt and updatedAt are set by DB defaults
    };

    const { error } = await sb.from('ai_spans').insert(payload);
    if (error) throw error;
  }

  async updateAISpan({
    spanId,
    traceId,
    updates,
  }: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    const sb = await this.sb();

    const payload: Record<string, any> = {};
    if (updates.parentSpanId !== undefined) payload.parent_span_id = updates.parentSpanId;
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.scope !== undefined) payload.scope = updates.scope as Json;
    if (updates.spanType !== undefined) payload.span_type = updates.spanType;
    if (updates.attributes !== undefined) payload.attributes = updates.attributes as Json;
    if (updates.metadata !== undefined) payload.metadata = updates.metadata as Json;
    if (updates.links !== undefined) payload.links = updates.links as Json;
    if (updates.input !== undefined) payload.input = updates.input as Json;
    if (updates.output !== undefined) payload.output = updates.output as Json;
    if (updates.error !== undefined) payload.error = updates.error as Json;
    if (updates.startedAt !== undefined) payload.started_at = updates.startedAt.toISOString();
    if (updates.endedAt !== undefined) payload.ended_at = updates.endedAt ? updates.endedAt.toISOString() : null;
    if (updates.isEvent !== undefined) payload.is_event = updates.isEvent;
    // createdAt and updatedAt handled by DB

    const { error } = await sb
      .from('ai_spans')
      .update(payload)
      .eq('trace_id', traceId)
      .eq('span_id', spanId);

    if (error) throw error;
  }

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    const sb = await this.sb();

    const { data, error } = await sb
      .from('ai_spans')
      .select('*')
      .eq('trace_id', traceId)
      .order('started_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return {
      traceId,
      spans: data.map(this._toAISpanRecord),
    };
  }

  async getAITracesPaginated({
    filters,
    pagination,
  }: AITracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    const sb = await this.sb();
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 50;
    const offset = (page - 1) * perPage;

    let query = sb
      .from('ai_spans')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (filters?.name) query = query.eq('name', filters.name);
    if (filters?.spanType) query = query.eq('span_type', filters.spanType);
    if (filters?.entityId) {
      query = query.contains('attributes', { entityId: filters.entityId });
    }
    if (filters?.entityType) {
      query = query.contains('attributes', { entityType: filters.entityType });
    }

    if (pagination?.dateRange?.start) {
      query = query.gte('started_at', pagination.dateRange.start.toISOString());
    }
    if (pagination?.dateRange?.end) {
      query = query.lte('started_at', pagination.dateRange.end.toISOString());
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      pagination: {
        total: count ?? 0,
        page,
        perPage,
        hasMore: (count ?? 0) > offset + perPage,
      },
      spans: (data ?? []).map(this._toAISpanRecord),
    };
  }

  async batchCreateAISpans({ records }: { records: AISpanRecord[] }): Promise<void> {
    const sb = await this.sb();

    const payloads = records.map((span) => ({
      trace_id: span.traceId,
      span_id: span.spanId,
      parent_span_id: span.parentSpanId || null,
      name: span.name,
      scope: (span.scope as Json) || null,
      span_type: span.spanType,
      attributes: (span.attributes as Json) || null,
      metadata: (span.metadata as Json) || null,
      links: span.links as Json,
      input: (span.input as Json) || null,
      output: (span.output as Json) || null,
      error: (span.error as Json) || null,
      started_at: span.startedAt.toISOString(),
      ended_at: span.endedAt ? span.endedAt.toISOString() : null,
      is_event: span.isEvent,
      // createdAt and updatedAt are set by DB defaults
    }));

    const { error } = await sb.from('ai_spans').insert(payloads);
    if (error) throw error;
  }

  async batchUpdateAISpans({
    records,
  }: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    // Supabase doesn't support batch updates with different values per row
    // Process sequentially
    for (const record of records) {
      await this.updateAISpan({
        spanId: record.spanId,
        traceId: record.traceId,
        updates: record.updates,
      });
    }
  }

  async batchDeleteAITraces({ traceIds }: { traceIds: string[] }): Promise<void> {
    const sb = await this.sb();
    const { error } = await sb.from('ai_spans').delete().in('trace_id', traceIds);
    if (error) throw error;
  }

  // Legacy trace methods (kept for compatibility)
  async batchTraceInsert(_args: { records: Record<string, unknown>[] }): Promise<void> {
    // No-op: legacy tracing not implemented, use AI spans instead
  }

  async getTraces(_args: unknown): Promise<Trace[]> {
    return [];
  }

  async getTracesPaginated(_args: unknown): Promise<PaginationInfo & { traces: Trace[] }> {
    return { traces: [], total: 0, page: 1, perPage: 50, hasMore: false };
  }

  // ---------- Workflows ----------

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    runtimeContext?: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName, runId });
    if (!snapshot) {
      throw new Error(`Workflow snapshot not found: ${workflowName}/${runId}`);
    }

    const state = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    if (!state.results) state.results = {};
    state.results[stepId] = result;

    await this.persistWorkflowSnapshot({ workflowName, runId, snapshot: state });
    return state.results;
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName, runId });
    const state = snapshot ? (typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot) : {};

    Object.assign(state, {
      status: opts.status,
      ...(opts.result && { result: opts.result }),
      ...(opts.error && { error: opts.error }),
      ...(opts.suspendedPaths && { suspendedPaths: opts.suspendedPaths }),
      ...(opts.waitingPaths && { waitingPaths: opts.waitingPaths }),
    });

    await this.persistWorkflowSnapshot({ workflowName, runId, snapshot: state });
    return state as WorkflowRunState;
  }

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit = 50,
    offset = 0,
    resourceId,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  } = {}): Promise<WorkflowRuns> {
    const sb = await this.sb();
    let query = sb
      .from('ai_workflow_snapshot')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (workflowName) query = query.eq('workflow_name', workflowName);
    if (resourceId) query = query.eq('resource_id', resourceId);
    if (fromDate) query = query.gte('created_at', fromDate.toISOString());
    if (toDate) query = query.lte('created_at', toDate.toISOString());

    const { data, error, count } = await query;
    if (error) throw error;

    const runs: WorkflowRun[] = (data ?? []).map((row) => ({
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: row.snapshot,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resourceId: row.resource_id || undefined,
    }));

    return { runs, total: count ?? 0 };
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    const sb = await this.sb();
    let query = sb.from('ai_workflow_snapshot').select('*').eq('run_id', runId);

    if (workflowName) {
      query = query.eq('workflow_name', workflowName);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      workflowName: data.workflow_name,
      runId: data.run_id,
      snapshot: data.snapshot,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      resourceId: data.resource_id || undefined,
    };
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const sb = await this.sb();
    const { data, error } = await sb
      .from('ai_workflow_snapshot')
      .select('snapshot')
      .eq('workflow_name', workflowName)
      .eq('run_id', runId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Snapshot is stored as TEXT (JSON string), parse it
    return typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const sb = await this.sb();

    // Serialize snapshot as JSON string (table expects TEXT)
    const snapshotStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);

    const { error } = await sb.from('ai_workflow_snapshot').upsert(
      {
        workflow_name: workflowName,
        run_id: runId,
        resource_id: resourceId || null,
        snapshot: snapshotStr,
      },
      { onConflict: 'workflow_name,run_id' }
    );

    if (error) throw error;
  }

  // ---------- Scores ----------

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    const sb = await this.sb();
    const { data, error } = await sb.from('ai_scorers').select('*').eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this._toScoreRow(data);
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    const sb = await this.sb();

    // Generate ID if not provided (ScoreRowData may have id, but it's optional in practice)
    const id = score.id || `score_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const payload = {
      id,
      scorer_id: score.scorerId,
      trace_id: score.traceId || null,
      span_id: score.spanId || null,
      run_id: score.runId,
      scorer: score.scorer as Json,
      preprocess_step_result: (score.preprocessStepResult as Json) || null,
      extract_step_result: (score.extractStepResult as Json) || null,
      analyze_step_result: (score.analyzeStepResult as Json) || null,
      score: score.score,
      reason: score.reason || null,
      metadata: (score.metadata as Json) || null,
      preprocess_prompt: score.preprocessPrompt || null,
      extract_prompt: score.extractPrompt || null,
      generate_score_prompt: score.generateScorePrompt || null,
      generate_reason_prompt: score.generateReasonPrompt || null,
      analyze_prompt: score.analyzePrompt || null,
      reason_prompt: score.reasonPrompt || null,
      input: score.input as Json,
      output: score.output as Json,
      additional_context: (score.additionalContext as Json) || null,
      runtime_context: (score.runtimeContext as Json) || null,
      entity_type: score.entityType || null,
      entity: (score.entity as Json) || null,
      entity_id: score.entityId || null,
      source: score.source,
      resource_id: score.resourceId || null,
      thread_id: score.threadId || null,
    };

    const { data, error } = await sb.from('ai_scorers').insert(payload).select('*').single();

    if (error) throw error;
    return { score: this._toScoreRow(data) };
  }

  async getScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const sb = await this.sb();
    const offset = (pagination.page - 1) * pagination.perPage;

    let query = sb
      .from('ai_scorers')
      .select('*', { count: 'exact' })
      .eq('scorer_id', scorerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.perPage - 1);

    if (entityId) query = query.eq('entity_id', entityId);
    if (entityType) query = query.eq('entity_type', entityType);
    if (source) query = query.eq('source', source);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      pagination: {
        total: count ?? 0,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: (count ?? 0) > offset + pagination.perPage,
      },
      scores: (data ?? []).map(this._toScoreRow),
    };
  }

  async getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const sb = await this.sb();
    const offset = (pagination.page - 1) * pagination.perPage;

    const { data, error, count } = await sb
      .from('ai_scorers')
      .select('*', { count: 'exact' })
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.perPage - 1);

    if (error) throw error;

    return {
      pagination: {
        total: count ?? 0,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: (count ?? 0) > offset + pagination.perPage,
      },
      scores: (data ?? []).map(this._toScoreRow),
    };
  }

  async getScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const sb = await this.sb();
    const offset = (pagination.page - 1) * pagination.perPage;

    const { data, error, count } = await sb
      .from('ai_scorers')
      .select('*', { count: 'exact' })
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.perPage - 1);

    if (error) throw error;

    return {
      pagination: {
        total: count ?? 0,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: (count ?? 0) > offset + pagination.perPage,
      },
      scores: (data ?? []).map(this._toScoreRow),
    };
  }

  async getScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const sb = await this.sb();
    const offset = (pagination.page - 1) * pagination.perPage;

    const { data, error, count} = await sb
      .from('ai_scorers')
      .select('*', { count: 'exact' })
      .eq('trace_id', traceId)
      .eq('span_id', spanId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.perPage - 1);

    if (error) throw error;

    return {
      pagination: {
        total: count ?? 0,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: (count ?? 0) > offset + pagination.perPage,
      },
      scores: (data ?? []).map(this._toScoreRow),
    };
  }

  // ---------- Evals ----------

  async getEvals(options?: {
    agentName?: string;
    type?: 'test' | 'live';
    dateRange?: { start?: Date; end?: Date };
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const sb = await this.sb();
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 50;
    const offset = (page - 1) * perPage;

    let query = sb
      .from('ai_evals')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (options?.agentName) {
      query = query.eq('agent_name', options.agentName);
    }

    if (options?.type === 'test') {
      query = query.not('test_info', 'is', null);
    } else if (options?.type === 'live') {
      query = query.is('test_info', null);
    }

    if (options?.dateRange?.start) {
      query = query.gte('created_at', options.dateRange.start.toISOString());
    }
    if (options?.dateRange?.end) {
      query = query.lte('created_at', options.dateRange.end.toISOString());
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      evals: (data ?? []).map(this._toEvalRow),
      total: count ?? 0,
      page,
      perPage,
      hasMore: (count ?? 0) > offset + perPage,
    };
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    const sb = await this.sb();
    let query = sb
      .from('ai_evals')
      .select('*')
      .eq('agent_name', agentName)
      .order('created_at', { ascending: false });

    if (type === 'test') {
      query = query.not('test_info', 'is', null);
    } else if (type === 'live') {
      query = query.is('test_info', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map(this._toEvalRow);
  }

  // ---------- Pagination variants ----------

  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
    orderBy?: 'createdAt' | 'updatedAt';
    sortDirection?: 'ASC' | 'DESC';
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const threads = await this.getThreadsByResourceId({
      resourceId: args.resourceId,
      orderBy: args.orderBy,
      sortDirection: args.sortDirection,
    });
    const start = (args.page - 1) * args.perPage;
    const paginated = threads.slice(start, start + args.perPage);
    return {
      threads: paginated,
      total: threads.length,
      page: args.page,
      perPage: args.perPage,
      hasMore: (args.page * args.perPage) < threads.length,
    };
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' }
  ): Promise<PaginationInfo & { messages: MastraMessageV2[] }> {
    const messages = await this.getMessages(args);
    return {
      messages,
      total: messages.length,
      page: 1,
      perPage: messages.length,
      hasMore: false,
    };
  }

  async getMessagesById({ messageIds, format = 'v2' }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    if (!messageIds.length) return [];
    this._currentFormat = format; // Store format for _toMessage mapper

    const sb = await this.sb();
    const { data, error } = await sb
      .from('ai_messages')
      .select('message_id,thread_id,role,content,type,created_at,created_at_z')
      .in('message_id', messageIds)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(this._toMessage) as any;
  }

  async updateMessages({ messages }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & { id: string })[];
  }): Promise<MastraMessageV2[]> {
    if (!messages.length) return [];

    const sb = await this.sb();
    const updated: MastraMessageV2[] = [];

    for (const msg of messages) {
      const updates: Record<string, any> = {};

      // Update role if provided
      if (msg.role !== undefined) {
        updates.role = msg.role;
      }

      // Update content if provided
      if (msg.content !== undefined) {
        // MastraMessageV2 uses content.parts structure
        if ((msg.content as any)?.parts !== undefined) {
          updates.content = JSON.stringify((msg.content as any).parts);
        }
      }

      // Only update if there are changes
      if (Object.keys(updates).length === 0) {
        // Fetch existing message without updates
        const { data, error } = await sb
          .from('ai_messages')
          .select('message_id,thread_id,role,content,type,created_at,created_at_z')
          .eq('message_id', msg.id)
          .single();

        if (error) throw error;
        if (data) updated.push(this._toMessage(data));
        continue;
      }

      // Perform update
      const { data, error } = await sb
        .from('ai_messages')
        .update(updates)
        .eq('message_id', msg.id)
        .select('message_id,thread_id,role,content,type,created_at,created_at_z')
        .single();

      if (error) throw error;
      if (data) updated.push(this._toMessage(data));
    }

    return updated;
  }

  async updateThread(args: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const sb = await this.sb();
    const { data, error } = await sb
      .from('ai_threads')
      .update({
        title: args.title,
        metadata: JSON.stringify(args.metadata),
      })
      .eq('thread_id', args.id)
      .select('*')
      .single();
    if (error) throw error;
    return this._toThread(data);
  }

  async close(): Promise<void> {
    // Supabase clients don't require explicit cleanup
    // This method exists for compatibility with PostgresStore interface
    return Promise.resolve();
  }

  // ---------- Index Management (Not Supported) ----------

  async createIndex(options: CreateIndexOptions): Promise<void> {
    throw new Error(
      `Index management not supported by MastraSupabaseStore. ` +
      `Use Supabase migrations to create indexes. ` +
      `Attempted to create index "${options.name}" on table "${options.table}"`
    );
  }

  async dropIndex(indexName: string): Promise<void> {
    throw new Error(
      `Index management not supported by MastraSupabaseStore. ` +
      `Use Supabase migrations to drop indexes. ` +
      `Attempted to drop index "${indexName}"`
    );
  }

  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    throw new Error(
      `Index management not supported by MastraSupabaseStore. ` +
      `Use Supabase Studio or pg catalog queries to list indexes` +
      (tableName ? ` for table "${tableName}"` : '')
    );
  }

  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    throw new Error(
      `Index management not supported by MastraSupabaseStore. ` +
      `Use Supabase Studio or pg catalog queries to view index stats ` +
      `for index "${indexName}"`
    );
  }

  private async sb(): Promise<SupabaseClient<Database>> {
    if (this.mode === 'service') {
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
      throw new Error(
        'No JWT token available: neither runtimeContext nor getToken provided a token'
      );
    }

    return createClient<Database>(this.url, this.anon, {
      auth: { persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  // ---------- Threads ----------

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const sb = await this.sb();
    const { data, error } = await sb
      .from('ai_threads')
      .select('*')
      .eq('thread_id', threadId)
      .single();
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
      personaId = (this.runtimeContext.get('persona-id') as string) || null;
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

    const { data, error } = await sb
      .from('ai_threads')
      .upsert(payload, {
        onConflict: 'thread_id',
      })
      .select('*')
      .single();

    if (error) throw error;
    return this._toThread(data);
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const sb = await this.sb();
    const { error } = await sb.from('ai_threads').delete().eq('thread_id', threadId);
    if (error) throw error;
  }

  async getThreadsByResourceId({
    resourceId,
    orderBy = 'updatedAt',
    sortDirection = 'DESC',
  }: {
    resourceId: string;
    orderBy?: 'createdAt' | 'updatedAt';
    sortDirection?: 'ASC' | 'DESC';
  }): Promise<StorageThreadType[]> {
    const sb = await this.sb();
    const orderColumn = orderBy === 'createdAt' ? 'created_at' : 'updated_at';
    const ascending = sortDirection === 'ASC';

    const { data, error } = await sb
      .from('ai_threads')
      .select('*')
      .eq('resource_id', resourceId)
      .order(orderColumn, { ascending })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map(this._toThread);
  }

  // ---------- Messages ----------

  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const { threadId, resourceId, selectBy, format = 'v2' } = args;
    this._currentFormat = format; // Store format for _toMessage mapper

    // Handle selectBy.vectorSearchString for semantic search
    if (selectBy?.vectorSearchString && this.embed) {
      const topK = selectBy.last !== false ? (selectBy.last || 10) : 10;
      return this.searchMessages({
        scope: 'thread',
        threadId,
        query: selectBy.vectorSearchString,
        topK,
      });
    }

    const sb = await this.sb();
    let q = sb
      .from('ai_messages')
      .select('message_id,thread_id,role,content,type,created_at,created_at_z')
      .eq('thread_id', threadId);

    // Handle resourceId scoping if provided
    if (resourceId) {
      q = q.eq('resource_id', resourceId);
    }

    // Handle selectBy.include for context expansion
    if (selectBy?.include && selectBy.include.length > 0) {
      const messageIds: string[] = [];
      for (const inc of selectBy.include) {
        messageIds.push(inc.id);
      }
      q = q.in('message_id', messageIds);
    }

    // Apply ordering
    q = q.order('created_at', { ascending: true });

    // Handle selectBy.last for limiting (default behavior)
    const effectiveLimit = selectBy?.last !== false ? (selectBy?.last || undefined) : undefined;
    if (effectiveLimit) {
      q = q.limit(effectiveLimit);
    }

    const { data, error } = await q;
    if (error) throw error;

    let messages = (data ?? []).map(this._toMessage);

    // Handle selectBy.include context expansion (withPreviousMessages, withNextMessages)
    if (selectBy?.include && selectBy.include.length > 0) {
      const expandedMessages = new Map<string, typeof messages[number]>();

      for (const msg of messages) {
        expandedMessages.set(msg.id, msg);
      }

      // Fetch additional context messages
      for (const inc of selectBy.include) {
        if (inc.withPreviousMessages || inc.withNextMessages) {
          const targetMsg = messages.find(m => m.id === inc.id);
          if (targetMsg) {
            // Fetch previous messages
            if (inc.withPreviousMessages) {
              const { data: prevData } = await sb
                .from('ai_messages')
                .select('message_id,thread_id,role,content,type,created_at,created_at_z')
                .eq('thread_id', threadId)
                .lt('created_at', targetMsg.createdAt)
                .order('created_at', { ascending: false })
                .limit(inc.withPreviousMessages);

              if (prevData) {
                for (const pm of prevData.map(this._toMessage)) {
                  expandedMessages.set(pm.id, pm);
                }
              }
            }

            // Fetch next messages
            if (inc.withNextMessages) {
              const { data: nextData } = await sb
                .from('ai_messages')
                .select('message_id,thread_id,role,content,type,created_at,created_at_z')
                .eq('thread_id', threadId)
                .gt('created_at', targetMsg.createdAt)
                .order('created_at', { ascending: true })
                .limit(inc.withNextMessages);

              if (nextData) {
                for (const nm of nextData.map(this._toMessage)) {
                  expandedMessages.set(nm.id, nm);
                }
              }
            }
          }
        }
      }

      // Return all unique messages sorted by createdAt
      messages = Array.from(expandedMessages.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return messages;
  }

  async saveMessages(args: {
    messages: MastraMessageV1[] | MastraMessageV2[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const { messages, format = 'v2' } = args;
    if (!messages.length) return [];
    const sb = await this.sb();

    // Get userId and personaId from runtime context (required)
    const userId = this.runtimeContext?.get('user-id') as string;
    const personaId = this.runtimeContext?.get('persona-id') as string;

    if (!userId || !personaId) {
      throw new Error('userId and personaId must be provided in runtime context for saveMessages');
    }

    // Consolidate consecutive reasoning parts before saving
    const consolidatedMessages = messages.map((m: any) => {
      if (!m.content?.parts || !Array.isArray(m.content.parts)) return m;

      const consolidatedParts: any[] = [];
      let reasoningBuffer: string[] = [];

      for (const part of m.content.parts) {
        if (part.type === 'reasoning') {
          // Collect reasoning text from v4 or v5 format
          const text = part.text || part.reasoning || part.details?.[0]?.text || '';
          if (text) reasoningBuffer.push(text);
        } else {
          // Flush accumulated reasoning in v4 format for Mastra compatibility
          if (reasoningBuffer.length > 0) {
            const reasoningText = reasoningBuffer.join('');
            consolidatedParts.push({
              type: 'reasoning',
              reasoning: reasoningText,
              details: [{ type: 'text', text: reasoningText }],
            });
            reasoningBuffer = [];
          }
          // Add non-reasoning part
          consolidatedParts.push(part);
        }
      }

      // Flush any remaining reasoning in v4 format for Mastra compatibility
      if (reasoningBuffer.length > 0) {
        const reasoningText = reasoningBuffer.join('');
        consolidatedParts.push({
          type: 'reasoning',
          reasoning: reasoningText,
          details: [{ type: 'text', text: reasoningText }],
        });
      }

      return {
        ...m,
        content: {
          ...m.content,
          parts: consolidatedParts,
        },
      };
    });

    // Mastra provides message IDs - use upsert like PostgresStore does
    const rows: Ins<'ai_messages'>[] = consolidatedMessages.map((m: any) => ({
      message_id: m.id, // Use Mastra-provided ID
      thread_id: m.threadId!,
      user_id: userId,
      persona_id: personaId,
      role: m.role,
      content: JSON.stringify(m.content?.parts ?? m.content),
      type: format,
    }));

    const { data, error } = await sb
      .from('ai_messages')
      .upsert(rows, { onConflict: 'message_id' })
      .select('message_id,thread_id,role,content,type,created_at,created_at_z');

    if (error) throw error;
    return (data as any[]).map(this._toMessage) as any;
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    const sb = await this.sb();
    const { error } = await sb.from('ai_messages').delete().in('message_id', messageIds);
    if (error) throw error;
  }

  // ---------- Semantic recall (messages) ----------

  async searchMessages(opts: {
    scope: 'thread' | 'resource';
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
      return base
        .filter((r) => {
          try {
            const parsed = JSON.parse(r.content);
            const txt = extractTextForEmbedding(Array.isArray(parsed) ? parsed : [parsed]);
            return txt.toLowerCase().includes(q);
          } catch {
            return r.content.toLowerCase().includes(q);
          }
        })
        .map(this._toMessage);
    }

    const [qv] = await this.embed([opts.query]);
    const { data, error } = await sb.rpc('ai_search_messages_vector', {
      p_query: qv as unknown as any,
      p_thread_id: opts.scope === 'thread' ? opts.threadId : undefined,
      p_resource_id: opts.scope === 'resource' ? opts.resourceId : undefined,
      p_top_k: opts.topK ?? 8,
    });
    if (error) throw error;

    const hits = (data ?? []).map((r: any) => ({
      ...this._toMessage(r),
      similarity: r.similarity,
    }));
    if (!opts.neighborRange || opts.neighborRange <= 0) return hits;

    // neighbor expansion (simple in-memory pass)
    const threadIds = Array.from(
      new Set(hits.map((h) => h.threadId).filter((id): id is string => !!id))
    );
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
    opts: { scope: 'thread' | 'resource'; threadId?: string; resourceId?: string }
  ) {
    let q = sb
      .from('ai_messages')
      .select('message_id,thread_id,role,content,created_at')
      .order('created_at', { ascending: true });
    if (opts.scope === 'thread' && opts.threadId) q = q.eq('thread_id', opts.threadId);
    if (opts.scope === 'resource' && opts.resourceId) q = q.eq('resource_id', opts.resourceId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Row<'ai_messages'>[];
  }

  // ---------- Durable / working memory (custom methods) ----------

  async saveCustomMemory(args: {
    userId: string;
    personaId: string;
    memoryType: string;
    content: string;
    contentJson?: any;
    importance?: 'low' | 'normal' | 'high' | 'critical';
    sourceThreadId?: string | null;
    embed?: boolean;
  }): Promise<MastraMemory> {
    const sb = await this.sb();
    let vec: number[] | null = null;
    if (args.embed && this.embed) {
      try {
        [vec] = await this.embed([args.content]);
      } catch {
        vec = null;
      }
    }

    const payload: Ins<'ai_memory'> = {
      user_id: args.userId,
      persona_id: args.personaId,
      memory_type: args.memoryType,
      content: args.content,
      content_json: args.contentJson ?? null,
      importance: args.importance ?? 'normal',
      source_thread_id: args.sourceThreadId ?? null,
      content_embedding: vec as unknown as any,
    };

    const { data, error } = await sb.from('ai_memory').insert(payload).select('*').single();
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
        .from('ai_memory')
        .select('*')
        .eq('user_id', args.userId)
        .eq('persona_id', args.personaId)
        .not('content_embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(args.topK ?? 10);
      if (error) throw error;
      return (data ?? []).map(this._toMemory);
    }

    // text fallback
    const { data, error } = await sb
      .from('ai_memory')
      .select('*')
      .eq('user_id', args.userId)
      .eq('persona_id', args.personaId)
      .order('created_at', { ascending: false })
      .limit(args.topK ?? 10);
    if (error) throw error;
    const rows = (data ?? []).filter(
      (r) => !args.query || `${r.content}`.toLowerCase().includes((args.query ?? '').toLowerCase())
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
    const base: Partial<Ins<'ai_metadata'>> = { key, value };
    if (target.threadId) base.thread_id = target.threadId;
    if (target.messageId) base.message_id = target.messageId;
    if (target.memoryId) base.memory_id = target.memoryId;
    if (target.personaRef) base.persona_ref = target.personaRef;

    const insert = await sb
      .from('ai_metadata')
      .insert(base as any)
      .select('metadata_id')
      .single();
    if (!insert.error) return; // success

    // Unique violation → update row (if you kept the per-target unique indexes)
    if ((insert.error as any).code === '23505') {
      let q = sb.from('ai_metadata').update({ value });
      if (target.threadId) q = q.eq('thread_id', target.threadId);
      if (target.messageId) q = q.eq('message_id', target.messageId);
      if (target.memoryId) q = q.eq('memory_id', target.memoryId);
      if (target.personaRef) q = q.eq('persona_ref', target.personaRef);
      q = q.eq('key', key);
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
    let q = sb.from('ai_metadata').select('value').eq('key', key).limit(1);
    if (target.threadId) q = q.eq('thread_id', target.threadId);
    if (target.messageId) q = q.eq('message_id', target.messageId);
    if (target.memoryId) q = q.eq('memory_id', target.memoryId);
    if (target.personaRef) q = q.eq('persona_ref', target.personaRef);
    const { data, error } = await q;
    if (error) throw error;
    return data?.[0]?.value ?? null;
  }

  // ---------- Resource Methods (Mastra interface - uses ai_memory for storage) ----------

  // Mastra interface methods (keep for compatibility)
  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const { userId, personaId } = splitResourceId(resourceId);
    if (!personaId) throw new Error(`Invalid resourceId: ${resourceId} - personaId is required`);
    return this.getMemory({ userId, personaId });
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    const { userId, personaId } = splitResourceId(resource.id);
    if (!personaId) throw new Error(`Invalid resourceId: ${resource.id} - personaId is required`);
    return this.saveMemory({
      userId,
      personaId,
      workingMemory: resource.workingMemory,
      metadata: resource.metadata,
    });
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    const { userId, personaId } = splitResourceId(resourceId);
    if (!personaId) throw new Error(`Invalid resourceId: ${resourceId} - personaId is required`);
    return this.updateMemory({ userId, personaId, workingMemory, metadata });
  }

  // Client-facing methods (accept userId and personaId separately)
  async getMemory({ userId, personaId }: { userId: string; personaId: string }): Promise<StorageResourceType | null> {
    const sb = await this.sb();
    const resourceId = makeResourceId(userId, personaId);

    const { data, error } = await sb
      .from('ai_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('memory_type', 'working')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows
      throw error;
    }

    return {
      id: resourceId,
      workingMemory: data.content || undefined,
      metadata: (data.content_json as Record<string, unknown>) || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async saveMemory({
    userId,
    personaId,
    workingMemory,
    metadata,
  }: {
    userId: string;
    personaId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    const sb = await this.sb();
    const resourceId = makeResourceId(userId, personaId);

    type MemoryInsert = {
      user_id: string;
      persona_id: string;
      memory_type: string;
      content: string;
      content_json: Json | null;
    };

    const payload: MemoryInsert = {
      user_id: userId,
      persona_id: personaId,
      memory_type: 'working',
      content: workingMemory || '',
      content_json: (metadata as Json) || null,
    };

    // Note: resource_id is a GENERATED column, so we can't use it in onConflict
    // The unique index is on (resource_id, memory_type) but we need to match on the underlying columns
    // Since resource_id = user_id::text || ':' || persona_id::text, we use (user_id, persona_id, memory_type)
    const { data, error } = await sb
      .from('ai_memory')
      .upsert(payload, {
        onConflict: 'user_id,persona_id,memory_type',
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      id: resourceId,
      workingMemory: data.content || undefined,
      metadata: (data.content_json as Record<string, unknown>) || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateMemory({
    userId,
    personaId,
    workingMemory,
    metadata,
  }: {
    userId: string;
    personaId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    // Use saveMemory which does upsert - handles both create and update
    return this.saveMemory({ userId, personaId, workingMemory, metadata });
  }

  // ---------- Mappers ----------

  private _toThread = (r: Row<'ai_threads'>): StorageThreadType => ({
    id: r.thread_id,
    title: r.title || undefined,
    resourceId: r.resource_id!,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  });

  private _toMessage = (
    r: Pick<Row<'ai_messages'>, 'message_id' | 'thread_id' | 'role' | 'content' | 'created_at'> & {
      similarity?: number;
    }
  ): MastraMessageV1 | MastraMessageV2 => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.content);
    } catch {
      parsed = r.content;
    }

    const parts = normalizeContent(parsed);

    // Return v1 or v2 based on current format
    if (this._currentFormat === 'v1') {
      return {
        id: r.message_id,
        threadId: r.thread_id,
        role: r.role as 'user' | 'assistant' | 'system',
        content: parts as any,
        createdAt: new Date(r.created_at),
      } as MastraMessageV1;
    }

    return {
      id: r.message_id,
      threadId: r.thread_id,
      role: r.role as 'user' | 'assistant' | 'system',
      content: {
        format: 2 as const,
        parts: parts as unknown,
      } as any,
      createdAt: new Date(r.created_at),
    } as MastraMessageV2;
  };

  private _toMemory = (r: Row<'ai_memory'>): MastraMemory => ({
    id: r.memory_id,
    resourceId: r.resource_id!,
    type: r.memory_type,
    content: r.content,
    contentJson: r.content_json ?? undefined,
    importance: r.importance ?? 'normal',
    createdAt: new Date(r.created_at),
  });

  private _toScoreRow = (r: Row<'ai_scorers'>): ScoreRowData => ({
    id: r.id,
    scorerId: r.scorer_id,
    traceId: r.trace_id as any,
    spanId: r.span_id as any,
    runId: r.run_id,
    scorer: r.scorer as any,
    preprocessStepResult: r.preprocess_step_result as any,
    extractStepResult: r.extract_step_result as any,
    analyzeStepResult: r.analyze_step_result as any,
    score: Number(r.score),
    reason: r.reason as any,
    metadata: r.metadata as any,
    preprocessPrompt: r.preprocess_prompt as any,
    extractPrompt: r.extract_prompt as any,
    generateScorePrompt: r.generate_score_prompt as any,
    generateReasonPrompt: r.generate_reason_prompt as any,
    analyzePrompt: r.analyze_prompt as any,
    reasonPrompt: r.reason_prompt as any,
    input: r.input as any,
    output: r.output as any,
    additionalContext: r.additional_context as any,
    runtimeContext: r.runtime_context as any,
    entityType: r.entity_type as any,
    entity: r.entity as any,
    entityId: r.entity_id as any,
    source: r.source as any,
    resourceId: r.resource_id as any,
    threadId: r.thread_id as any,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  });

  private _toEvalRow = (r: Row<'ai_evals'>): EvalRow => ({
    input: r.input,
    output: r.output,
    result: r.result as any,
    agentName: r.agent_name,
    metricName: r.metric_name,
    instructions: r.instructions,
    testInfo: (r.test_info as any) || undefined,
    globalRunId: r.global_run_id,
    runId: r.run_id,
    createdAt: new Date(r.created_at).toISOString(),
  });

  private _toAISpanRecord = (r: Row<'ai_spans'>): AISpanRecord => ({
    traceId: r.trace_id,
    spanId: r.span_id,
    parentSpanId: r.parent_span_id || null,
    name: r.name,
    scope: (r.scope as any) || null,
    spanType: r.span_type as any,
    attributes: (r.attributes as any) || null,
    metadata: (r.metadata as any) || null,
    links: r.links as any,
    input: (r.input as any) || undefined,
    output: (r.output as any) || undefined,
    error: (r.error as any) || undefined,
    startedAt: new Date(r.started_at),
    endedAt: r.ended_at ? new Date(r.ended_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
    isEvent: r.is_event,
  });
}
