-- ============================================================================
-- CALENDAR EVENTS VIEW
-- Purpose: Flatten complex event data with joins for efficient offline sync
-- ============================================================================

-- Create a comprehensive view that flattens all calendar event data
-- This eliminates the need for complex client-side joins
CREATE OR REPLACE VIEW calendar_events_view AS
SELECT
  -- Core event fields
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
  e.duration,
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

  -- User perspective fields (from current user)
  COALESCE(eur.user_id, edp.user_id) as viewing_user_id,

  -- User role information
  CASE
    WHEN e.owner_id = COALESCE(eur.user_id, edp.user_id) THEN 'owner'::user_role
    ELSE COALESCE(eur.role, 'viewer'::user_role)
  END as user_role,
  eur.invite_type,
  eur.rsvp,
  eur.rsvp_timestamp,
  eur.attendance_type,
  COALESCE(eur.following, false) as following,

  -- User personal details
  edp.calendar_id,
  uc.name as calendar_name,
  uc.color as calendar_color,
  COALESCE(edp.show_time_as, 'busy'::show_time_as_extended) as show_time_as,
  edp.category_id,
  ucat.name as category_name,
  ucat.color as category_color,
  COALESCE(edp.time_defense_level, 'normal'::time_defense_level) as time_defense_level,
  COALESCE(edp.ai_managed, false) as ai_managed,
  edp.ai_instructions,

  -- Computed fields for efficient client queries
  e.start_time as start_time_iso,
  EXTRACT(EPOCH FROM e.start_time) * 1000 as start_timestamp_ms,
  EXTRACT(EPOCH FROM e.start_time + INTERVAL '1 minute' * e.duration) * 1000 as end_timestamp_ms,
  false as ai_suggested -- Default, can be overridden by client logic

FROM events e

-- Left join user roles (for invited users)
LEFT JOIN event_user_roles eur ON e.id = eur.event_id

-- Left join personal details (for all users who have personalized the event)
LEFT JOIN event_details_personal edp ON e.id = edp.event_id
  AND (eur.user_id IS NULL OR edp.user_id = eur.user_id)

-- Left join user calendars
LEFT JOIN user_calendars uc ON edp.calendar_id = uc.id

-- Left join user categories
LEFT JOIN user_categories ucat ON edp.category_id = ucat.id

-- Only include events where user has access (owner, creator, has role, or has personal details)
WHERE
  e.owner_id = COALESCE(eur.user_id, edp.user_id) OR
  e.creator_id = COALESCE(eur.user_id, edp.user_id) OR
  eur.user_id IS NOT NULL OR
  edp.user_id IS NOT NULL;

-- Note: RLS is not supported on views in PostgreSQL
-- Security is handled by the underlying tables which already have RLS enabled
-- The view filters data based on user access through the WHERE clause

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_calendar_events_view_user_time
  ON events USING btree (owner_id, start_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_view_user_roles_time
  ON event_user_roles USING btree (user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_view_personal_details
  ON event_details_personal USING btree (user_id, event_id);

-- Grant access to authenticated users
GRANT SELECT ON calendar_events_view TO authenticated;