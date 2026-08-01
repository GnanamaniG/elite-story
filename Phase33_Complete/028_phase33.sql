-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 33 — Roles + Onboarding
-- Creates staff_users if it was never created, then adds columns.
-- Additive only, no drops. Safe to run any number of times.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Create staff_users if it does not exist ────────────────
CREATE TABLE IF NOT EXISTS staff_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT DEFAULT 'staff',
  permissions JSONB DEFAULT '{}',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Add any columns that may be missing ────────────────────
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS phone       TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT TRUE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS role        TEXT DEFAULT 'staff';

-- ── 3. Widen the role constraint to the five app roles ────────
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check;
ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('owner','manager','accountant','cashier','staff'));

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff_users(tenant_id, email);

-- ── 4. Row level security ─────────────────────────────────────
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_all" ON staff_users;
CREATE POLICY "staff_all" ON staff_users FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 5. Tenant fields used by the onboarding wizard ────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarded      BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type  TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS categories     JSONB DEFAULT '[]';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email    TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address        TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state          TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pincode        TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pan            TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_name      TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gstin          TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS upi_id         TEXT;

-- ── 6. Existing shops skip the wizard ─────────────────────────
UPDATE tenants SET onboarded = TRUE WHERE onboarded IS NOT TRUE;

-- ── 7. Verify ─────────────────────────────────────────────────
SELECT 'staff_users' AS tbl, COUNT(*) AS columns
FROM information_schema.columns WHERE table_name = 'staff_users'
UNION ALL
SELECT 'tenants (onboarded=true)', COUNT(*) FROM tenants WHERE onboarded;
