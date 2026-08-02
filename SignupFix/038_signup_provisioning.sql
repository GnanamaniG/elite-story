-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Fix: signing up never actually creates a business
--
-- Root cause: supabase.auth.signUp() only creates an auth user.
-- Nothing ever inserted a row into tenants or users, so every new
-- signup reached the app with no business attached — permanently.
--
-- This adds the RLS policies needed for the app to self-provision
-- a tenant + users row at first login. These are ADDITIVE (Postgres
-- OR's multiple permissive policies together) — they do not remove
-- or replace your existing tenant-scoped policies, they only add
-- one more way to pass, specifically for a user with no tenant yet.
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- Let a newly authenticated user create exactly one tenant for themself
DROP POLICY IF EXISTS "tenants_self_signup_insert" ON tenants;
CREATE POLICY "tenants_self_signup_insert" ON tenants
  FOR INSERT
  WITH CHECK (owner_email = auth.jwt()->>'email');

-- Let them read a tenant they own, or one they're linked to via users —
-- needed because .insert().select() requires read access on the new row
DROP POLICY IF EXISTS "tenants_self_select" ON tenants;
CREATE POLICY "tenants_self_select" ON tenants
  FOR SELECT
  USING (
    owner_email = auth.jwt()->>'email'
    OR id IN (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
  );

-- Let a user create their own users row (new business owner path)
DROP POLICY IF EXISTS "users_self_insert" ON users;
CREATE POLICY "users_self_insert" ON users
  FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- Let an invited staff member (users row created by their manager via
-- Team → Invite, with auth_id still NULL) link themselves on signup
DROP POLICY IF EXISTS "users_self_link" ON users;
CREATE POLICY "users_self_link" ON users
  FOR UPDATE
  USING (email = auth.jwt()->>'email' AND auth_id IS NULL)
  WITH CHECK (auth_id = auth.uid());

-- Let a user read their own users row, and read a pending invite
-- waiting for their email before they've linked it
DROP POLICY IF EXISTS "users_self_select" ON users;
CREATE POLICY "users_self_select" ON users
  FOR SELECT
  USING (
    auth_id = auth.uid()
    OR (email = auth.jwt()->>'email' AND auth_id IS NULL)
  );

SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('tenants','users') AND policyname LIKE '%self%'
ORDER BY tablename, policyname;
