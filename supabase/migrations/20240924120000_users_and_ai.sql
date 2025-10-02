-- ============================================================================
-- BASELINE MIGRATION: Users and AI
-- Purpose: Core user management and AI persona system
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_graphql;

-- ============================================================================
-- USER PROFILES
-- ============================================================================

-- Create time format enum
CREATE TYPE time_format AS ENUM ('12_hour', '24_hour');

-- Create weekday enum (0=Sunday, 1=Monday, etc.)
CREATE TYPE weekday AS ENUM ('0', '1', '2', '3', '4', '5', '6');

-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  slug TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  title TEXT,
  organization TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC', -- IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
  time_format time_format DEFAULT '12_hour',
  week_start_day weekday DEFAULT '0', -- 0=Sunday, 1=Monday, etc. Default to Sunday
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user_profiles user_id field for query performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- User profiles RLS policies
CREATE POLICY "Anyone can view profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- AI PERSONAS
-- ============================================================================

CREATE TABLE public.ai_personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    traits TEXT, -- Behavioral descriptions and personality traits
    instructions TEXT, -- System instructions for AI behavior
    agent_id TEXT, -- Mastra agent to use for this persona
    model_id TEXT, -- AI model to use for this persona
    greeting TEXT, -- Custom greeting message for the persona
    temperature NUMERIC(3,2) DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 2),
    top_p NUMERIC(3,2) CHECK (top_p >= 0 AND top_p <= 1),
    is_default BOOLEAN DEFAULT FALSE,
    properties_ext JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- AI personas indexes
CREATE INDEX idx_ai_personas_user_id ON public.ai_personas(user_id);
CREATE INDEX idx_ai_personas_created_at ON public.ai_personas(created_at DESC);
CREATE INDEX idx_ai_personas_is_default ON public.ai_personas(user_id, is_default) WHERE is_default = TRUE;

-- AI personas triggers
CREATE TRIGGER ai_personas_updated_at
    BEFORE UPDATE ON public.ai_personas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one default persona per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_persona()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this persona as default, unset all other defaults for this user
    IF NEW.is_default = TRUE THEN
        UPDATE public.ai_personas
        SET is_default = FALSE
        WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_persona
    BEFORE INSERT OR UPDATE OF is_default ON public.ai_personas
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION public.ensure_single_default_persona();

-- AI personas RLS
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas"
    ON public.ai_personas
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own personas"
    ON public.ai_personas
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personas"
    ON public.ai_personas
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personas"
    ON public.ai_personas
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create avatars bucket for user and persona avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.user_profiles IS 'Core user profile information';
COMMENT ON TABLE public.ai_personas IS 'Stores AI persona configurations for chat assistant';
COMMENT ON COLUMN public.ai_personas.name IS 'Display name for the AI persona';
COMMENT ON COLUMN public.ai_personas.avatar_url IS 'URL to the persona avatar image';
COMMENT ON COLUMN public.ai_personas.traits IS 'Text description of how the AI persona should behave and its personality';
COMMENT ON COLUMN public.ai_personas.instructions IS 'System instructions that define the AI behavior and role';
COMMENT ON COLUMN public.ai_personas.model_id IS 'AI model identifier to use for this persona (e.g., x-ai/grok-3-mini)';
COMMENT ON COLUMN public.ai_personas.greeting IS 'Custom greeting message shown when starting a conversation';
COMMENT ON COLUMN public.ai_personas.temperature IS 'Temperature setting for AI responses (0-2, default 0.7)';
COMMENT ON COLUMN public.ai_personas.top_p IS 'Top-p (nucleus sampling) parameter for AI responses (0-1)';
COMMENT ON COLUMN public.ai_personas.is_default IS 'Whether this is the default persona for the user';
COMMENT ON COLUMN public.ai_personas.properties_ext IS 'Additional extensible properties stored as JSON';

-- ============================================================================
-- USER WORK SCHEDULES
-- ============================================================================

