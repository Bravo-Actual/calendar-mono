-- ============================================================================
-- FREE TIME AND FREE/BUSY LOOKUP FUNCTIONS
-- Purpose:
--   1. Find free time slots in user's calendar with duration filtering
--   2. Privacy-preserving free/busy lookup (Outlook-style scheduling assistant)
-- ============================================================================

-- ============================================================================
-- FUNCTION: Find free time slots for a user
-- ============================================================================

-- Function to find free time slots for a user within date range or specific dates
CREATE OR REPLACE FUNCTION get_user_free_time(
  p_user_id UUID,
  p_start_date TEXT DEFAULT NULL,     -- YYYY-MM-DD format for range mode
  p_end_date TEXT DEFAULT NULL,       -- YYYY-MM-DD format for range mode
  p_dates TEXT[] DEFAULT NULL,        -- Array of YYYY-MM-DD dates for specific dates mode
  p_timezone TEXT DEFAULT 'UTC',
  p_min_duration_minutes INTEGER DEFAULT 30,
  p_work_start_hour INTEGER DEFAULT 9,
  p_work_end_hour INTEGER DEFAULT 17,
  p_slot_increment_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  start_time TEXT,           -- ISO 8601 string format for JavaScript compatibility
  end_time TEXT,             -- ISO 8601 string format for JavaScript compatibility
  start_time_ms BIGINT,      -- Milliseconds since epoch for JavaScript Date()
  end_time_ms BIGINT,        -- Milliseconds since epoch for JavaScript Date()
  duration_minutes INTEGER,
  date_context TEXT          -- YYYY-MM-DD format for readability
)
LANGUAGE plpgsql
AS $$
DECLARE
  work_day_start TIME := (p_work_start_hour || ':00:00')::TIME;
  work_day_end TIME := (p_work_end_hour || ':00:00')::TIME;
  slot_interval INTERVAL := (p_slot_increment_minutes || ' minutes')::INTERVAL;

  current_date DATE;
  dates_to_process DATE[];

  current_slot_start TIMESTAMPTZ;
  current_slot_end TIMESTAMPTZ;
  work_day_start_tz TIMESTAMPTZ;
  work_day_end_tz TIMESTAMPTZ;

  slot_duration_mins INTEGER;
  accumulated_duration INTEGER;
  free_slot_start TIMESTAMPTZ;

  has_conflict BOOLEAN;
  conflict_end TIMESTAMPTZ;
