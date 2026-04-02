-- ─── Custom Claims for RBAC ────────────────────────────────
-- Sets app_role in the JWT so middleware and RLS can read it.
--
-- After running this migration, bootstrap the first admin:
--   SELECT set_claim('<owner-auth-uuid>', 'app_role', '"dueno"');
--   SELECT set_claim('<owner-auth-uuid>', 'claims_admin', 'true');

-- Function to get a specific claim for the current user
CREATE OR REPLACE FUNCTION public.get_my_claim(claim TEXT)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(raw_app_meta_data->claim, null)
  FROM auth.users
  WHERE id = auth.uid()
$$;

-- Function to get all claims for the current user
CREATE OR REPLACE FUNCTION public.get_my_claims()
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT raw_app_meta_data
  FROM auth.users
  WHERE id = auth.uid()
$$;

-- Function to get claims for any user (admin only)
CREATE OR REPLACE FUNCTION public.get_claims(uid UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  claims JSONB;
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT raw_app_meta_data INTO claims
  FROM auth.users WHERE id = uid;

  RETURN claims;
END;
$$;

-- Function to check if current user is claims admin
CREATE OR REPLACE FUNCTION public.is_claims_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data->>'claims_admin'
     FROM auth.users
     WHERE id = auth.uid())::boolean,
    false
  )
$$;

-- Function to set a claim on any user (admin only)
CREATE OR REPLACE FUNCTION public.set_claim(uid UUID, claim TEXT, value JSONB)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || json_build_object(claim, value)::jsonb
  WHERE id = uid;

  RETURN 'OK';
END;
$$;

-- Function to delete a claim from any user (admin only)
CREATE OR REPLACE FUNCTION public.delete_claim(uid UUID, claim TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data - claim
  WHERE id = uid;

  RETURN 'OK';
END;
$$;

-- ─── RLS Policies ──────────────────────────────────────

-- Audit log: append-only
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "audit_log_insert_all"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "audit_log_select_dueno"
  ON audit_logs FOR SELECT
  USING (
    (SELECT raw_app_meta_data->>'app_role' FROM auth.users WHERE id = auth.uid()) = 'dueno'
  );

CREATE POLICY IF NOT EXISTS "audit_log_no_update"
  ON audit_logs FOR UPDATE
  USING (false);

CREATE POLICY IF NOT EXISTS "audit_log_no_delete"
  ON audit_logs FOR DELETE
  USING (false);
