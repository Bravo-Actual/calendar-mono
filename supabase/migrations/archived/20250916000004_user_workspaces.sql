-- Function to get or create a workspace for a user
CREATE OR REPLACE FUNCTION get_or_create_user_workspace()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_workspace_id UUID;
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Try to find existing workspace for this user
  SELECT id INTO user_workspace_id
  FROM public.workspaces
  WHERE name = 'User Workspace: ' || current_user_id::text;

  -- If no workspace exists, create one
  IF user_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name)
    VALUES ('User Workspace: ' || current_user_id::text)
    RETURNING id INTO user_workspace_id;
  END IF;

  RETURN user_workspace_id;
END;
$$;

-- Update RLS policies to be more restrictive
-- Users can only access their own workspace

DROP POLICY IF EXISTS "Enable access to workspaces" ON public.workspaces;
CREATE POLICY "Users can access their own workspace" ON public.workspaces FOR ALL
  USING (name = 'User Workspace: ' || auth.uid()::text OR name = 'Default Workspace');

DROP POLICY IF EXISTS "Enable access to memory threads" ON public.ai_memory_threads;
CREATE POLICY "Users can access threads in their workspace" ON public.ai_memory_threads FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE name = 'User Workspace: ' || auth.uid()::text OR name = 'Default Workspace'
    )
  );

DROP POLICY IF EXISTS "Enable access to memory messages" ON public.ai_memory_messages;
CREATE POLICY "Users can access messages in their threads" ON public.ai_memory_messages FOR ALL
  USING (
    thread_id IN (
      SELECT t.id FROM public.ai_memory_threads t
      JOIN public.workspaces w ON t.workspace_id = w.id
      WHERE w.name = 'User Workspace: ' || auth.uid()::text OR w.name = 'Default Workspace'
    )
  );

DROP POLICY IF EXISTS "Enable access to working memory" ON public.ai_working_memory;
CREATE POLICY "Users can access working memory in their workspace" ON public.ai_working_memory FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE name = 'User Workspace: ' || auth.uid()::text OR name = 'Default Workspace'
    )
  );

DROP POLICY IF EXISTS "Enable access to directives" ON public.ai_directives;
CREATE POLICY "Users can access directives in their workspace" ON public.ai_directives FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE name = 'User Workspace: ' || auth.uid()::text OR name = 'Default Workspace'
    )
    AND (user_id = auth.uid() OR user_id IS NULL)
  );