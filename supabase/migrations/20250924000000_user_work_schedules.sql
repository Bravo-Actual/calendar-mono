-- Create user work periods table for queryable work hours

CREATE TABLE user_work_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday integer NOT NULL, -- 0=Sunday, 1=Monday, etc.
  start_time time NOT NULL, -- 09:00 (in user's timezone)
  end_time time NOT NULL,   -- 17:00 (in user's timezone)

  -- Computed fields for easier querying (similar to events table)
  start_time_ms bigint, -- unix epoch start time in milliseconds (computed)
  end_time_ms bigint,   -- unix epoch end time in milliseconds (computed)

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_weekday CHECK (weekday >= 0 AND weekday <= 6),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Add updated_at trigger
CREATE TRIGGER update_user_work_periods_updated_at
  BEFORE UPDATE ON user_work_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate work period timestamps from weekday and times
CREATE OR REPLACE FUNCTION calculate_work_period_timestamps()
RETURNS TRIGGER AS $$
DECLARE
  user_tz text;
  base_date date;
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  -- Get user's timezone from user_profiles
  SELECT timezone INTO user_tz
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF user_tz IS NULL THEN
    user_tz := 'UTC';
  END IF;

  -- Use a reference date (2024-01-07 was a Sunday)
  -- Add weekday days to get the correct day of week
  base_date := '2024-01-07'::date + (NEW.weekday || ' days')::interval;

  -- Create full timestamps in user's timezone then convert to UTC
  start_ts := (base_date || ' ' || NEW.start_time)::timestamp AT TIME ZONE user_tz;
  end_ts := (base_date || ' ' || NEW.end_time)::timestamp AT TIME ZONE user_tz;

  -- Calculate milliseconds from unix epoch (same as events table)
  NEW.start_time_ms := EXTRACT(EPOCH FROM start_ts) * 1000;
  NEW.end_time_ms := EXTRACT(EPOCH FROM end_ts) * 1000;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically calculate timestamps on insert/update
CREATE TRIGGER user_work_periods_calculate_timestamps_insert
  BEFORE INSERT ON user_work_periods
  FOR EACH ROW
  EXECUTE FUNCTION calculate_work_period_timestamps();

CREATE TRIGGER user_work_periods_calculate_timestamps_update
  BEFORE UPDATE ON user_work_periods
  FOR EACH ROW
  WHEN (OLD.weekday IS DISTINCT FROM NEW.weekday OR OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time OR OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION calculate_work_period_timestamps();

-- Indexes for performance
CREATE INDEX idx_user_work_periods_user_id ON user_work_periods(user_id);
CREATE INDEX idx_user_work_periods_weekday ON user_work_periods(weekday);
CREATE INDEX idx_user_work_periods_user_weekday ON user_work_periods(user_id, weekday);
CREATE INDEX idx_user_work_periods_start_time_ms ON user_work_periods(start_time_ms);
CREATE INDEX idx_user_work_periods_end_time_ms ON user_work_periods(end_time_ms);
CREATE INDEX idx_user_work_periods_time_range_ms ON user_work_periods(start_time_ms, end_time_ms);

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
  wp.start_time_ms,
  wp.end_time_ms,
  wp.updated_at
FROM user_work_periods wp
JOIN user_profiles up ON wp.user_id = up.id
ORDER BY wp.user_id, wp.weekday, wp.start_time;

-- Comment for the view
COMMENT ON VIEW user_work_hours_view IS 'User work hours with computed UTC timestamps for cross-timezone availability querying';