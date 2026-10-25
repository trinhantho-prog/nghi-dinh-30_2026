-- THIET LAP KHO VAN BAN - chay toan bo file trong Supabase SQL Editor.
-- Danh cho du an CHUA CO cac bang cua ung dung.
-- Kiem tra ngay 25/10/2026: ca 7 bang deu tra ve PGRST205.
-- Khong xoa du lieu. Moi lenh nam trong cung mot transaction.
-- Neu bang da ton tai, dung lai thay vi ghi de schema dang hoat dong.
BEGIN;

DO $install_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('tenants', 'tenant_members', 'documents', 'doc_versions', 'tenant_config', 'invite_links', 'ai_usage')
  ) THEN
    RAISE EXCEPTION 'Da co bang cua ung dung. Khong chay lai installer. Neu kho da duoc tao, chi chay migrations/20261025_document_workspace.sql.';
  END IF;
END;
$install_guard$;

-- =============================================
-- SCHEMA: Thể thức văn bản – Multi-tenant
-- Chạy trong Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLES
-- =============================================

CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_members (
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Văn bản chưa đặt tên',
  doc_type    TEXT NOT NULL DEFAULT 'cong-van',
  content     JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doc_versions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  snapshot    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_config (
  tenant_id   UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  agencies    JSONB NOT NULL DEFAULT '[]',
  signers     JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invite_links (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code        TEXT UNIQUE NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AI RATE LIMITING
-- =============================================

CREATE TABLE ai_usage (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date  DATE DEFAULT CURRENT_DATE,
  count       INT DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenant_config_updated_at
  BEFORE UPDATE ON tenant_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage        ENABLE ROW LEVEL SECURITY;

-- Helper: lấy tenant_id của user hiện tại
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: kiểm tra user có phải admin không
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies: tenants
CREATE POLICY "members can view own tenant" ON tenants
  FOR SELECT USING (id = get_user_tenant_id());

-- Policies: tenant_members
CREATE POLICY "members can view own tenant members" ON tenant_members
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "admin can manage members" ON tenant_members
  FOR ALL USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Policies: documents
CREATE POLICY "tenant members can CRUD documents" ON documents
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- Policies: doc_versions
CREATE POLICY "tenant members can CRUD versions" ON doc_versions
  FOR ALL USING (
    document_id IN (SELECT id FROM documents WHERE tenant_id = get_user_tenant_id())
  );

-- Policies: tenant_config
CREATE POLICY "members can view config" ON tenant_config
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "admin can update config" ON tenant_config
  FOR ALL USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Policies: invite_links
CREATE POLICY "admin can manage invites" ON invite_links
  FOR ALL USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());
CREATE POLICY "anyone can read valid invite" ON invite_links
  FOR SELECT USING (expires_at > NOW() AND used = FALSE);

-- Policies: ai_usage
CREATE POLICY "users manage own usage" ON ai_usage
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- DEFAULT TENANT CONFIG (trigger on new tenant)
-- =============================================

CREATE OR REPLACE FUNCTION create_default_tenant_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_config (tenant_id, agencies, signers)
  VALUES (
    NEW.id,
    '[{"upper":"BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP","main":"BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH","location":"Cao Lãnh"}]'::jsonb,
    '[{"position":"GIÁM ĐỐC","name":""},{"position":"PHÓ GIÁM ĐỐC","name":""}]'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_tenant_created
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION create_default_tenant_config();

-- =============================================
-- GOOGLE / AUTH USER ONBOARDING TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
  user_name TEXT;
BEGIN
  -- Lấy tên hiển thị từ Google Metadata hoặc dùng Email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- 1. Tạo Tenant cá nhân cho user
  INSERT INTO public.tenants (name, slug)
  VALUES (
    'Đơn vị của ' || user_name,
    'workspace-' || LOWER(REPLACE(NEW.id::text, '-', ''))
  )
  RETURNING id INTO new_tenant_id;

  -- 2. Gán user làm Admin của Tenant này
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_onboarding();


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


-- Co dinh schema cho cac ham SECURITY DEFINER cua schema goc.
ALTER FUNCTION public.get_user_tenant_id() SET search_path = public;
ALTER FUNCTION public.is_tenant_admin() SET search_path = public;
ALTER FUNCTION public.handle_new_user_onboarding() SET search_path = public;

COMMIT;

-- Xac nhan da tao du bang va ham cap kho tai khoan.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tenants', 'tenant_members', 'documents', 'doc_versions', 'tenant_config', 'invite_links', 'ai_usage')
ORDER BY table_name;
SELECT to_regprocedure('public.ensure_personal_document_workspace()') AS workspace_function;
