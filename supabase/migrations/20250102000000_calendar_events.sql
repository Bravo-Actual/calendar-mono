-- ============================================================================
-- BASELINE MIGRATION: Calendar Events
-- Purpose: Calendar events system with categories, options, and user roles
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE event_category AS ENUM (
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
);

CREATE TYPE show_time_as_extended AS ENUM ('free', 'tentative', 'busy', 'oof', 'working_elsewhere');
CREATE TYPE time_defense_level AS ENUM ('flexible', 'normal', 'high', 'hard_block');
CREATE TYPE invite_type AS ENUM ('required', 'optional');
CREATE TYPE rsvp_status AS ENUM ('tentative', 'accepted', 'declined');
CREATE TYPE attendance_type AS ENUM ('in_person', 'virtual');
CREATE TYPE user_role AS ENUM ('viewer', 'contributor', 'owner', 'delegate_full');

-- ============================================================================
-- EVENTS TABLES
-- ============================================================================

-- Create events table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Don't delete event if creator is deleted
  series_id UUID, -- Will be used for meeting series in the future
  title TEXT NOT NULL,
  agenda TEXT,
  online_event BOOLEAN DEFAULT false,
  online_join_link TEXT,
  online_chat_link TEXT,
  in_person BOOLEAN DEFAULT false,
  start_time TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL, -- duration in minutes
  all_day BOOLEAN DEFAULT false,
  private BOOLEAN DEFAULT false,
  request_responses BOOLEAN DEFAULT false,
  allow_forwarding BOOLEAN DEFAULT true,
  hide_attendees BOOLEAN DEFAULT false,
  history JSONB DEFAULT '[]'::jsonb, -- Array of change log entries
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_event_categories table
CREATE TABLE user_event_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color event_category DEFAULT 'neutral',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate category names per user
);

-- Create user_event_calendars table
CREATE TABLE user_event_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color event_category DEFAULT 'blue',
  is_default BOOLEAN DEFAULT false,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate calendar names per user
);

-- Create user_event_options table
CREATE TABLE user_event_options (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES user_event_calendars(id) ON DELETE SET NULL, -- Reference to user's calendar
  category UUID REFERENCES user_event_categories(id) ON DELETE SET NULL, -- Reference to user's custom category
  show_time_as show_time_as_extended DEFAULT 'busy',
  time_defense_level time_defense_level DEFAULT 'normal',
  ai_managed BOOLEAN DEFAULT false,
  ai_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- Create event_user_roles table for managing invitations and access control
CREATE TABLE event_user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invite_type invite_type NOT NULL,
  rsvp rsvp_status,
  rsvp_timestamp TIMESTAMPTZ,
  attendance_type attendance_type,
  following BOOLEAN DEFAULT false,
  role user_role DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- One role per user per event
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS for events tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_event_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_event_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_user_roles ENABLE ROW LEVEL SECURITY;

-- Events RLS policies
-- Users can see events they own or events they have options for
CREATE POLICY "Users can view events they own or have options for"
  ON events FOR SELECT
  USING (
    auth.uid() = owner OR
    auth.uid() = creator OR
    EXISTS (
      SELECT 1 FROM user_event_options
      WHERE event_id = events.id AND user_id = auth.uid()
    )
  );

-- Users can insert events they will own
CREATE POLICY "Users can create events they own"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = owner AND auth.uid() = creator);

-- Users can update events they own
CREATE POLICY "Users can update events they own"
  ON events FOR UPDATE
  USING (auth.uid() = owner)
  WITH CHECK (auth.uid() = owner);

-- Users can delete events they own
CREATE POLICY "Users can delete events they own"
  ON events FOR DELETE
  USING (auth.uid() = owner);

-- User event categories RLS policies
CREATE POLICY "Users can CRUD their own event categories"
  ON user_event_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User event calendars RLS policies
CREATE POLICY "Users can CRUD their own event calendars"
  ON user_event_calendars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User event options RLS policies - users can only see their own options
CREATE POLICY "Users can CRUD their own event options"
  ON user_event_options FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Event user roles RLS policies
-- Users can view roles for events they own, or roles that include them
CREATE POLICY "Users can view event roles for events they own or are invited to"
  ON event_user_roles FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.owner = auth.uid()
    )
  );

-- Event owners can manage all roles for their events
CREATE POLICY "Event owners can manage roles for their events"
  ON event_user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.owner = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.owner = auth.uid()
    )
  );

