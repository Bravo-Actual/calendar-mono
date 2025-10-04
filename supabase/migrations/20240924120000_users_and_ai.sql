-- ============================================================================
-- BASELINE MIGRATION: Users and AI (Mastra-compatible)
-- Purpose: Core user mgmt + personas + threads/messages/memory + metadata
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- USER PROFILES
-- ============================================================================

-- Enums
CREATE TYPE time_format AS ENUM ('12_hour', '24_hour');
CREATE TYPE weekday     AS ENUM ('0', '1', '2', '3', '4', '5', '6');

-- Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
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
  timezone TEXT DEFAULT 'UTC',
  time_format time_format DEFAULT '12_hour',
  week_start_day weekday DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Common updated_at trigger fn
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles"       ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"   ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"   ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- AI PERSONAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  traits TEXT,
  instructions TEXT,
  agent_id TEXT,
  model_id TEXT,
  greeting TEXT,
  temperature NUMERIC(3,2) DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 2),
  top_p NUMERIC(3,2) CHECK (top_p >= 0 AND top_p <= 1),
  is_default BOOLEAN DEFAULT FALSE,
  properties_ext JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_personas_user_id     ON public.ai_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_personas_created_at  ON public.ai_personas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_personas_is_default  ON public.ai_personas(user_id, is_default) WHERE is_default = TRUE;

CREATE TRIGGER ai_personas_updated_at
  BEFORE UPDATE ON public.ai_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_single_default_persona()
RETURNS TRIGGER AS $$
BEGIN
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
  FOR EACH ROW WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.ensure_single_default_persona();

