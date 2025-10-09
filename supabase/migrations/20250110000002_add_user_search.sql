-- ============================================================================
-- Add user search capability using trigram similarity
-- Searches: first name, last name, display name, email
-- Uses fuzzy matching with similarity scoring for better results
-- ============================================================================

-- Create a function to search users using trigram similarity
CREATE OR REPLACE FUNCTION search_users(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  similarity_threshold REAL := 0.2; -- Lower threshold for names (more permissive)
BEGIN
  -- Search users using trigram similarity for fuzzy matching
  -- Calculates similarity score for ranking results
  RETURN QUERY
  SELECT
    up.user_id,
    up.email,
    up.first_name,
    up.last_name,
    up.display_name,
    -- Calculate max similarity across all searchable fields
    GREATEST(
      -- First name similarity
      similarity(LOWER(COALESCE(up.first_name, '')), LOWER(search_query)),
      -- Last name similarity
      similarity(LOWER(COALESCE(up.last_name, '')), LOWER(search_query)),
      -- Display name similarity
      similarity(LOWER(COALESCE(up.display_name, '')), LOWER(search_query)),
      -- Full name similarity (first + last)
      similarity(LOWER(COALESCE(up.first_name || ' ' || up.last_name, '')), LOWER(search_query)),
      -- Email similarity
      similarity(LOWER(COALESCE(up.email, '')), LOWER(search_query))
    ) AS similarity_score
  FROM user_profiles up
  WHERE
    -- Check if any field meets the similarity threshold
    similarity(LOWER(COALESCE(up.first_name, '')), LOWER(search_query)) >= similarity_threshold
    OR similarity(LOWER(COALESCE(up.last_name, '')), LOWER(search_query)) >= similarity_threshold
    OR similarity(LOWER(COALESCE(up.display_name, '')), LOWER(search_query)) >= similarity_threshold
    OR similarity(LOWER(COALESCE(up.first_name || ' ' || up.last_name, '')), LOWER(search_query)) >= similarity_threshold
    OR similarity(LOWER(COALESCE(up.email, '')), LOWER(search_query)) >= similarity_threshold
  ORDER BY similarity_score DESC, up.display_name ASC, up.first_name ASC
  LIMIT result_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users(TEXT, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION search_users IS
  'Trigram similarity search of users using PostgreSQL pg_trgm extension.
   Searches: first name, last name, display name, full name (first + last), and email.
   Uses fuzzy matching with similarity scoring - handles typos and partial matches.
   Returns users sorted by similarity score (higher score = better match).
   Example: "john" will match "John Smith", "John Doe", "john@example.com"
   Example: "john smith" will match "John Smith" with high score';

-- Note: GIN indexes for trigram search on user_profiles already exist from previous migration
-- idx_user_profiles_first_name_trgm
-- idx_user_profiles_last_name_trgm
-- idx_user_profiles_display_name_trgm
