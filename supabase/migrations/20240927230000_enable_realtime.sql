-- Enable realtime for all tables used in the application

-- Core event system tables
ALTER publication supabase_realtime ADD TABLE events;
ALTER publication supabase_realtime ADD TABLE event_details_personal;
ALTER publication supabase_realtime ADD TABLE event_users;
ALTER publication supabase_realtime ADD TABLE event_rsvps;

-- User configuration tables
ALTER publication supabase_realtime ADD TABLE user_profiles;
ALTER publication supabase_realtime ADD TABLE user_calendars;
ALTER publication supabase_realtime ADD TABLE user_categories;
ALTER publication supabase_realtime ADD TABLE user_work_periods;

-- AI system tables
ALTER publication supabase_realtime ADD TABLE ai_personas;
ALTER publication supabase_realtime ADD TABLE ai_threads;
ALTER publication supabase_realtime ADD TABLE user_annotations;