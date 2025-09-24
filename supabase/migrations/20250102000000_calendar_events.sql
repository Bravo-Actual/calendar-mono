-- ============================================================================
-- BASELINE MIGRATION: Calendar Events
-- Purpose: Calendar events system with categories, options, and user roles
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE colors AS ENUM (
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
);

CREATE TYPE show_time_as_extended AS ENUM ('free', 'tentative', 'busy', 'oof', 'working_elsewhere');
CREATE TYPE time_defense_level AS ENUM ('flexible', 'normal', 'high', 'hard_block');
CREATE TYPE invite_type AS ENUM ('required', 'optional');
CREATE TYPE rsvp_status AS ENUM ('tentative', 'accepted', 'declined');
CREATE TYPE attendance_type AS ENUM ('in_person', 'virtual');
CREATE TYPE user_role AS ENUM ('viewer', 'contributor', 'owner', 'delegate_full');

-- New enum types for discovery and join models
CREATE TYPE event_discovery_types AS ENUM ('audience_only', 'tenant_only', 'public');
CREATE TYPE event_join_model_types AS ENUM ('invite_only', 'request_to_join', 'open_join');
CREATE TYPE calendar_type AS ENUM ('default', 'archive', 'user');

-- ============================================================================
-- EVENTS TABLES
-- ============================================================================

-- Create events table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Don't delete event if creator is deleted
  series_id UUID, -- Will be used for meeting series in the future
  title TEXT NOT NULL,
  agenda TEXT,
  online_event BOOLEAN DEFAULT false NOT NULL,
  online_join_link TEXT,
  online_chat_link TEXT,
  in_person BOOLEAN DEFAULT false NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL, -- duration in minutes
  start_time_ms BIGINT, -- computed unix epoch start time in milliseconds (populated by trigger)
  end_time_ms BIGINT, -- computed unix epoch end time in milliseconds (populated by trigger)
  all_day BOOLEAN DEFAULT false NOT NULL,
  private BOOLEAN DEFAULT false NOT NULL,
  request_responses BOOLEAN DEFAULT false NOT NULL,
  allow_forwarding BOOLEAN DEFAULT true NOT NULL,
  invite_allow_reschedule_proposals BOOLEAN DEFAULT true NOT NULL,
  hide_attendees BOOLEAN DEFAULT false NOT NULL,
  history JSONB DEFAULT '[]'::jsonb, -- Array of change log entries
  discovery event_discovery_types DEFAULT 'audience_only',
  join_model event_join_model_types DEFAULT 'invite_only',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_categories table
CREATE TABLE user_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color colors DEFAULT 'neutral',
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate category names per user
);

-- Create user_calendars table
CREATE TABLE user_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color colors DEFAULT 'neutral',
  type calendar_type DEFAULT 'user' NOT NULL,
  visible BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate calendar names per user
);

-- Create event_details_personal table (replaces user_event_options)
CREATE TABLE event_details_personal (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES user_calendars(id) ON DELETE SET NULL, -- Reference to user's calendar
  category_id UUID REFERENCES user_categories(id) ON DELETE SET NULL, -- Reference to user's custom category
  show_time_as show_time_as_extended DEFAULT 'busy',
  time_defense_level time_defense_level DEFAULT 'normal',
  ai_managed BOOLEAN DEFAULT false NOT NULL,
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
  following BOOLEAN DEFAULT false NOT NULL,
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
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_details_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_user_roles ENABLE ROW LEVEL SECURITY;

-- Events RLS policies
-- Users can see events they own or events they have personal details for
CREATE POLICY "Users can view events they own or have personal details for"
  ON events FOR SELECT
  USING (
    auth.uid() = owner_id OR
    auth.uid() = creator_id OR
    EXISTS (
      SELECT 1 FROM event_details_personal
      WHERE event_id = events.id AND user_id = auth.uid()
    )
  );

-- Users can insert events they will own
CREATE POLICY "Users can create events they own"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND auth.uid() = creator_id);

