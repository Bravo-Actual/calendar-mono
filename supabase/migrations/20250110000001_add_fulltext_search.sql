-- ============================================================================
-- Add trigram similarity search capability to events
-- Searches: event titles, agendas, attendee names, category names
-- Uses fuzzy matching with similarity scoring for better results
-- ============================================================================

-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a function to search events using trigram similarity
CREATE OR REPLACE FUNCTION search_user_events(
  search_query TEXT,
  start_date_filter TIMESTAMPTZ DEFAULT NULL,
  end_date_filter TIMESTAMPTZ DEFAULT NULL,
  category_id_filter UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  agenda TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN,
  online_event BOOLEAN,
  online_join_link TEXT,
  in_person BOOLEAN,
  private BOOLEAN,
  calendar_id UUID,
  category_id UUID,
  show_time_as show_time_as,
  similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  similarity_threshold REAL := 0.3; -- Minimum similarity score (0-1)
BEGIN
  -- Search events using trigram similarity for fuzzy matching
  -- Calculates similarity score for ranking results
  RETURN QUERY
  SELECT DISTINCT ON (e.id)
    e.id,
    e.title,
    e.agenda,
    e.start_time,
    e.end_time,
    e.all_day,
    e.online_event,
    e.online_join_link,
    e.in_person,
    e.private,
    edp.calendar_id,
    edp.category_id,
    edp.show_time_as,
    -- Calculate max similarity across all searchable fields
    GREATEST(
      -- Event title similarity
      similarity(LOWER(COALESCE(e.title, '')), LOWER(search_query)),
      -- Event agenda similarity
      similarity(LOWER(COALESCE(e.agenda, '')), LOWER(search_query)),
      -- Attendee name similarity (get max from subquery)
      COALESCE((
        SELECT MAX(
          GREATEST(
            similarity(LOWER(COALESCE(up.first_name, '')), LOWER(search_query)),
            similarity(LOWER(COALESCE(up.last_name, '')), LOWER(search_query)),
            similarity(LOWER(COALESCE(up.display_name, '')), LOWER(search_query)),
            similarity(LOWER(COALESCE(up.first_name || ' ' || up.last_name, '')), LOWER(search_query))
          )
        )
        FROM event_users eu
        INNER JOIN user_profiles up ON eu.user_id = up.user_id
        WHERE eu.event_id = e.id
      ), 0),
      -- Category name similarity
      COALESCE((
        SELECT similarity(LOWER(COALESCE(uc.name, '')), LOWER(search_query))
        FROM user_categories uc
        WHERE uc.id = edp.category_id
        AND uc.user_id = auth.uid()
      ), 0)
    ) AS similarity_score
  FROM events e
  INNER JOIN event_details_personal edp ON e.id = edp.event_id
  WHERE
    -- User has access to this event
    edp.user_id = auth.uid()
    -- Check if any field meets the similarity threshold
    AND (
      similarity(LOWER(COALESCE(e.title, '')), LOWER(search_query)) >= similarity_threshold
      OR similarity(LOWER(COALESCE(e.agenda, '')), LOWER(search_query)) >= similarity_threshold
      OR EXISTS (
        SELECT 1
        FROM event_users eu
        INNER JOIN user_profiles up ON eu.user_id = up.user_id
        WHERE eu.event_id = e.id
        AND (
          similarity(LOWER(COALESCE(up.first_name, '')), LOWER(search_query)) >= similarity_threshold
          OR similarity(LOWER(COALESCE(up.last_name, '')), LOWER(search_query)) >= similarity_threshold
          OR similarity(LOWER(COALESCE(up.display_name, '')), LOWER(search_query)) >= similarity_threshold
          OR similarity(LOWER(COALESCE(up.first_name || ' ' || up.last_name, '')), LOWER(search_query)) >= similarity_threshold
        )
      )
      OR EXISTS (
        SELECT 1
        FROM user_categories uc
        WHERE uc.id = edp.category_id
        AND uc.user_id = auth.uid()
        AND similarity(LOWER(COALESCE(uc.name, '')), LOWER(search_query)) >= similarity_threshold
      )
    )
    -- Optional date filters
    AND (start_date_filter IS NULL OR e.start_time >= start_date_filter)
    AND (end_date_filter IS NULL OR e.end_time <= end_date_filter)
    -- Optional category filter
    AND (category_id_filter IS NULL OR edp.category_id = category_id_filter)
  ORDER BY e.id, similarity_score DESC, e.start_time ASC
  LIMIT result_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_user_events(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION search_user_events IS
  'Trigram similarity search of user events using PostgreSQL pg_trgm extension.
   Searches: event titles, agendas, attendee names (first, last, display), and category names.
   Uses fuzzy matching with similarity scoring - handles extra words and typos.
   Returns events sorted by similarity score (higher score = better match).
   Categories are per-user - only searches the current user''s category names.
   Example: "customer connect meeting" will match "Customer Connect" (score ~0.65)
   Example: "john" will match events with attendee named John
   Example: "focus" will match events in "Focus" category';

-- Create GIN indexes for faster trigram similarity search
CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON events USING GIN (LOWER(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_agenda_trgm
  ON events USING GIN (LOWER(agenda) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_first_name_trgm
  ON user_profiles USING GIN (LOWER(first_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_name_trgm
  ON user_profiles USING GIN (LOWER(last_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name_trgm
  ON user_profiles USING GIN (LOWER(display_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_categories_name_trgm
  ON user_categories USING GIN (LOWER(name) gin_trgm_ops);