-- Users can update rsvp, attendance_type, following for meetings they have a role on
CREATE POLICY "Users can update their own RSVP and preferences"
  ON event_user_roles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Events table triggers
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_event_categories_updated_at
  BEFORE UPDATE ON user_event_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_event_calendars_updated_at
  BEFORE UPDATE ON user_event_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_event_options_updated_at
  BEFORE UPDATE ON user_event_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_user_roles_updated_at
  BEFORE UPDATE ON event_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create default calendar for a user
CREATE OR REPLACE FUNCTION create_default_calendar(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
  calendar_id UUID;
BEGIN
  INSERT INTO user_event_calendars (user_id, name, color, is_default, visible)
  VALUES (user_id_param, 'My Calendar', 'blue', true, true)
  RETURNING id INTO calendar_id;

  RETURN calendar_id;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create user_event_options for event owner/creator
CREATE OR REPLACE FUNCTION create_owner_event_options()
RETURNS TRIGGER AS $$
DECLARE
  owner_calendar_id UUID;
  creator_calendar_id UUID;
BEGIN
  -- Get or create default calendar for owner
  SELECT id INTO owner_calendar_id
  FROM user_event_calendars
  WHERE user_id = NEW.owner AND is_default = true
  LIMIT 1;

  IF owner_calendar_id IS NULL THEN
    owner_calendar_id := create_default_calendar(NEW.owner);
  END IF;

  -- Create user_event_options for the event owner
  INSERT INTO user_event_options (event_id, user_id, calendar_id, show_time_as, time_defense_level)
  VALUES (NEW.id, NEW.owner, owner_calendar_id, 'busy', 'normal')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- If creator is different from owner, create options for creator too
  IF NEW.creator != NEW.owner THEN
    -- Get or create default calendar for creator
    SELECT id INTO creator_calendar_id
    FROM user_event_calendars
    WHERE user_id = NEW.creator AND is_default = true
    LIMIT 1;

    IF creator_calendar_id IS NULL THEN
      creator_calendar_id := create_default_calendar(NEW.creator);
    END IF;

    INSERT INTO user_event_options (event_id, user_id, calendar_id, show_time_as, time_defense_level)
    VALUES (NEW.id, NEW.creator, creator_calendar_id, 'busy', 'normal')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create user_event_options for owner/creator
CREATE TRIGGER create_owner_event_options_trigger
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_owner_event_options();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Create indexes for events
CREATE INDEX events_owner_idx ON events(owner);
CREATE INDEX events_creator_idx ON events(creator);
CREATE INDEX events_series_id_idx ON events(series_id);
CREATE INDEX events_start_time_idx ON events(start_time);
CREATE INDEX events_duration_idx ON events(duration);
CREATE INDEX events_all_day_idx ON events(all_day);
CREATE INDEX events_private_idx ON events(private);

-- Create indexes for user_event_categories
CREATE INDEX user_event_categories_user_id_idx ON user_event_categories(user_id);
CREATE INDEX user_event_categories_color_idx ON user_event_categories(color);
CREATE INDEX user_event_categories_is_default_idx ON user_event_categories(is_default);

-- Create indexes for user_event_calendars
CREATE INDEX user_event_calendars_user_id_idx ON user_event_calendars(user_id);
CREATE INDEX user_event_calendars_color_idx ON user_event_calendars(color);
CREATE INDEX user_event_calendars_is_default_idx ON user_event_calendars(is_default);
CREATE INDEX user_event_calendars_visible_idx ON user_event_calendars(visible);

-- Create indexes for user_event_options
CREATE INDEX user_event_options_event_id_idx ON user_event_options(event_id);
CREATE INDEX user_event_options_user_id_idx ON user_event_options(user_id);
CREATE INDEX user_event_options_calendar_id_idx ON user_event_options(calendar_id);
CREATE INDEX user_event_options_category_idx ON user_event_options(category);
CREATE INDEX user_event_options_show_time_as_idx ON user_event_options(show_time_as);
CREATE INDEX user_event_options_ai_managed_idx ON user_event_options(ai_managed);

-- Create indexes for event_user_roles
CREATE INDEX event_user_roles_event_id_idx ON event_user_roles(event_id);
CREATE INDEX event_user_roles_user_id_idx ON event_user_roles(user_id);
CREATE INDEX event_user_roles_invite_type_idx ON event_user_roles(invite_type);
CREATE INDEX event_user_roles_rsvp_idx ON event_user_roles(rsvp);
CREATE INDEX event_user_roles_role_idx ON event_user_roles(role);
CREATE INDEX event_user_roles_following_idx ON event_user_roles(following);