-- Create user work periods table for queryable work hours
CREATE TABLE user_work_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday integer NOT NULL, -- 0=Sunday, 1=Monday, etc.
  start_time time NOT NULL, -- 09:00 (in user's timezone)
  end_time time NOT NULL,   -- 17:00 (in user's timezone)

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_weekday CHECK (weekday >= 0 AND weekday <= 6),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Add updated_at trigger
CREATE TRIGGER update_user_work_periods_updated_at
  BEFORE UPDATE ON user_work_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_user_work_periods_user_id ON user_work_periods(user_id);
CREATE INDEX idx_user_work_periods_weekday ON user_work_periods(weekday);
CREATE INDEX idx_user_work_periods_user_weekday ON user_work_periods(user_id, weekday);

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
  wp.updated_at
FROM user_work_periods wp
JOIN user_profiles up ON wp.user_id = up.id
ORDER BY wp.user_id, wp.weekday, wp.start_time;

-- Comment for the view
COMMENT ON VIEW user_work_hours_view IS 'User work hours for cross-timezone availability querying';

-- ============================================================================
-- AI MEMORY TABLES (LangGraph/LangChain Integration)
-- ============================================================================

-- AI Threads Table
-- Stores conversation threads with persona associations
CREATE TABLE IF NOT EXISTS ai_threads (
  thread_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id  UUID REFERENCES ai_personas(id) ON DELETE CASCADE,
  title       TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for ai_threads
CREATE INDEX idx_ai_threads_user_id ON ai_threads(user_id);
CREATE INDEX idx_ai_threads_persona_id ON ai_threads(persona_id);
CREATE INDEX idx_ai_threads_created_at ON ai_threads(created_at DESC);
CREATE INDEX idx_ai_threads_user_persona ON ai_threads(user_id, persona_id);

-- Add RLS policies for ai_threads
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own threads"
  ON ai_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own threads"
  ON ai_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads"
  ON ai_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threads"
  ON ai_threads FOR DELETE
  USING (auth.uid() = user_id);

-- Add timestamp trigger for ai_threads
CREATE TRIGGER update_ai_threads_updated_at
  BEFORE UPDATE ON ai_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- AI Messages Table
-- Stores individual messages within conversation threads
CREATE TABLE IF NOT EXISTS ai_messages (
  message_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES ai_threads(thread_id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content     JSONB NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for ai_messages
CREATE INDEX idx_ai_messages_thread_id ON ai_messages(thread_id);
CREATE INDEX idx_ai_messages_user_id ON ai_messages(user_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at);
CREATE INDEX idx_ai_messages_thread_created ON ai_messages(thread_id, created_at);

-- Add RLS policies for ai_messages
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their threads"
  ON ai_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert messages in their threads"
  ON ai_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON ai_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON ai_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Add timestamp trigger for ai_messages
CREATE TRIGGER update_ai_messages_updated_at
  BEFORE UPDATE ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- AI Memory Table
-- Stores persistent memory entries for user-persona combinations
CREATE TABLE IF NOT EXISTS ai_memory (
  memory_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id  UUID NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id)
);

-- Add indexes for ai_memory
CREATE INDEX idx_ai_memory_user_id ON ai_memory(user_id);
CREATE INDEX idx_ai_memory_persona_id ON ai_memory(persona_id);
CREATE INDEX idx_ai_memory_user_persona ON ai_memory(user_id, persona_id);

-- Add RLS policies for ai_memory
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memory"
  ON ai_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory"
  ON ai_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory"
  ON ai_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory"
  ON ai_memory FOR DELETE
  USING (auth.uid() = user_id);

-- Add timestamp trigger for ai_memory
CREATE TRIGGER update_ai_memory_updated_at
  BEFORE UPDATE ON ai_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for AI memory tables
COMMENT ON TABLE ai_threads IS 'Conversation threads for AI personas with LangGraph/LangChain integration';
COMMENT ON TABLE ai_messages IS 'Individual messages within AI conversation threads';
COMMENT ON TABLE ai_memory IS 'Persistent memory storage for user-persona combinations (multiple entries allowed)';

COMMENT ON COLUMN ai_threads.metadata IS 'Additional thread metadata (tags, settings, etc.)';
COMMENT ON COLUMN ai_messages.content IS 'Message content in LangChain format (text, tool calls, etc.)';
COMMENT ON COLUMN ai_messages.metadata IS 'Message metadata (token count, model info, etc.)';
COMMENT ON COLUMN ai_memory.content IS 'Persistent memory content (facts, preferences, context)';
COMMENT ON COLUMN ai_memory.metadata IS 'Memory metadata (last accessed, importance score, etc.)';