BEGIN
  -- Determine which dates to process
  IF p_dates IS NOT NULL AND array_length(p_dates, 1) > 0 THEN
    -- Specific dates mode
    SELECT array_agg(d::DATE ORDER BY d::DATE)
    INTO dates_to_process
    FROM unnest(p_dates) AS d;
  ELSIF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
    -- Date range mode
    SELECT array_agg(d::DATE ORDER BY d::DATE)
    INTO dates_to_process
    FROM generate_series(p_start_date::DATE, p_end_date::DATE, '1 day'::INTERVAL) AS d;
  ELSE
    RAISE EXCEPTION 'Must provide either p_start_date/p_end_date or p_dates array';
  END IF;

  -- Process each date
  FOREACH current_date IN ARRAY dates_to_process LOOP
    -- Skip weekends (Sunday = 0, Saturday = 6)
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN

      -- Calculate work day boundaries in user's timezone
      work_day_start_tz := (current_date + work_day_start) AT TIME ZONE p_timezone AT TIME ZONE 'UTC';
      work_day_end_tz := (current_date + work_day_end) AT TIME ZONE p_timezone AT TIME ZONE 'UTC';

      -- Initialize slot tracking
      current_slot_start := work_day_start_tz;
      free_slot_start := NULL;
      accumulated_duration := 0;

      -- Process time slots throughout the work day
      WHILE current_slot_start < work_day_end_tz LOOP
        current_slot_end := LEAST(current_slot_start + slot_interval, work_day_end_tz);
        slot_duration_mins := EXTRACT(EPOCH FROM (current_slot_end - current_slot_start)) / 60;

        -- Check for event conflicts in this slot using event_details_personal
        SELECT EXISTS (
          SELECT 1 FROM events e
          INNER JOIN event_details_personal edp
            ON e.id = edp.event_id
            AND edp.user_id = p_user_id
          WHERE NOT (
            current_slot_end <= e.start_time OR
            current_slot_start >= e.end_time
          )
        ), COALESCE(MAX(e.end_time), current_slot_start)
        INTO has_conflict, conflict_end
        FROM events e
        INNER JOIN event_details_personal edp
          ON e.id = edp.event_id
          AND edp.user_id = p_user_id
        WHERE NOT (
          current_slot_end <= e.start_time OR
          current_slot_start >= e.end_time
        );

        IF NOT has_conflict THEN
          -- This slot is free
          IF free_slot_start IS NULL THEN
            -- Start of a new free period
            free_slot_start := current_slot_start;
            accumulated_duration := slot_duration_mins;
          ELSE
            -- Continue existing free period
            accumulated_duration := accumulated_duration + slot_duration_mins;
          END IF;

          -- Check if we've reached the minimum duration
          IF accumulated_duration >= p_min_duration_minutes THEN
            -- Return this free slot (but continue to see if it gets longer)
            RETURN QUERY SELECT
              free_slot_start::TEXT,
              current_slot_end::TEXT,
              (EXTRACT(EPOCH FROM free_slot_start) * 1000)::BIGINT,
              (EXTRACT(EPOCH FROM current_slot_end) * 1000)::BIGINT,
              accumulated_duration,
              current_date::TEXT;
          END IF;
        ELSE
          -- This slot has a conflict - reset free period tracking
          IF free_slot_start IS NOT NULL AND accumulated_duration >= p_min_duration_minutes THEN
            -- We had a valid free period that just ended
            RETURN QUERY SELECT
              free_slot_start::TEXT,
              current_slot_start::TEXT,
              (EXTRACT(EPOCH FROM free_slot_start) * 1000)::BIGINT,
              (EXTRACT(EPOCH FROM current_slot_start) * 1000)::BIGINT,
              accumulated_duration,
              current_date::TEXT;
          END IF;

          -- Reset for next potential free period
          free_slot_start := NULL;
          accumulated_duration := 0;

          -- Skip ahead past this conflict
          current_slot_start := GREATEST(conflict_end, current_slot_start + slot_interval);
          CONTINUE;
        END IF;

        -- Move to next slot
        current_slot_start := current_slot_end;
      END LOOP;

      -- Handle any remaining free period at end of work day
      IF free_slot_start IS NOT NULL AND accumulated_duration >= p_min_duration_minutes THEN
        RETURN QUERY SELECT
          free_slot_start::TEXT,
          work_day_end_tz::TEXT,
          (EXTRACT(EPOCH FROM free_slot_start) * 1000)::BIGINT,
          (EXTRACT(EPOCH FROM work_day_end_tz) * 1000)::BIGINT,
          accumulated_duration,
          current_date::TEXT;
      END IF;

    END IF; -- End weekend check
  END LOOP; -- End date processing

  RETURN;
END;
$$;

-- ============================================================================
-- FUNCTION: Get single user's free/busy blocks (privacy-preserving)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_free_busy(
  target_user_id UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  start_time_ms BIGINT,
  end_time_ms BIGINT,
  all_day BOOLEAN,
  show_time_as show_time_as,
  time_defense_level time_defense_level
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Query event_details_personal as the source of truth
  -- This contains ALL events on the user's calendar (owned + invited)
  -- Returns time blocks, availability status, and event "shapes" - NO private details
  RETURN QUERY
  SELECT
    e.start_time,
    e.end_time,
    e.start_time_ms,
    e.end_time_ms,
    e.all_day,
    COALESCE(edp.show_time_as, 'busy'::show_time_as) AS status,
    COALESCE(edp.time_defense_level, 'normal'::time_defense_level) AS time_defense_level
  FROM events e
  INNER JOIN event_details_personal edp
    ON e.id = edp.event_id
    AND edp.user_id = target_user_id
  WHERE
    e.start_time < end_date
    AND e.end_time > start_date
  ORDER BY e.start_time;
END;
$$;