-- Users can update events they own
CREATE POLICY "Users can update events they own"
  ON events FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete events they own
CREATE POLICY "Users can delete events they own"
  ON events FOR DELETE
  USING (auth.uid() = owner_id);

-- User categories RLS policies
CREATE POLICY "Users can view and update their own categories"
  ON user_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON user_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON user_categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent deletion of default category
CREATE POLICY "Users cannot delete default categories"
  ON user_categories FOR DELETE
  USING (auth.uid() = user_id AND is_default = false);

-- User calendars RLS policies
CREATE POLICY "Users can view and update their own calendars"
  ON user_calendars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendars"
  ON user_calendars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendars"
  ON user_calendars FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent deletion of default and archive calendars
CREATE POLICY "Users cannot delete default and archive calendars"
  ON user_calendars FOR DELETE
  USING (auth.uid() = user_id AND type = 'user');

-- Event details personal RLS policies - users can only see their own personal details
CREATE POLICY "Users can CRUD their own event personal details"
  ON event_details_personal FOR ALL
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
      WHERE events.id = event_user_roles.event_id AND events.owner_id = auth.uid()
    )
  );

-- Event owners can manage all roles for their events
CREATE POLICY "Event owners can manage roles for their events"
  ON event_user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.owner_id = auth.uid()
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

CREATE TRIGGER update_user_categories_updated_at
  BEFORE UPDATE ON user_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_calendars_updated_at
  BEFORE UPDATE ON user_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_details_personal_updated_at
  BEFORE UPDATE ON event_details_personal
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
  INSERT INTO public.user_calendars (user_id, name, color, type, visible)
  VALUES (user_id_param, 'My Calendar', 'neutral', 'default', true)
  ON CONFLICT (user_id, name) DO UPDATE SET type = 'default'
  RETURNING id INTO calendar_id;

  RETURN calendar_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default category for a user
