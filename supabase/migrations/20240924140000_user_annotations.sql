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

-- Grant permissions
GRANT ALL ON user_annotations TO authenticated;
GRANT USAGE ON TYPE annotation_type TO authenticated;