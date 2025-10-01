-- User Annotations Table
-- Generic table for storing user and AI annotations (highlights, notes, etc.)

-- Create annotation type enum
CREATE TYPE annotation_type AS ENUM (
  'ai_event_highlight',
  'ai_time_highlight'
);

-- Create user_annotations table
CREATE TABLE user_annotations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type annotation_type NOT NULL,

  -- Event reference (for ai_event_highlight, with cascade delete)
  event_id uuid NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Time range (required for both types)
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,

  -- Computed timestamp columns for fast range queries
  start_time_ms BIGINT GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM start_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED,
  end_time_ms BIGINT GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM end_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED,

  -- Content fields
  emoji_icon text NULL,
  title text NULL,
  message text NULL,

  -- Display properties
  visible boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),

  -- Constraints
  CONSTRAINT valid_event_highlight CHECK (
    (type = 'ai_event_highlight' AND event_id IS NOT NULL) OR
    (type = 'ai_time_highlight' AND event_id IS NULL)
  ),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Indexes for performance
CREATE INDEX idx_user_annotations_user_type ON user_annotations(user_id, type);
CREATE INDEX idx_user_annotations_time_range ON user_annotations(start_time, end_time);
CREATE INDEX idx_user_annotations_time_range_ms ON user_annotations(start_time_ms, end_time_ms);
CREATE INDEX idx_user_annotations_user_start_ms ON user_annotations(user_id, start_time_ms);
CREATE INDEX idx_user_annotations_user_end_ms ON user_annotations(user_id, end_time_ms);
CREATE INDEX idx_user_annotations_event ON user_annotations(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_user_annotations_visible ON user_annotations(user_id, visible);

-- Row Level Security (RLS)
ALTER TABLE user_annotations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own annotations
CREATE POLICY "Users can access their own annotations" ON user_annotations
  FOR ALL USING (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_user_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_annotations_updated_at
  BEFORE UPDATE ON user_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_annotations_updated_at();

-- Auto-sync event highlight times with referenced events
-- Function to sync annotation times with event times
CREATE OR REPLACE FUNCTION sync_event_highlight_times()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process ai_event_highlight annotations with event_id
  IF NEW.type = 'ai_event_highlight' AND NEW.event_id IS NOT NULL THEN
    -- Get the event's start and end times
    SELECT e.start_time, e.end_time
    INTO NEW.start_time, NEW.end_time
    FROM events e
    WHERE e.id = NEW.event_id;

    -- If event not found, raise an error
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced event % not found', NEW.event_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update all related event highlights when an event changes
CREATE OR REPLACE FUNCTION update_related_event_highlights()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if start_time or end_time changed
  IF OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    -- Update all event highlights that reference this event
    UPDATE user_annotations
    SET
      start_time = NEW.start_time,
      end_time = NEW.end_time,
      updated_at = NOW()
    WHERE
      type = 'ai_event_highlight'
      AND event_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user_annotations for INSERT/UPDATE
-- This ensures new event highlights get the correct times
CREATE TRIGGER sync_event_highlight_times_trigger
  BEFORE INSERT OR UPDATE ON user_annotations
  FOR EACH ROW
  EXECUTE FUNCTION sync_event_highlight_times();

-- Trigger on events for UPDATE
-- This updates all related event highlights when an event's times change
CREATE TRIGGER update_related_event_highlights_trigger
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_related_event_highlights();

-- Comments explaining the behavior
COMMENT ON FUNCTION sync_event_highlight_times() IS 'Automatically sets start_time and end_time for event highlights based on the referenced event';
COMMENT ON FUNCTION update_related_event_highlights() IS 'Updates all event highlights when the referenced event times change';

-- Grant permissions
GRANT ALL ON user_annotations TO authenticated;
GRANT USAGE ON TYPE annotation_type TO authenticated;