-- Function to create default AI persona for new users
CREATE OR REPLACE FUNCTION public.create_default_persona(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
  persona_id UUID;
BEGIN
  INSERT INTO public.ai_personas (
    user_id,
    name,
    avatar_url,
    traits,
    instructions,
    greeting,
    agent_id,
    model_id,
    temperature,
    top_p,
    is_default
  ) VALUES (
    user_id_param,
    'Calendar Assistant',
    NULL,
    'Helpful, professional, and organized. Focuses on productivity and time management.',
    'You are a helpful calendar and productivity assistant. Help users manage their time, schedule events, and stay organized. Be concise and actionable in your responses.',
    'Hi! I''m your Calendar Assistant. I can help you manage your schedule, create events, and stay organized. What would you like to do?',
    'dynamicPersonaAgent',
    NULL, -- Use system default model
    0.70,
    NULL,
    true -- This is the default persona
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO persona_id;

  RETURN persona_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent deletion of the last persona
CREATE OR REPLACE FUNCTION public.prevent_last_persona_deletion()
RETURNS TRIGGER AS $$
DECLARE
  persona_count INTEGER;
BEGIN
  -- Count remaining personas for this user (excluding the one being deleted)
  SELECT COUNT(*) INTO persona_count
  FROM public.ai_personas
  WHERE user_id = OLD.user_id AND id != OLD.id;

  -- If this is the last persona, prevent deletion
  IF persona_count = 0 THEN
    RAISE EXCEPTION 'Cannot delete your last AI persona. You must have at least one persona.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent deletion of last persona
CREATE TRIGGER prevent_last_persona_deletion
  BEFORE DELETE ON public.ai_personas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_persona_deletion();

-- Function to ensure there's always one default persona per user
-- If a default persona is deleted, automatically promote another one
CREATE OR REPLACE FUNCTION public.ensure_default_persona_exists()
RETURNS TRIGGER AS $$
DECLARE
  default_count INTEGER;
  first_persona_id UUID;
BEGIN
  -- If we're setting a persona as default, the ensure_single_default_persona trigger handles it
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_default = TRUE) THEN
    RETURN NEW;
  END IF;

  -- If we're trying to unset the only default persona, prevent it
  IF TG_OP = 'UPDATE' AND OLD.is_default = TRUE AND NEW.is_default = FALSE THEN
    SELECT COUNT(*) INTO default_count
    FROM public.ai_personas
    WHERE user_id = NEW.user_id AND is_default = TRUE AND id != NEW.id;

    -- If no other defaults exist, prevent unsetting this one
    IF default_count = 0 THEN
      RAISE EXCEPTION 'Cannot unset your last default persona. You must have exactly one default persona.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  -- If a persona is deleted and it was the default, promote another one
  IF TG_OP = 'DELETE' AND OLD.is_default = TRUE THEN
    -- Find the first remaining persona for this user (oldest first)
    SELECT id INTO first_persona_id
    FROM public.ai_personas
    WHERE user_id = OLD.user_id AND id != OLD.id
    ORDER BY created_at ASC
    LIMIT 1;

    -- Make it the default
    IF first_persona_id IS NOT NULL THEN
      UPDATE public.ai_personas
      SET is_default = TRUE
      WHERE id = first_persona_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure default persona exists
CREATE TRIGGER ensure_default_persona_exists
  BEFORE UPDATE OF is_default OR DELETE ON public.ai_personas
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_persona_exists();

ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own personas"    ON public.ai_personas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own personas"  ON public.ai_personas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personas"  ON public.ai_personas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own personas"  ON public.ai_personas FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- STORAGE (avatars bucket + policies)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars','avatars',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

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

CREATE TABLE IF NOT EXISTS user_work_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE TRIGGER update_user_work_periods_updated_at
  BEFORE UPDATE ON user_work_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_work_periods_user_id       ON user_work_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_work_periods_weekday       ON user_work_periods(weekday);
CREATE INDEX IF NOT EXISTS idx_user_work_periods_user_weekday  ON user_work_periods(user_id, weekday);

ALTER TABLE user_work_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own work periods" ON user_work_periods FOR ALL   USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view work periods"            ON user_work_periods FOR SELECT USING (true);

CREATE OR REPLACE VIEW user_work_hours_view AS
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

COMMENT ON VIEW user_work_hours_view IS 'User work hours for cross-timezone availability querying';

-- ============================================================================
-- AI MEMORY TABLES (Mastra-compatible)
-- ============================================================================

-- Threads (owner = user_id; persona optional, IMMUTABLE once set)
CREATE TABLE IF NOT EXISTS ai_threads (
  thread_id   TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id  UUID REFERENCES ai_personas(id) ON DELETE CASCADE,
  -- resource for (user_id + persona_id), use sentinel when persona_id is NULL
  resource_key TEXT GENERATED ALWAYS AS (
    user_id::text || ':' || COALESCE(persona_id::text, '00000000-0000-0000-0000-000000000000')
  ) STORED,
  title       TEXT,
  metadata    TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at_z  TIMESTAMPTZ DEFAULT NOW(),
  updated_at_z  TIMESTAMPTZ DEFAULT NOW(),
  -- allow messages to FK (thread_id,user_id)
  CONSTRAINT ai_threads_thread_user_unique UNIQUE (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_threads_user_id        ON ai_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_persona_id     ON ai_threads(persona_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_created_at     ON ai_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_threads_user_persona   ON ai_threads(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_resource_key   ON ai_threads(resource_key);

ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own threads"   ON ai_threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own threads" ON ai_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own threads" ON ai_threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own threads" ON ai_threads FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_threads_updated_at
  BEFORE UPDATE ON ai_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Persona immutability: prevent changing persona_id after creation
CREATE OR REPLACE FUNCTION ai_threads_lock_persona()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.persona_id IS DISTINCT FROM OLD.persona_id THEN
    RAISE EXCEPTION 'ai_threads.persona_id is immutable and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_threads_lock_persona_tr ON ai_threads;
CREATE TRIGGER ai_threads_lock_persona_tr
  BEFORE UPDATE OF persona_id ON ai_threads
  FOR EACH ROW EXECUTE FUNCTION ai_threads_lock_persona();

-- Messages (owner = user_id; belong to thread; resource denormalized)
CREATE TABLE IF NOT EXISTS ai_messages (
  message_id  TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES ai_threads(thread_id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- owner = thread owner, set by trigger
  -- denormalized for resource-scope queries (kept in sync by trigger)
  persona_id   UUID,
  resource_key TEXT,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content     TEXT NOT NULL,   -- Mastra uses text (JSON stringified)
  type        TEXT NOT NULL,
  -- semantic recall
  message_embedding vector(1536),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at_z  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_messages_thread_owner_fk
    FOREIGN KEY (thread_id, user_id)
    REFERENCES ai_threads(thread_id, user_id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_thread_id       ON ai_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id         ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at      ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_thread_created  ON ai_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_persona_id      ON ai_messages(persona_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_resource_key    ON ai_messages(resource_key);
CREATE INDEX IF NOT EXISTS idx_ai_messages_embedding
  ON ai_messages USING ivfflat (message_embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in their threads"   ON ai_messages FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert messages in their threads" ON ai_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM ai_threads WHERE thread_id = ai_messages.thread_id AND user_id = auth.uid()));
CREATE POLICY "Users can update their own messages"        ON ai_messages FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages"        ON ai_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_messages_updated_at
  BEFORE UPDATE ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure owner and resource metadata stay consistent with thread
CREATE OR REPLACE FUNCTION ensure_ai_message_owner_and_resource()
RETURNS TRIGGER AS $$
DECLARE
  v_user    UUID;
  v_persona UUID;
BEGIN
  SELECT user_id, persona_id INTO v_user, v_persona
  FROM ai_threads WHERE thread_id = NEW.thread_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Thread % not found for ai_messages', NEW.thread_id;
  END IF;

  -- lock owner to thread owner
  IF NEW.user_id IS NULL OR NEW.user_id <> v_user THEN
    NEW.user_id := v_user;
  END IF;

  -- set resource facets
  NEW.persona_id   := v_persona;
  NEW.resource_key := v_user::text || ':' || COALESCE(v_persona::text, '00000000-0000-0000-0000-000000000000');

  -- prevent owner drift without thread change
  IF TG_OP = 'UPDATE' AND NEW.thread_id = OLD.thread_id AND NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'ai_messages.user_id is derived from thread owner and cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_messages_set_owner ON ai_messages;
DROP TRIGGER IF EXISTS ai_messages_sync_owner_and_resource ON ai_messages;
CREATE TRIGGER ai_messages_sync_owner_and_resource
  BEFORE INSERT OR UPDATE OF thread_id, user_id ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION ensure_ai_message_owner_and_resource();

-- Recency parity: touch ai_threads.updated_at on message changes
CREATE OR REPLACE FUNCTION ai_threads_touch_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_threads
     SET updated_at = NOW()
   WHERE thread_id = COALESCE(NEW.thread_id, OLD.thread_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_messages_touch_thread_ins ON ai_messages;
CREATE TRIGGER ai_messages_touch_thread_ins
AFTER INSERT ON ai_messages
FOR EACH ROW EXECUTE FUNCTION ai_threads_touch_on_message();

DROP TRIGGER IF EXISTS ai_messages_touch_thread_upd ON ai_messages;
CREATE TRIGGER ai_messages_touch_thread_upd
AFTER UPDATE ON ai_messages
FOR EACH ROW EXECUTE FUNCTION ai_threads_touch_on_message();

DROP TRIGGER IF EXISTS ai_messages_touch_thread_del ON ai_messages;
CREATE TRIGGER ai_messages_touch_thread_del
AFTER DELETE ON ai_messages
FOR EACH ROW EXECUTE FUNCTION ai_threads_touch_on_message();

-- Durable Memory (resource = user_id + persona_id)
CREATE TABLE IF NOT EXISTS ai_memory (
  memory_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id       UUID NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
  resource_key     TEXT GENERATED ALWAYS AS (user_id::text || ':' || persona_id::text) STORED,
  -- core memory
  memory_type      TEXT NOT NULL,                 -- 'preference','constraint','habit','personal_info','goal','fact','working',...
  content          TEXT NOT NULL,
  content_json     JSONB,                         -- optional structured payload
  importance       TEXT DEFAULT 'normal',         -- 'low','normal','high','critical'
  expires_at       TIMESTAMPTZ,                   -- NULL = permanent
  source_thread_id TEXT REFERENCES ai_threads(thread_id) ON DELETE SET NULL,
  -- optional semantic embedding for LTM recall
  content_embedding vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one working memory per resource
CREATE UNIQUE INDEX IF NOT EXISTS u_ai_memory_resource_working
  ON ai_memory(resource_key, memory_type)
  WHERE memory_type = 'working';

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_id         ON ai_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_persona_id      ON ai_memory(persona_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_persona    ON ai_memory(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_expires_at      ON ai_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_memory_type            ON ai_memory(user_id, persona_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance      ON ai_memory(user_id, persona_id, importance);
CREATE INDEX IF NOT EXISTS idx_ai_memory_resource_key    ON ai_memory(resource_key);
CREATE INDEX IF NOT EXISTS idx_ai_memory_embedding
  ON ai_memory USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_ai_memory_content_json_gin ON ai_memory USING gin (content_json);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own memory"   ON ai_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own memory" ON ai_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memory" ON ai_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own memory" ON ai_memory FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_memory_updated_at
  BEFORE UPDATE ON ai_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AI METADATA (separate table; owner-derived; de-dupe per target)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_metadata (
  metadata_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- OWNER (derived)
  -- exactly one target must be set:
  thread_id   TEXT REFERENCES ai_threads(thread_id)   ON DELETE CASCADE,
  message_id  TEXT REFERENCES ai_messages(message_id) ON DELETE CASCADE,
  memory_id   UUID REFERENCES ai_memory(memory_id)    ON DELETE CASCADE,
  persona_ref UUID REFERENCES ai_personas(id)         ON DELETE CASCADE,
  -- resource facets (derived)
  resource_key TEXT,
  persona_id   UUID,
  -- payload
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_metadata_exactly_one_target CHECK (
    ((thread_id   IS NOT NULL)::int +
     (message_id  IS NOT NULL)::int +
     (memory_id   IS NOT NULL)::int +
     (persona_ref IS NOT NULL)::int) = 1
  )
);

-- Prevent duplicate keys for the same target
CREATE UNIQUE INDEX IF NOT EXISTS u_ai_metadata_thread_key
  ON ai_metadata(thread_id, key)  WHERE thread_id  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS u_ai_metadata_message_key
  ON ai_metadata(message_id, key) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS u_ai_metadata_memory_key
  ON ai_metadata(memory_id, key)  WHERE memory_id  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS u_ai_metadata_persona_key
  ON ai_metadata(persona_ref, key) WHERE persona_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_metadata_user_id       ON ai_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_thread_id     ON ai_metadata(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_message_id    ON ai_metadata(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_memory_id     ON ai_metadata(memory_id);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_persona_ref   ON ai_metadata(persona_ref);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_resource_key  ON ai_metadata(resource_key);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_key           ON ai_metadata(key);

ALTER TABLE ai_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own metadata"    ON ai_metadata FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metadata"  ON ai_metadata FOR INSERT
  WITH CHECK (
    (thread_id   IS NOT NULL AND EXISTS (SELECT 1 FROM ai_threads  WHERE thread_id   = ai_metadata.thread_id   AND user_id = auth.uid())) OR
    (message_id  IS NOT NULL AND EXISTS (SELECT 1 FROM ai_messages WHERE message_id  = ai_metadata.message_id  AND user_id = auth.uid())) OR
    (memory_id   IS NOT NULL AND EXISTS (SELECT 1 FROM ai_memory   WHERE memory_id   = ai_metadata.memory_id   AND user_id = auth.uid())) OR
    (persona_ref IS NOT NULL AND EXISTS (SELECT 1 FROM ai_personas WHERE id          = ai_metadata.persona_ref AND user_id = auth.uid()))
  );
CREATE POLICY "Users can update own metadata"  ON ai_metadata FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own metadata"  ON ai_metadata FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_metadata_updated_at
  BEFORE UPDATE ON ai_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Derive owner/resource facets from the referenced target
CREATE OR REPLACE FUNCTION ai_metadata_sync_owner_and_resource()
RETURNS TRIGGER AS $$
DECLARE
  v_user    UUID;
  v_persona UUID;
  v_reskey  TEXT;
BEGIN
  -- derive from whichever target is set
  IF NEW.thread_id IS NOT NULL THEN
    SELECT user_id, persona_id,
           user_id::text || ':' || COALESCE(persona_id::text,'00000000-0000-0000-0000-000000000000')
    INTO v_user, v_persona, v_reskey
    FROM ai_threads WHERE thread_id = NEW.thread_id;

  ELSIF NEW.message_id IS NOT NULL THEN
    SELECT m.user_id, m.persona_id, m.resource_key
    INTO v_user, v_persona, v_reskey
    FROM ai_messages m WHERE m.message_id = NEW.message_id;

  ELSIF NEW.memory_id IS NOT NULL THEN
    SELECT user_id, persona_id, resource_key
    INTO v_user, v_persona, v_reskey
    FROM ai_memory WHERE memory_id = NEW.memory_id;

  ELSIF NEW.persona_ref IS NOT NULL THEN
    SELECT p.user_id, p.id,
           p.user_id::text || ':' || p.id::text
    INTO v_user, v_persona, v_reskey
    FROM ai_personas p WHERE p.id = NEW.persona_ref;

  ELSE
    RAISE EXCEPTION 'ai_metadata: one of (thread_id, message_id, memory_id, persona_ref) must be set';
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'ai_metadata: referenced target not found';
  END IF;

  NEW.user_id      := v_user;
  NEW.persona_id   := v_persona;
  NEW.resource_key := v_reskey;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_metadata_sync_tr ON ai_metadata;
CREATE TRIGGER ai_metadata_sync_tr
  BEFORE INSERT OR UPDATE OF thread_id, message_id, memory_id, persona_ref ON ai_metadata
  FOR EACH ROW EXECUTE FUNCTION ai_metadata_sync_owner_and_resource();

-- ============================================================================
-- OPTIONAL: RPC helper for vector recall across thread/resource
-- ============================================================================

CREATE OR REPLACE FUNCTION ai_search_messages_vector(
  p_query        vector(1536),
  p_thread_id    text DEFAULT NULL,
  p_resource_key text DEFAULT NULL,
  p_top_k        int  DEFAULT 10
)
RETURNS TABLE (
  message_id text,
  thread_id  text,
  role       text,
  content    text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.message_id, m.thread_id, m.role, m.content, m.created_at,
    1 - (m.message_embedding <=> p_query) AS similarity
  FROM ai_messages m
  WHERE m.message_embedding IS NOT NULL
    AND ( (p_thread_id    IS NOT NULL AND m.thread_id   = p_thread_id)
       OR (p_resource_key IS NOT NULL AND m.resource_key = p_resource_key) )
  ORDER BY m.message_embedding <=> p_query
  LIMIT LEAST(GREATEST(p_top_k, 1), 100)
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_profiles IS 'Core user profile information';
COMMENT ON TABLE public.ai_personas  IS 'Stores AI persona configurations for chat assistant';
COMMENT ON COLUMN public.ai_personas.model_id IS 'AI model to use for this persona';
COMMENT ON COLUMN public.ai_personas.greeting IS 'Greeting when starting a conversation';
COMMENT ON COLUMN public.ai_personas.properties_ext IS 'Extensible persona properties (JSONB)';

COMMENT ON TABLE ai_threads  IS 'Conversation threads (owner = user_id), optional persona (immutable), Mastra resource via resource_key';
COMMENT ON COLUMN ai_threads.resource_key IS 'Deterministic resource id = user_id:persona_id (NULL persona uses sentinel UUID)';

COMMENT ON TABLE ai_messages IS 'Messages belonging to threads (owner locked to thread owner); persona/resource denormalized for fast queries';
COMMENT ON COLUMN ai_messages.message_embedding IS 'Optional pgvector embedding for semantic recall';
COMMENT ON COLUMN ai_messages.resource_key      IS 'Denormalized resource id = user_id:persona_id';

COMMENT ON TABLE ai_memory   IS 'Durable memories/resources scoped by (user_id, persona_id)';
COMMENT ON COLUMN ai_memory.content_json        IS 'Optional structured payload for working/tool memories';
COMMENT ON COLUMN ai_memory.content_embedding   IS 'Optional pgvector embedding for LTM semantic recall';

COMMENT ON TABLE ai_metadata IS 'Key/value metadata linked to exactly one target (thread|message|memory|persona); owner and resource derived';
COMMENT ON COLUMN ai_metadata.resource_key      IS 'Resource of the target row for resource-wide queries';
