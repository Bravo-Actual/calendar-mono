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

CREATE TYPE show_time_as AS ENUM ('free', 'tentative', 'busy', 'oof', 'working_elsewhere');
CREATE TYPE time_defense_level AS ENUM ('flexible', 'normal', 'high', 'hard_block');
CREATE TYPE invite_type AS ENUM ('required', 'optional');
CREATE TYPE rsvp_status AS ENUM ('tentative', 'accepted', 'declined');
CREATE TYPE attendance_type AS ENUM ('in_person', 'virtual', 'unknown');
CREATE TYPE user_role AS ENUM ('viewer', 'contributor', 'owner', 'delegate_full', 'attendee');

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
  series_id UUID DEFAULT NULL,
  title TEXT NOT NULL,
  agenda TEXT DEFAULT NULL,
  online_event BOOLEAN DEFAULT false NOT NULL,
  online_join_link TEXT DEFAULT NULL,
  online_chat_link TEXT DEFAULT NULL,
  in_person BOOLEAN DEFAULT false NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  -- Computed timestamp columns for fast range queries
  start_time_ms BIGINT GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM start_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED,
  end_time_ms BIGINT GENERATED ALWAYS AS ((EXTRACT(EPOCH FROM end_time AT TIME ZONE 'UTC') * 1000)::bigint) STORED,
  all_day BOOLEAN DEFAULT false NOT NULL,
  private BOOLEAN DEFAULT false NOT NULL,
  request_responses BOOLEAN DEFAULT true NOT NULL,
  allow_forwarding BOOLEAN DEFAULT true NOT NULL,
  allow_reschedule_request BOOLEAN DEFAULT true NOT NULL,
  hide_attendees BOOLEAN DEFAULT false NOT NULL,
  history JSONB DEFAULT '[]'::jsonb,
  discovery event_discovery_types DEFAULT 'audience_only' NOT NULL,
  join_model event_join_model_types DEFAULT 'invite_only' NOT NULL,
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
  show_time_as show_time_as DEFAULT 'busy',
  time_defense_level time_defense_level DEFAULT 'normal',
  ai_managed BOOLEAN DEFAULT false NOT NULL,
  ai_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- Create event_rsvps table
CREATE TABLE event_rsvps (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rsvp_status rsvp_status DEFAULT 'tentative' NOT NULL,
  attendance_type attendance_type DEFAULT 'unknown' NOT NULL,
  note TEXT DEFAULT NULL,
  following BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id) -- Composite primary key
);

-- Create event_users table (renamed from event_user_roles)
CREATE TABLE event_users (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role DEFAULT 'attendee' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id) -- Composite primary key
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS for events tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_details_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_users ENABLE ROW LEVEL SECURITY;

-- Events RLS policies
-- Users can see events they own or events they have personal details for
CREATE POLICY "Users can view events they own or have personal details for"
  ON events FOR SELECT
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM event_details_personal
      WHERE event_id = events.id AND user_id = auth.uid()
    )
  );

-- Users can insert events they will own
CREATE POLICY "Users can create events they own"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

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

-- Event RSVPs RLS policies
-- All users for that event can view all RSVPs for that event, event owner has full control, user has read/write access to their own
CREATE POLICY "Users can view RSVPs for events they are invited to"
  ON event_rsvps FOR SELECT
  USING (
    -- Event owner can see all RSVPs
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_rsvps.event_id AND events.owner_id = auth.uid()
    ) OR
    -- Users in the event can see all RSVPs for that event
    EXISTS (
      SELECT 1 FROM event_users
      WHERE event_users.event_id = event_rsvps.event_id AND event_users.user_id = auth.uid()
    )
  );

-- Event owners can manage all RSVPs for their events
CREATE POLICY "Event owners can manage all RSVPs for their events"
  ON event_rsvps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_rsvps.event_id AND events.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_rsvps.event_id AND events.owner_id = auth.uid()
    )
  );

-- Users can manage their own RSVP
CREATE POLICY "Users can manage their own RSVP"
  ON event_rsvps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Event Users RLS policies
-- All users for that event can view all users for that event, event owner has full control
CREATE POLICY "Users can view event users for events they are invited to"
  ON event_users FOR SELECT
  USING (
    -- Event owner can see all users
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_users.event_id AND events.owner_id = auth.uid()
    ) OR
    -- Users can see users for events they have personal details for (non-recursive)
    EXISTS (
      SELECT 1 FROM event_details_personal
      WHERE event_details_personal.event_id = event_users.event_id AND event_details_personal.user_id = auth.uid()
    )
  );

