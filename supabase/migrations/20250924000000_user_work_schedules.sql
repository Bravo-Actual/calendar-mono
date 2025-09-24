-- Create user work periods table for queryable work hours

CREATE TABLE user_work_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday integer NOT NULL, -- 0=Sunday, 1=Monday, etc.
  start_time time NOT NULL, -- 09:00 (in user's timezone)
  end_time time NOT NULL,   -- 17:00 (in user's timezone)

  -- Computed fields for easier querying (similar to events table)
  -- Removed computed _ms fields - calculate on client side

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_weekday CHECK (weekday >= 0 AND weekday <= 6),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Add updated_at trigger
CREATE TRIGGER update_user_work_periods_updated_at
  BEFORE UPDATE ON user_work_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Removed: calculate_work_period_timestamps function (no longer needed)

-- Removed: timestamp calculation triggers (no longer needed)

-- Indexes for performance
CREATE INDEX idx_user_work_periods_user_id ON user_work_periods(user_id);
CREATE INDEX idx_user_work_periods_weekday ON user_work_periods(weekday);
CREATE INDEX idx_user_work_periods_user_weekday ON user_work_periods(user_id, weekday);
-- Removed _ms field indexes - not needed

-- RLS Policies
ALTER TABLE user_work_periods ENABLE ROW LEVEL SECURITY;

-- Users can manage their own work periods
CREATE POLICY "Users can manage their own work periods" ON user_work_periods
  FOR ALL USING (auth.uid() = user_id);

-- Anyone can view work periods (for scheduling purposes)
CREATE POLICY "Anyone can view work periods" ON user_work_periods
  FOR SELECT USING (true);

-- Create a view for easy querying of user work hours
CREATE VIEW user_work_hours_view AS
SELECT
  wp.user_id,
  up.timezone,
  wp.weekday,
  wp.start_time,
  wp.end_time,
  -- Removed _ms fields from view
  wp.updated_at
FROM user_work_periods wp
JOIN user_profiles up ON wp.user_id = up.id
ORDER BY wp.user_id, wp.weekday, wp.start_time;

-- Comment for the view
COMMENT ON VIEW user_work_hours_view IS 'User work hours for cross-timezone availability querying';

-- ============================================================================
-- FREE TIME CALCULATION FUNCTIONS
-- ============================================================================

-- Helper function to generate date series
CREATE OR REPLACE FUNCTION generate_date_series(start_date date, end_date date)
RETURNS TABLE(series_date date, weekday integer) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d::date as series_date,
    EXTRACT(DOW FROM d)::integer as weekday
  FROM generate_series(start_date, end_date, '1 day'::interval) d;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate free time slots for a user within a date range
CREATE OR REPLACE FUNCTION get_user_free_time(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_timezone text DEFAULT NULL
)
RETURNS TABLE(
  date date,
  start_time timestamptz,
  end_time timestamptz,
  start_time_local time,
  end_time_local time,
  duration_minutes integer
) AS $$
DECLARE
  user_tz text;
BEGIN
  -- Get user's timezone if not provided
  IF p_timezone IS NULL THEN
    SELECT timezone INTO user_tz
    FROM user_profiles
    WHERE id = p_user_id;

    IF user_tz IS NULL THEN
      user_tz := 'UTC';
    END IF;
  ELSE
    user_tz := p_timezone;
  END IF;

  RETURN QUERY
  WITH date_work_periods AS (
    -- Generate all dates in range with their work periods
    SELECT DISTINCT
      ds.series_date,
      ds.weekday,
      uwp.id as work_period_id,
      uwp.start_time,
      uwp.end_time,
      -- Convert work period times to full timestamps for the specific date
      (ds.series_date::text || ' ' || uwp.start_time::text)::timestamp AT TIME ZONE user_tz as work_start_ts,
      (ds.series_date::text || ' ' || uwp.end_time::text)::timestamp AT TIME ZONE user_tz as work_end_ts
    FROM generate_date_series(p_start_date, p_end_date) ds
    INNER JOIN user_work_periods uwp ON ds.weekday = uwp.weekday AND uwp.user_id = p_user_id
  ),

  events_in_work_periods AS (
    -- Get all events that overlap with work periods, clipped to work boundaries
    SELECT
      dwp.series_date,
      dwp.work_period_id,
      dwp.work_start_ts,
      dwp.work_end_ts,
      e.id as event_id,
      -- Clip events to work period boundaries
      GREATEST(e.start_time, dwp.work_start_ts) as clipped_start,
      LEAST(e.end_time, dwp.work_end_ts) as clipped_end
    FROM date_work_periods dwp
    LEFT JOIN events e ON
      e.owner_id = p_user_id
      AND e.start_time::date = dwp.series_date
      AND e.all_day = false -- Exclude all-day events
      AND e.start_time < dwp.work_end_ts
      AND e.end_time > dwp.work_start_ts
    WHERE e.id IS NOT NULL -- Only actual events
  ),

  -- Create time boundaries (work start, work end, event starts, event ends)
  time_boundaries AS (
    -- Work period start times
    SELECT
      series_date,
      work_period_id,
      work_start_ts as boundary_time,
      'work_start' as boundary_type
    FROM date_work_periods

    UNION ALL

    -- Work period end times
    SELECT
      series_date,
      work_period_id,
      work_end_ts as boundary_time,
      'work_end' as boundary_type
    FROM date_work_periods

    UNION ALL

    -- Event start times
    SELECT
      series_date,
      work_period_id,
      clipped_start as boundary_time,
      'event_start' as boundary_type
    FROM events_in_work_periods

    UNION ALL

    -- Event end times
    SELECT
      series_date,
      work_period_id,
      clipped_end as boundary_time,
      'event_end' as boundary_type
    FROM events_in_work_periods
  ),

  -- Sort boundaries and create segments between them
  sorted_boundaries AS (
    SELECT
      series_date,
      work_period_id,
      boundary_time,
      boundary_type,
      LAG(boundary_time) OVER (PARTITION BY series_date, work_period_id ORDER BY boundary_time) as prev_boundary,
      LEAD(boundary_time) OVER (PARTITION BY series_date, work_period_id ORDER BY boundary_time) as next_boundary,
      ROW_NUMBER() OVER (PARTITION BY series_date, work_period_id ORDER BY boundary_time) as boundary_order
    FROM time_boundaries
  ),

  -- Generate potential free time segments
  potential_free_segments AS (
    SELECT DISTINCT
      sb.series_date,
      sb.work_period_id,
      sb.boundary_time as segment_start,
      sb.next_boundary as segment_end
    FROM sorted_boundaries sb
    WHERE sb.next_boundary IS NOT NULL
      AND sb.boundary_time < sb.next_boundary
  ),

  -- Check if segments are actually free (no events overlap them)
  free_segments AS (
    SELECT
      pfs.series_date,
      pfs.segment_start,
      pfs.segment_end,
      -- Check if this segment overlaps with any events
      NOT EXISTS (
        SELECT 1
        FROM events_in_work_periods eiwp
        WHERE eiwp.series_date = pfs.series_date
          AND eiwp.work_period_id = pfs.work_period_id
          AND eiwp.clipped_start < pfs.segment_end
          AND eiwp.clipped_end > pfs.segment_start
      ) as is_free,
      -- Ensure segment is within work period
      EXISTS (
        SELECT 1
        FROM date_work_periods dwp
        WHERE dwp.series_date = pfs.series_date
          AND dwp.work_period_id = pfs.work_period_id
          AND pfs.segment_start >= dwp.work_start_ts
          AND pfs.segment_end <= dwp.work_end_ts
      ) as is_within_work
    FROM potential_free_segments pfs
  )

  -- Final output with only actual free time slots
  SELECT DISTINCT
    fs.series_date as date,
    fs.segment_start as start_time,
    fs.segment_end as end_time,
    -- Local time for display purposes (no more _ms fields)
    (fs.segment_start AT TIME ZONE user_tz)::time as start_time_local,
    (fs.segment_end AT TIME ZONE user_tz)::time as end_time_local,
    EXTRACT(EPOCH FROM (fs.segment_end - fs.segment_start))::integer / 60 as duration_minutes
  FROM free_segments fs
  WHERE fs.is_free = true
    AND fs.is_within_work = true
    AND fs.segment_end > fs.segment_start -- Only valid time slots
  ORDER BY fs.series_date, fs.segment_start;

END;
$$ LANGUAGE plpgsql;

-- Add helpful indexes for events query
CREATE INDEX IF NOT EXISTS idx_events_owner_date_time
ON events(owner_id, start_time);

-- Grant permissions - anyone can view free time for scheduling meetings
GRANT EXECUTE ON FUNCTION get_user_free_time(uuid, date, date, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_date_series(date, date) TO authenticated, anon;

-- Add RLS policy for user_work_periods - anyone can view work periods for free time calculation
CREATE POLICY "Anyone can view work periods for free time calculation" ON user_work_periods
FOR SELECT TO authenticated, anon
USING (true);