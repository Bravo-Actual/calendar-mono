-- Mastra Extended Storage Tables
-- This migration adds workflow, scoring, and observability tables matching Mastra's PostgresStore schema exactly
-- Using ai_ prefix to match our existing naming convention

-- =====================================================
-- AI Spans Table (for observability/tracing)
-- Mastra table: mastra_ai_spans
-- Our table: ai_spans
-- Schema source: @mastra/core AI_SPAN_SCHEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_spans (
  trace_id       TEXT NOT NULL,
  span_id        TEXT NOT NULL,
  parent_span_id TEXT,
  name           TEXT NOT NULL,
  scope          JSONB,
  span_type      TEXT NOT NULL,
  attributes     JSONB,
  metadata       JSONB,
  links          JSONB,
  input          JSONB,
  output         JSONB,
  error          JSONB,
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  is_event       BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (trace_id, span_id)
);

-- Indexes for AI spans queries
CREATE INDEX IF NOT EXISTS idx_ai_spans_trace_id ON ai_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_spans_parent_span_id ON ai_spans(parent_span_id) WHERE parent_span_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_spans_name ON ai_spans(name);
CREATE INDEX IF NOT EXISTS idx_ai_spans_span_type ON ai_spans(span_type);
CREATE INDEX IF NOT EXISTS idx_ai_spans_started_at ON ai_spans(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_spans_attributes ON ai_spans USING gin(attributes) WHERE attributes IS NOT NULL;

-- Composite indexes matching PostgresStore's createAutomaticIndexes()
CREATE INDEX IF NOT EXISTS idx_ai_spans_trace_started ON ai_spans(trace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_spans_parent_started ON ai_spans(parent_span_id, started_at DESC) WHERE parent_span_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_spans_type_started ON ai_spans(span_type, started_at DESC);

-- =====================================================
-- AI Traces Table (legacy OpenTelemetry-style traces)
-- Mastra table: mastra_traces
-- Our table: ai_traces
-- Schema source: @mastra/core TABLE_TRACES
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_traces (
  id             TEXT PRIMARY KEY,
  parent_span_id TEXT,
  name           TEXT NOT NULL,
  trace_id       TEXT NOT NULL,
  scope          TEXT NOT NULL,
  kind           INTEGER NOT NULL,
  attributes     JSONB,
  status         JSONB,
  events         JSONB,
  links          JSONB,
  other          TEXT,
  start_time     BIGINT NOT NULL,
  end_time       BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for traces queries
CREATE INDEX IF NOT EXISTS idx_ai_traces_trace_id ON ai_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_traces_name ON ai_traces(name);
CREATE INDEX IF NOT EXISTS idx_ai_traces_scope ON ai_traces(scope);
CREATE INDEX IF NOT EXISTS idx_ai_traces_start_time ON ai_traces(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_ai_traces_attributes ON ai_traces USING gin(attributes) WHERE attributes IS NOT NULL;

-- Composite index matching PostgresStore's createAutomaticIndexes()
CREATE INDEX IF NOT EXISTS idx_ai_traces_name_starttime ON ai_traces(name, start_time DESC);

-- =====================================================
-- Workflow Snapshot Table
-- Mastra table: mastra_workflow_snapshot
-- Our table: ai_workflow_snapshot
-- Schema source: @mastra/core TABLE_WORKFLOW_SNAPSHOT
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_workflow_snapshot (
  workflow_name TEXT NOT NULL,
  run_id        TEXT NOT NULL,
  resource_id   TEXT,
  snapshot      TEXT NOT NULL,  -- Note: Mastra uses TEXT, not JSONB
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_name, run_id)
);

-- Indexes for workflow queries
CREATE INDEX IF NOT EXISTS idx_ai_workflow_snapshot_resource_id ON ai_workflow_snapshot(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_workflow_snapshot_created_at ON ai_workflow_snapshot(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_snapshot_workflow_name_created_at ON ai_workflow_snapshot(workflow_name, created_at DESC);

-- =====================================================
-- Scorers Table (comprehensive evaluation/scoring data)
-- Mastra table: mastra_scorers
-- Our table: ai_scorers
-- Schema source: @mastra/core SCORERS_SCHEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_scorers (
  id                       TEXT PRIMARY KEY,
  scorer_id                TEXT NOT NULL,
  trace_id                 TEXT,
  span_id                  TEXT,
  run_id                   TEXT NOT NULL,
  scorer                   JSONB NOT NULL,
  preprocess_step_result   JSONB,
  extract_step_result      JSONB,
  analyze_step_result      JSONB,
  score                    NUMERIC NOT NULL,
  reason                   TEXT,
  metadata                 JSONB,
  preprocess_prompt        TEXT,
  extract_prompt           TEXT,
  generate_score_prompt    TEXT,
  generate_reason_prompt   TEXT,
  analyze_prompt           TEXT,
  reason_prompt            TEXT,  -- Deprecated but kept for compatibility
  input                    JSONB NOT NULL,
  output                   JSONB NOT NULL,
  additional_context       JSONB,
  runtime_context          JSONB,
  entity_type              TEXT,
  entity                   JSONB,
  entity_id                TEXT,
  source                   TEXT NOT NULL,
  resource_id              TEXT,
  thread_id                TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for scorers queries
CREATE INDEX IF NOT EXISTS idx_ai_scorers_scorer_id ON ai_scorers(scorer_id);
CREATE INDEX IF NOT EXISTS idx_ai_scorers_entity_id ON ai_scorers(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_scorers_entity_type ON ai_scorers(entity_type) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_scorers_entity ON ai_scorers(entity_id, entity_type) WHERE entity_id IS NOT NULL AND entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_scorers_run_id ON ai_scorers(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_scorers_trace_span ON ai_scorers(trace_id, span_id) WHERE trace_id IS NOT NULL AND span_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_scorers_source ON ai_scorers(source);
CREATE INDEX IF NOT EXISTS idx_ai_scorers_resource_id ON ai_scorers(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_scorers_thread_id ON ai_scorers(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_scorers_created_at ON ai_scorers(created_at DESC);

-- Composite index matching PostgresStore's createAutomaticIndexes()
CREATE INDEX IF NOT EXISTS idx_ai_scorers_trace_span_created ON ai_scorers(trace_id, span_id, created_at DESC) WHERE trace_id IS NOT NULL AND span_id IS NOT NULL;

-- =====================================================
-- AI Evals Table (evaluation results and metadata)
-- Mastra table: mastra_evals
-- Our table: ai_evals
-- Schema source: @mastra/core TABLE_EVALS
-- Note: Mastra has both 'created_at' and 'createdAt' - we only use created_at following our standards
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_evals (
  input          TEXT NOT NULL,
  output         TEXT NOT NULL,
  result         JSONB NOT NULL,
  agent_name     TEXT NOT NULL,
  metric_name    TEXT NOT NULL,
  instructions   TEXT NOT NULL,
  test_info      JSONB,
  global_run_id  TEXT NOT NULL,
  run_id         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for evals queries
CREATE INDEX IF NOT EXISTS idx_ai_evals_agent_name ON ai_evals(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_evals_metric_name ON ai_evals(metric_name);
CREATE INDEX IF NOT EXISTS idx_ai_evals_global_run_id ON ai_evals(global_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_evals_run_id ON ai_evals(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_evals_created_at ON ai_evals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_evals_agent_created ON ai_evals(agent_name, created_at DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
-- Note: These tables don't have user_id columns as they're system-level storage
-- They use resource_id where applicable to scope data

-- Enable RLS on all tables
ALTER TABLE ai_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflow_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scorers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evals ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
CREATE POLICY "Service role has full access to ai_spans"
  ON ai_spans FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_traces"
  ON ai_traces FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_workflow_snapshot"
  ON ai_workflow_snapshot FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_scorers"
  ON ai_scorers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_evals"
  ON ai_evals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated user policies (read-only for now)
CREATE POLICY "Authenticated users can read ai_spans"
  ON ai_spans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ai_traces"
  ON ai_traces FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ai_workflow_snapshot"
  ON ai_workflow_snapshot FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ai_scorers"
  ON ai_scorers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ai_evals"
  ON ai_evals FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- Triggers for updated_at columns
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for tables with updated_at
CREATE TRIGGER update_ai_spans_updated_at
  BEFORE UPDATE ON ai_spans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_workflow_snapshot_updated_at
  BEFORE UPDATE ON ai_workflow_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_scorers_updated_at
  BEFORE UPDATE ON ai_scorers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE ai_spans IS 'Mastra AI tracing spans for observability (maps to mastra_ai_spans)';
COMMENT ON TABLE ai_traces IS 'Legacy OpenTelemetry-style traces (maps to mastra_traces)';
COMMENT ON TABLE ai_workflow_snapshot IS 'Workflow execution state snapshots (maps to mastra_workflow_snapshot)';
COMMENT ON TABLE ai_scorers IS 'Comprehensive scoring and evaluation data (maps to mastra_scorers)';
COMMENT ON TABLE ai_evals IS 'Evaluation results and metrics (maps to mastra_evals)';

COMMENT ON COLUMN ai_workflow_snapshot.snapshot IS 'Workflow state stored as TEXT (JSON string), not JSONB';
COMMENT ON COLUMN ai_scorers.reason_prompt IS 'Deprecated field, use generate_reason_prompt instead';
