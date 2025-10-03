-- Create a view that joins all event-related tables for simplified querying
-- This is optimized for the AI agent which doesn't need real-time updates
-- and benefits from a single query instead of complex client-side joins

CREATE OR REPLACE VIEW events_resolved AS
SELECT
  -- Main event fields
  e.id,
  e.owner_id,
  e.creator_id,
  e.series_id,
  e.title,
  e.agenda,
  e.online_event,
  e.online_join_link,
  e.online_chat_link,
  e.in_person,
  e.start_time,
  e.end_time,
  e.all_day,
  e.private,
  e.request_responses,
  e.allow_forwarding,
  e.invite_allow_reschedule_proposals,
  e.hide_attendees,
  e.history,
  e.discovery,
  e.join_model,
  e.created_at,
  e.updated_at,

  -- Personal details (for the querying user)
  edp.calendar_id,
  edp.category_id,
  edp.show_time_as,
  edp.time_defense_level,
  edp.ai_managed,
  edp.ai_instructions,

  -- Calendar lookup
  cal.name as calendar_name,
  cal.color as calendar_color,

  -- Category lookup
  cat.name as category_name,
  cat.color as category_color,

  -- User role
  eu.role as user_role,

  -- RSVP status
  er.status as rsvp_status,
  er.following as rsvp_following,
  er.response_comment as rsvp_comment,

  -- Computed fields
  CASE
    WHEN e.owner_id = edp.user_id THEN 'owner'
    WHEN eu.role IS NOT NULL THEN eu.role::text
    ELSE 'viewer'
  END as computed_role,

  COALESCE(er.following, false) as computed_following,

  -- User ID for filtering (from personal details)
  edp.user_id,

  -- Full-text search vector combining title, agenda, calendar, and category
  to_tsvector('english',
    COALESCE(e.title, '') || ' ' ||
    COALESCE(e.agenda, '') || ' ' ||
    COALESCE(cal.name, '') || ' ' ||
    COALESCE(cat.name, '')
  ) as search_vector

FROM events e
LEFT JOIN event_details_personal edp ON e.id = edp.event_id
LEFT JOIN user_calendars cal ON edp.calendar_id = cal.id
LEFT JOIN user_categories cat ON edp.category_id = cat.id
LEFT JOIN event_users eu ON e.id = eu.event_id AND eu.user_id = edp.user_id
LEFT JOIN event_rsvps er ON e.id = er.event_id AND er.user_id = edp.user_id;

-- Add comment explaining the view
COMMENT ON VIEW events_resolved IS
'Resolved events view combining events with personal details, calendars, categories, roles, and RSVPs.
Optimized for AI agent queries with full-text search support.
Filter by user_id to get user-specific event data.
Use search_vector for full-text search on title, agenda, calendar, and category names.';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for user-based filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_edp_user_event ON event_details_personal(user_id, event_id);

-- Index for date range queries (very common for calendar views)
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);

-- Index for date range with user (combines most common filters)
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(owner_id, start_time);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_edp_category ON event_details_personal(category_id) WHERE category_id IS NOT NULL;

-- Index for calendar filtering
CREATE INDEX IF NOT EXISTS idx_edp_calendar ON event_details_personal(calendar_id) WHERE calendar_id IS NOT NULL;

-- Index for AI-managed events
CREATE INDEX IF NOT EXISTS idx_edp_ai_managed ON event_details_personal(ai_managed) WHERE ai_managed = true;

-- Full-text search index on events table (for search_vector in view)
CREATE INDEX IF NOT EXISTS idx_events_title_fts ON events USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(agenda, '')));

-- Index for online events
CREATE INDEX IF NOT EXISTS idx_events_online ON events(online_event) WHERE online_event = true;

-- Index for private events
CREATE INDEX IF NOT EXISTS idx_events_private ON events(private) WHERE private = true;

-- Index for all-day events
CREATE INDEX IF NOT EXISTS idx_events_all_day ON events(all_day) WHERE all_day = true;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON events_resolved TO authenticated;

-- Add RLS policy to ensure users only see their own event data
ALTER VIEW events_resolved SET (security_invoker = true);