-- Event owners can manage all users for their events
CREATE POLICY "Event owners can manage all users for their events"
  ON event_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_users.event_id AND events.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_users.event_id AND events.owner_id = auth.uid()
    )
  );

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

CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_users_updated_at
  BEFORE UPDATE ON event_users
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

-- Function to automatically create event_details_personal when users are added to events
CREATE OR REPLACE FUNCTION create_user_event_details()
RETURNS TRIGGER AS $$
DECLARE
  user_calendar_id UUID;
  default_show_time_as show_time_as;
  event_owner_id UUID;
BEGIN
  -- Get the event owner
  SELECT owner_id INTO event_owner_id
  FROM events
  WHERE id = NEW.event_id;

  -- Get or create default calendar for the user being added
  SELECT id INTO user_calendar_id
  FROM user_calendars
  WHERE user_id = NEW.user_id AND type = 'default'
  LIMIT 1;

  IF user_calendar_id IS NULL THEN
    user_calendar_id := create_default_calendar(NEW.user_id);
  END IF;

  -- Set default show_time_as based on whether user is the owner
  IF NEW.user_id = event_owner_id THEN
    default_show_time_as := 'busy';  -- Owner shows as busy
  ELSE
    default_show_time_as := 'tentative';  -- Invitees show as tentative
  END IF;

  -- Create event_details_personal for this user
  INSERT INTO event_details_personal (event_id, user_id, calendar_id, show_time_as, time_defense_level)
  VALUES (NEW.event_id, NEW.user_id, user_calendar_id, default_show_time_as, 'normal')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Removed: calculate_event_timestamps function (no longer needed)

-- Trigger to automatically create event_details_personal when users are added to events
CREATE TRIGGER create_user_event_details_trigger
  AFTER INSERT ON event_users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_event_details();

-- Removed: timestamp calculation triggers (no longer needed)

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
CREATE INDEX events_discovery_idx ON events(discovery);
CREATE INDEX events_join_model_idx ON events(join_model);
CREATE INDEX events_series_id_idx ON events(series_id);
CREATE INDEX events_start_time_idx ON events(start_time);
CREATE INDEX events_end_time_idx ON events(end_time);
CREATE INDEX events_start_time_ms_idx ON events(start_time_ms);
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

-- Create indexes for event_rsvps
CREATE INDEX event_rsvps_event_id_idx ON event_rsvps(event_id);
CREATE INDEX event_rsvps_user_id_idx ON event_rsvps(user_id);
CREATE INDEX event_rsvps_rsvp_status_idx ON event_rsvps(rsvp_status);
CREATE INDEX event_rsvps_attendance_type_idx ON event_rsvps(attendance_type);
CREATE INDEX event_rsvps_following_idx ON event_rsvps(following);

-- Create indexes for event_users
CREATE INDEX event_users_event_id_idx ON event_users(event_id);
CREATE INDEX event_users_user_id_idx ON event_users(user_id);
CREATE INDEX event_users_role_idx ON event_users(role);

-- ============================================================================
-- PERFORMANCE INDEXES (for offline-first improvements)
-- ============================================================================

-- Compound indexes for better query performance
CREATE INDEX events_time_range_idx ON events (start_time, end_time);
CREATE INDEX events_owner_updated_idx ON events (owner_id, updated_at);

-- Owner-scoped millisecond indexes for optimal overlap queries (offline-first)
CREATE INDEX events_owner_start_ms_idx ON events (owner_id, start_time_ms);
CREATE INDEX events_owner_end_ms_idx ON events (owner_id, end_time_ms);

-- Event details personal compound indexes
CREATE INDEX event_details_personal_user_event_idx ON event_details_personal (user_id, event_id);
CREATE INDEX event_details_personal_user_updated_idx ON event_details_personal (user_id, updated_at);
CREATE INDEX event_details_personal_user_calendar_idx ON event_details_personal (user_id, calendar_id);

-- Event RSVPs compound indexes
CREATE INDEX event_rsvps_user_event_idx ON event_rsvps (user_id, event_id);
CREATE INDEX event_rsvps_user_updated_idx ON event_rsvps (user_id, updated_at);
CREATE INDEX event_rsvps_event_updated_idx ON event_rsvps (event_id, updated_at);

-- Event users compound indexes
CREATE INDEX event_users_user_event_idx ON event_users (user_id, event_id);
CREATE INDEX event_users_user_updated_idx ON event_users (user_id, updated_at);
CREATE INDEX event_users_event_updated_idx ON event_users (event_id, updated_at);