CREATE OR REPLACE FUNCTION create_default_category(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
  category_id UUID;
BEGIN
  INSERT INTO public.user_categories (user_id, name, color, is_default)
  VALUES (user_id_param, 'General', 'neutral', true)
  ON CONFLICT (user_id, name) DO UPDATE SET is_default = true
  RETURNING id INTO category_id;

  RETURN category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create user defaults when a new user is created
CREATE OR REPLACE FUNCTION create_user_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default calendar
  PERFORM public.create_default_calendar(NEW.id);

  -- Create archive calendar
  INSERT INTO public.user_calendars (user_id, name, color, type, visible)
  VALUES (NEW.id, 'Archive', 'slate', 'archive', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Create default category
  PERFORM public.create_default_category(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically create event_details_personal for event owner/creator
CREATE OR REPLACE FUNCTION create_owner_event_details()
RETURNS TRIGGER AS $$
DECLARE
  owner_calendar_id UUID;
  creator_calendar_id UUID;
BEGIN
  -- Get or create default calendar for owner
  SELECT id INTO owner_calendar_id
  FROM user_calendars
  WHERE user_id = NEW.owner_id AND type = 'default'
  LIMIT 1;

  IF owner_calendar_id IS NULL THEN
    owner_calendar_id := create_default_calendar(NEW.owner_id);
  END IF;

  -- Create event_details_personal for the event owner
  INSERT INTO event_details_personal (event_id, user_id, calendar_id, show_time_as, time_defense_level)
  VALUES (NEW.id, NEW.owner_id, owner_calendar_id, 'busy', 'normal')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- If creator is different from owner, create details for creator too
  IF NEW.creator_id IS NOT NULL AND NEW.creator_id != NEW.owner_id THEN
    -- Get or create default calendar for creator
    SELECT id INTO creator_calendar_id
    FROM user_calendars
    WHERE user_id = NEW.creator_id AND type = 'default'
    LIMIT 1;

    IF creator_calendar_id IS NULL THEN
      creator_calendar_id := create_default_calendar(NEW.creator_id);
    END IF;

    INSERT INTO event_details_personal (event_id, user_id, calendar_id, show_time_as, time_defense_level)
    VALUES (NEW.id, NEW.creator_id, creator_calendar_id, 'busy', 'normal')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate event timestamps from start_time and duration
CREATE OR REPLACE FUNCTION calculate_event_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate start_time_ms (unix epoch in milliseconds)
  NEW.start_time_ms = EXTRACT(EPOCH FROM NEW.start_time) * 1000;

  -- Calculate end_time_ms (start_time + duration in milliseconds)
  NEW.end_time_ms = EXTRACT(EPOCH FROM NEW.start_time + INTERVAL '1 minute' * NEW.duration) * 1000;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create event_details_personal for owner/creator
CREATE TRIGGER create_owner_event_details_trigger
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_owner_event_details();

-- Triggers to automatically calculate timestamps on insert/update
CREATE TRIGGER events_calculate_timestamps_insert
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION calculate_event_timestamps();

CREATE TRIGGER events_calculate_timestamps_update
  BEFORE UPDATE ON events
  FOR EACH ROW
  WHEN (OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION calculate_event_timestamps();

-- Trigger to create default calendar and category for new users
CREATE TRIGGER create_user_defaults_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_defaults();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Create indexes for events
CREATE INDEX events_owner_id_idx ON events(owner_id);
CREATE INDEX events_creator_id_idx ON events(creator_id);
CREATE INDEX events_discovery_idx ON events(discovery);
CREATE INDEX events_join_model_idx ON events(join_model);
CREATE INDEX events_series_id_idx ON events(series_id);
CREATE INDEX events_start_time_idx ON events(start_time);
CREATE INDEX events_duration_idx ON events(duration);
CREATE INDEX events_start_time_ms_idx ON events(start_time_ms);
CREATE INDEX events_end_time_ms_idx ON events(end_time_ms);
CREATE INDEX events_time_range_ms_idx ON events(start_time_ms, end_time_ms);
CREATE INDEX events_all_day_idx ON events(all_day);
CREATE INDEX events_private_idx ON events(private);

-- Create indexes for user_categories
CREATE INDEX user_categories_user_id_idx ON user_categories(user_id);
CREATE INDEX user_categories_color_idx ON user_categories(color);
CREATE INDEX user_categories_is_default_idx ON user_categories(is_default);

-- Create indexes for user_calendars
CREATE INDEX user_calendars_user_id_idx ON user_calendars(user_id);
CREATE INDEX user_calendars_color_idx ON user_calendars(color);
CREATE INDEX user_calendars_type_idx ON user_calendars(type);
CREATE INDEX user_calendars_visible_idx ON user_calendars(visible);

-- Create indexes for event_details_personal
CREATE INDEX event_details_personal_event_id_idx ON event_details_personal(event_id);
CREATE INDEX event_details_personal_user_id_idx ON event_details_personal(user_id);
CREATE INDEX event_details_personal_calendar_id_idx ON event_details_personal(calendar_id);
CREATE INDEX event_details_personal_category_id_idx ON event_details_personal(category_id);
CREATE INDEX event_details_personal_show_time_as_idx ON event_details_personal(show_time_as);
CREATE INDEX event_details_personal_ai_managed_idx ON event_details_personal(ai_managed);

-- Create indexes for event_user_roles
CREATE INDEX event_user_roles_event_id_idx ON event_user_roles(event_id);
CREATE INDEX event_user_roles_user_id_idx ON event_user_roles(user_id);
CREATE INDEX event_user_roles_invite_type_idx ON event_user_roles(invite_type);
CREATE INDEX event_user_roles_rsvp_idx ON event_user_roles(rsvp);
CREATE INDEX event_user_roles_role_idx ON event_user_roles(role);
CREATE INDEX event_user_roles_following_idx ON event_user_roles(following);