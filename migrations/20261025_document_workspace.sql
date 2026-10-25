-- Run once in Supabase SQL Editor for existing projects.
-- Provision a workspace for signed-in accounts created before the auth trigger.
-- An advisory transaction lock prevents duplicate workspaces on concurrent saves.
CREATE OR REPLACE FUNCTION public.ensure_personal_document_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_id uuid := auth.uid();
  workspace_id uuid;
BEGIN
  IF account_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  SELECT tenant_id INTO workspace_id FROM public.tenant_members
    WHERE user_id = account_id ORDER BY created_at LIMIT 1;
  IF workspace_id IS NOT NULL THEN
    RETURN workspace_id;
  END IF;
  INSERT INTO public.tenants (name, slug)
    VALUES ('Kho văn bản cá nhân', 'workspace-' || replace(account_id::text, '-', ''))
    ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
    RETURNING id INTO workspace_id;
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (workspace_id, account_id, 'admin');
  RETURN workspace_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_personal_document_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_personal_document_workspace() TO authenticated;
