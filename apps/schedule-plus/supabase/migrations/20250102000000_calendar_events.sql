-- ============================================================================
-- BASELINE MIGRATION: Calendar Events (Refactored Structure)
-- Purpose: Refined calendar events system with separated data layers
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE event_colors AS ENUM (
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

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Events table: Basic shared event data (minimal details, shareable)
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- owner of the event
  is_private BOOLEAN DEFAULT false,
  allow_forwarding BOOLEAN DEFAULT true,
  allow_reschedule_proposals BOOLEAN DEFAULT true,
  hide_attendees BOOLEAN DEFAULT false,
  all_day BOOLEAN DEFAULT false,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  discovery event_discovery_types DEFAULT 'audience_only',
  join_model event_join_model_types DEFAULT 'invite_only',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event details: Rich event information (owned by creator)
CREATE TABLE event_details (
  id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  agenda TEXT,
  request_responses BOOLEAN DEFAULT true,
  online_event BOOLEAN DEFAULT false,
  online_join_link TEXT,
  online_chat_link TEXT,
  in_person BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event details personal: Personal data extension for events (per-user customization)
CREATE TABLE event_details_personal (
  id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  calendar_id UUID, -- Will reference user_calendars.id
  category_id UUID, -- Will reference user_categories.id
  show_time_as show_time_as_extended DEFAULT 'busy',
  time_defense_level time_defense_level DEFAULT 'normal',
  ai_managed BOOLEAN DEFAULT false,
  ai_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, user_id) -- One personal config per user per event
);

-- User categories: User-defined event categories (renamed from user_event_categories)
CREATE TABLE user_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color event_colors DEFAULT 'neutral',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate category names per user
);

-- User calendars: User-defined calendars (renamed from user_event_calendars)
CREATE TABLE user_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color event_colors DEFAULT 'blue',
  is_default BOOLEAN DEFAULT false,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate calendar names per user
);

-- Event user roles: User roles and participation in events
CREATE TABLE event_user_roles (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role DEFAULT 'viewer',
  invite_type invite_type NOT NULL,
  rsvp rsvp_status,
  rsvp_timestamp TIMESTAMPTZ,
  attendance_type attendance_type,
  following BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id) -- One role per user per event
);

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key constraints for event_details_personal
ALTER TABLE event_details_personal
  ADD CONSTRAINT fk_event_details_personal_calendar
  FOREIGN KEY (calendar_id) REFERENCES user_calendars(id) ON DELETE SET NULL;

ALTER TABLE event_details_personal
  ADD CONSTRAINT fk_event_details_personal_category
  FOREIGN KEY (category_id) REFERENCES user_categories(id) ON DELETE SET NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS for all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_details_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_user_roles ENABLE ROW LEVEL SECURITY;

-- Events RLS policies (basic events visible to participants)
CREATE POLICY "Users can view events they own or are invited to"
  ON events FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM event_user_roles
      WHERE event_id = events.id AND user_id = auth.uid()
    ) OR
    (discovery = 'public') OR
    (discovery = 'tenant_only' AND
     EXISTS (
       SELECT 1 FROM auth.users
       WHERE id = auth.uid()
       -- Add tenant-based filtering logic here when multi-tenancy is implemented
     )
    )
  );

CREATE POLICY "Users can create events they own"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update events they own"
  ON events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete events they own"
  ON events FOR DELETE
  USING (auth.uid() = user_id);

-- Event details RLS policies (detailed info visible to participants)
CREATE POLICY "Users can view event details for events they can see"
  ON event_details FOR SELECT
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM events e
      JOIN event_user_roles eur ON e.id = eur.event_id
      WHERE e.id = event_details.id AND eur.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_details.id AND (
        e.discovery = 'public' OR
        (e.discovery = 'tenant_only' AND
         EXISTS (
           SELECT 1 FROM auth.users
           WHERE id = auth.uid()
           -- Add tenant-based filtering logic here when multi-tenancy is implemented
         )
        )
      )
    )
  );

CREATE POLICY "Event owners can CRUD their event details"
  ON event_details FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Event details personal RLS policies (personal configs only visible to owner)
CREATE POLICY "Users can CRUD their own event personal details"
  ON event_details_personal FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User categories RLS policies
CREATE POLICY "Users can CRUD their own categories"
  ON user_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User calendars RLS policies
CREATE POLICY "Users can CRUD their own calendars"
  ON user_calendars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Event user roles RLS policies
CREATE POLICY "Users can view event roles for events they own or are invited to"
  ON event_user_roles FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Event owners can manage roles for their events"
  ON event_user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own RSVP and preferences"
  ON event_user_roles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to join events based on join_model
