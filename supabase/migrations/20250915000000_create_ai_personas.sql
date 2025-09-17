-- ============================================================================
-- Migration: AI Personas
-- Purpose: Add AI persona management for chat assistant
-- ============================================================================

-- ============================================================================
-- AI PERSONAS TABLE
-- ============================================================================

CREATE TABLE public.ai_personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    persona_name TEXT NOT NULL,
    avatar_url TEXT,
    traits TEXT, -- Behavioral descriptions and personality traits
    instructions TEXT, -- System instructions for AI behavior
    greeting TEXT, -- Custom greeting message for the persona
    temperature NUMERIC(3,2) DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 2),
    is_default BOOLEAN DEFAULT FALSE,
    properties_ext JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_ai_personas_user_id ON public.ai_personas(user_id);
CREATE INDEX idx_ai_personas_created_at ON public.ai_personas(created_at DESC);
CREATE INDEX idx_ai_personas_is_default ON public.ai_personas(user_id, is_default) WHERE is_default = TRUE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

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

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own personas
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
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.ai_personas IS 'Stores AI persona configurations for chat assistant';
COMMENT ON COLUMN public.ai_personas.persona_name IS 'Display name for the AI persona';
COMMENT ON COLUMN public.ai_personas.avatar_url IS 'URL to the persona avatar image';
COMMENT ON COLUMN public.ai_personas.traits IS 'Text description of how the AI persona should behave and its personality';
COMMENT ON COLUMN public.ai_personas.instructions IS 'System instructions that define the AI behavior and role';
COMMENT ON COLUMN public.ai_personas.greeting IS 'Custom greeting message shown when starting a conversation';
COMMENT ON COLUMN public.ai_personas.temperature IS 'Temperature setting for AI responses (0-2, default 0.7)';
COMMENT ON COLUMN public.ai_personas.is_default IS 'Whether this is the default persona for the user';
COMMENT ON COLUMN public.ai_personas.properties_ext IS 'Additional extensible properties stored as JSON';