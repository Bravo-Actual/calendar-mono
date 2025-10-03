-- ============================================================================
-- AI MEMORY FULL-TEXT SEARCH
-- Purpose: Add full-text search capabilities to ai_memory for semantic recall
-- ============================================================================

-- Add a tsvector column for full-text search
ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS content_search tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(content, ''))
  ) STORED;

-- Create GIN index for full-text search performance
CREATE INDEX IF NOT EXISTS idx_ai_memory_content_search
  ON ai_memory USING GIN (content_search);

-- Create a function for ranked full-text search
CREATE OR REPLACE FUNCTION search_memories(
  p_user_id UUID,
  p_persona_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  memory_id UUID,
  user_id UUID,
  persona_id UUID,
  memory_type TEXT,
  content TEXT,
  importance TEXT,
  expires_at TIMESTAMPTZ,
  source_thread_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.memory_id,
    m.user_id,
    m.persona_id,
    m.memory_type,
    m.content,
    m.importance,
    m.expires_at,
    m.source_thread_id,
    m.metadata,
    m.created_at,
    m.updated_at,
    ts_rank(m.content_search, websearch_to_tsquery('english', p_query)) AS rank
  FROM ai_memory m
  WHERE
    m.user_id = p_user_id
    AND m.persona_id = p_persona_id
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.content_search @@ websearch_to_tsquery('english', p_query)
  ORDER BY
    rank DESC,
    m.importance DESC,
    m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_memories(UUID, UUID, TEXT, INTEGER) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION search_memories IS 'Full-text search across user memories with relevance ranking. Uses websearch_to_tsquery for natural query syntax.';