CREATE POLICY "Users can join events based on join model"
  ON event_user_roles FOR INSERT
  WITH CHECK (
    -- Event owner can add anyone
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_user_roles.event_id AND events.user_id = auth.uid()
    ) OR
    -- Users can join open events themselves
    (auth.uid() = user_id AND
     EXISTS (
       SELECT 1 FROM events
       WHERE events.id = event_user_roles.event_id AND events.join_model = 'open_join'
     )
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_details_updated_at
  BEFORE UPDATE ON event_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_details_personal_updated_at
  BEFORE UPDATE ON event_details_personal
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

CREATE TRIGGER update_event_user_roles_updated_at
  BEFORE UPDATE ON event_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create default calendar for a user
CREATE OR REPLACE FUNCTION create_default_calendar(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
  calendar_id UUID;
BEGIN
  INSERT INTO user_calendars (user_id, name, color, is_default, visible)
  VALUES (user_id_param, 'My Calendar', 'blue', true, true)
  RETURNING id INTO calendar_id;

  RETURN calendar_id;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create event details and personal details for event owner
CREATE OR REPLACE FUNCTION create_event_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  owner_calendar_id UUID;
BEGIN
  -- Create event_details for the event
  INSERT INTO event_details (id, owner_id, title)
  VALUES (NEW.id, NEW.user_id, 'New Event')
  ON CONFLICT (id) DO NOTHING;

  -- Get or create default calendar for owner
  SELECT id INTO owner_calendar_id
  FROM user_calendars
  WHERE user_id = NEW.user_id AND is_default = true
  LIMIT 1;

  IF owner_calendar_id IS NULL THEN
    owner_calendar_id := create_default_calendar(NEW.user_id);
  END IF;

  -- Create event_details_personal for the event owner
  INSERT INTO event_details_personal (id, user_id, calendar_id, show_time_as, time_defense_level)
  VALUES (NEW.id, NEW.user_id, owner_calendar_id, 'busy', 'normal')
  ON CONFLICT (id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create dependencies when event is created
CREATE TRIGGER create_event_dependencies_trigger
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_event_dependencies();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Events indexes
CREATE INDEX events_user_id_idx ON events(user_id);
CREATE INDEX events_start_time_idx ON events(start_time);
CREATE INDEX events_end_time_idx ON events(end_time);
CREATE INDEX events_all_day_idx ON events(all_day);
CREATE INDEX events_is_private_idx ON events(is_private);
CREATE INDEX events_discovery_idx ON events(discovery);
CREATE INDEX events_join_model_idx ON events(join_model);
CREATE INDEX events_allow_reschedule_proposals_idx ON events(allow_reschedule_proposals);

-- Event details indexes
CREATE INDEX event_details_owner_id_idx ON event_details(owner_id);
CREATE INDEX event_details_request_responses_idx ON event_details(request_responses);

-- Event details personal indexes
CREATE INDEX event_details_personal_user_id_idx ON event_details_personal(user_id);
CREATE INDEX event_details_personal_calendar_id_idx ON event_details_personal(calendar_id);
CREATE INDEX event_details_personal_category_id_idx ON event_details_personal(category_id);
CREATE INDEX event_details_personal_show_time_as_idx ON event_details_personal(show_time_as);
CREATE INDEX event_details_personal_ai_managed_idx ON event_details_personal(ai_managed);

-- User categories indexes
CREATE INDEX user_categories_user_id_idx ON user_categories(user_id);
CREATE INDEX user_categories_color_idx ON user_categories(color);
CREATE INDEX user_categories_is_default_idx ON user_categories(is_default);

-- User calendars indexes
CREATE INDEX user_calendars_user_id_idx ON user_calendars(user_id);
CREATE INDEX user_calendars_color_idx ON user_calendars(color);
CREATE INDEX user_calendars_is_default_idx ON user_calendars(is_default);
CREATE INDEX user_calendars_visible_idx ON user_calendars(visible);

-- Event user roles indexes
CREATE INDEX event_user_roles_event_id_idx ON event_user_roles(event_id);
CREATE INDEX event_user_roles_user_id_idx ON event_user_roles(user_id);
CREATE INDEX event_user_roles_invite_type_idx ON event_user_roles(invite_type);
CREATE INDEX event_user_roles_rsvp_idx ON event_user_roles(rsvp);
CREATE INDEX event_user_roles_role_idx ON event_user_roles(role);
CREATE INDEX event_user_roles_following_idx ON event_user_roles(following);