-- ============================================================================
-- FUNCTION: Get multiple users' free/busy blocks (bulk query)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_multiple_users_free_busy(
  target_user_ids UUID[],
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  user_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  start_time_ms BIGINT,
  end_time_ms BIGINT,
  all_day BOOLEAN,
  show_time_as show_time_as,
  time_defense_level time_defense_level
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    edp.user_id,
    e.start_time,
    e.end_time,
    e.start_time_ms,
    e.end_time_ms,
    e.all_day,
    COALESCE(edp.show_time_as, 'busy'::show_time_as) AS status,
    COALESCE(edp.time_defense_level, 'normal'::time_defense_level) AS time_defense_level
  FROM events e
  INNER JOIN event_details_personal edp
    ON e.id = edp.event_id
    AND edp.user_id = ANY(target_user_ids)
  WHERE
    e.start_time < end_date
    AND e.end_time > start_date
  ORDER BY edp.user_id, e.start_time;
END;
$$;

-- ============================================================================
-- FUNCTION: Find available time slots for multiple users
-- ============================================================================

CREATE OR REPLACE FUNCTION find_available_time_slots(
  target_user_ids UUID[],
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  slot_duration_minutes INTEGER DEFAULT 30,
  slot_increment_minutes INTEGER DEFAULT 15,
  requesting_user_id UUID DEFAULT NULL,
  user_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  all_users_free BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_slot_time TIMESTAMPTZ;
  slot_end_time TIMESTAMPTZ;
  busy_users INTEGER;
  slot_time_local TIMESTAMPTZ;
  slot_end_local TIMESTAMPTZ;
  slot_weekday INTEGER;
  slot_hour INTEGER;
  slot_minute INTEGER;
  slot_time_minutes INTEGER;
  slot_end_minutes INTEGER;
  is_in_work_hours BOOLEAN;
  work_period RECORD;
BEGIN
  current_slot_time := start_date;

  WHILE current_slot_time + (slot_duration_minutes || ' minutes')::INTERVAL <= end_date LOOP
    slot_end_time := current_slot_time + (slot_duration_minutes || ' minutes')::INTERVAL;

    -- Convert to user's local timezone to check working hours
    slot_time_local := current_slot_time AT TIME ZONE user_timezone;
    slot_end_local := slot_end_time AT TIME ZONE user_timezone;
    slot_weekday := EXTRACT(DOW FROM slot_time_local)::INTEGER;
    slot_hour := EXTRACT(HOUR FROM slot_time_local)::INTEGER;
    slot_minute := EXTRACT(MINUTE FROM slot_time_local)::INTEGER;
    slot_time_minutes := slot_hour * 60 + slot_minute;
    slot_end_minutes := EXTRACT(HOUR FROM slot_end_local)::INTEGER * 60 + EXTRACT(MINUTE FROM slot_end_local)::INTEGER;

    -- Check if this slot is within requesting user's working hours
    is_in_work_hours := FALSE;

    IF requesting_user_id IS NOT NULL THEN
      -- Check user_work_periods for this day and time
      FOR work_period IN
        SELECT
          EXTRACT(HOUR FROM start_time)::INTEGER AS start_hour,
          EXTRACT(MINUTE FROM start_time)::INTEGER AS start_minute,
          EXTRACT(HOUR FROM end_time)::INTEGER AS end_hour,
          EXTRACT(MINUTE FROM end_time)::INTEGER AS end_minute
        FROM user_work_periods
        WHERE user_id = requesting_user_id
          AND weekday = slot_weekday
      LOOP
        DECLARE
          period_start_minutes INTEGER := work_period.start_hour * 60 + work_period.start_minute;
          period_end_minutes INTEGER := work_period.end_hour * 60 + work_period.end_minute;
        BEGIN
          -- Check that both slot start AND end are within this work period
          IF slot_time_minutes >= period_start_minutes AND slot_end_minutes <= period_end_minutes THEN
            is_in_work_hours := TRUE;
            EXIT;
          END IF;
        END;
      END LOOP;
    ELSE
      -- No user specified - default to 9 AM - 5 PM on weekdays
      -- Check that both slot start AND end are within working hours (9 AM = 540 minutes, 5 PM = 1020 minutes)
      is_in_work_hours := (slot_weekday >= 1 AND slot_weekday <= 5 AND slot_time_minutes >= 540 AND slot_end_minutes <= 1020);
    END IF;

    -- Only process slots within working hours
    IF is_in_work_hours THEN
      -- Count how many users are busy during this slot
      SELECT COUNT(DISTINCT fb.user_id)
      INTO busy_users
      FROM get_multiple_users_free_busy(target_user_ids, current_slot_time, slot_end_time) fb
      WHERE fb.show_time_as IN ('busy', 'oof');

      -- Return this slot with availability status
      RETURN QUERY
      SELECT
        current_slot_time,
        slot_end_time,
        (busy_users = 0) AS all_users_free;
    END IF;

    current_slot_time := current_slot_time + (slot_increment_minutes || ' minutes')::INTERVAL;
  END LOOP;

  RETURN;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_free_time(UUID, TEXT, TEXT, TEXT[], TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_free_busy(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_multiple_users_free_busy(UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION find_available_time_slots(UUID[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, UUID, TEXT) TO authenticated;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create optimized indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_owner_time_range
  ON events (owner_id, start_time, end_time)
  WHERE owner_id IS NOT NULL;

-- Composite index for free/busy queries (user + time range)
CREATE INDEX IF NOT EXISTS idx_edp_user_show_time
  ON event_details_personal (user_id, show_time_as);

-- TODO: Fix GIST index for PostgreSQL 17 compatibility
-- CREATE INDEX IF NOT EXISTS idx_events_time_overlap
-- ON events USING GIST (owner_id, tstzrange(start_time, end_time))
-- WHERE owner_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_user_free_time IS
  'Find free time slots in user''s calendar using event_details_personal as source of truth for all events (owned + invited).';

COMMENT ON FUNCTION get_user_free_busy IS
  'Privacy-preserving free/busy lookup for a single user. Returns ONLY time blocks and availability status from event_details_personal - NO private event details exposed.';

COMMENT ON FUNCTION get_multiple_users_free_busy IS
  'Bulk free/busy lookup for multiple users. Useful for scheduling meetings with multiple attendees. Returns ONLY time blocks and status.';

COMMENT ON FUNCTION find_available_time_slots IS
  'Finds time slots and indicates if all specified users are free.
   Filters slots to only show times within requesting user''s working hours.
   Respects user timezone for working hours calculation.
   Client should pass start_date at least 15 minutes in the future.
   Returns slots with all_users_free boolean for meeting scheduling UI.';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Find free time in date range:
-- SELECT * FROM get_user_free_time(
--   'user-uuid'::UUID,
--   '2024-09-26',
--   '2024-09-30',
--   p_min_duration_minutes := 60
-- );
--
-- Find free time on specific dates:
-- SELECT * FROM get_user_free_time(
--   'user-uuid'::UUID,
--   p_dates := ARRAY['2024-09-26', '2024-09-28', '2024-09-30'],
--   p_min_duration_minutes := 45
-- );
--
-- Get free/busy for a user:
-- SELECT * FROM get_user_free_busy(
--   'user-uuid'::UUID,
--   '2024-09-26 00:00:00+00'::TIMESTAMPTZ,
--   '2024-09-30 23:59:59+00'::TIMESTAMPTZ
-- );
--
-- Get free/busy for multiple users:
-- SELECT * FROM get_multiple_users_free_busy(
--   ARRAY['user1-uuid'::UUID, 'user2-uuid'::UUID],
--   '2024-09-26 00:00:00+00'::TIMESTAMPTZ,
--   '2024-09-30 23:59:59+00'::TIMESTAMPTZ
-- );
--
-- Find available slots for multiple users:
-- SELECT * FROM find_available_time_slots(
--   ARRAY['user1-uuid'::UUID, 'user2-uuid'::UUID],
--   '2024-09-26 09:00:00+00'::TIMESTAMPTZ,
--   '2024-09-26 17:00:00+00'::TIMESTAMPTZ,
--   slot_duration_minutes := 30,
--   slot_increment_minutes := 15
-- );
