-- Migration to add triggers for automatically creating owner records when events are created

-- Function to automatically create event_users and event_rsvps for event owner
CREATE OR REPLACE FUNCTION create_event_owner_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Create event_users record for the owner (required)
  INSERT INTO event_users (event_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Create event_rsvps record for the owner (accepted, not following by default)
  INSERT INTO event_rsvps (event_id, user_id, rsvp_status, attendance_type, following)
  VALUES (NEW.id, NEW.owner_id, 'accepted', 'unknown', false)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create owner records when events are created
CREATE TRIGGER create_event_owner_records_trigger
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_event_owner_records();