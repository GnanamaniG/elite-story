-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 7 — HR, Payroll & Loyalty
-- Run in Supabase SQL Editor AFTER 004_branches.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. STAFF ATTENDANCE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  staff_name  TEXT NOT NULL,
  date        DATE DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'present' CHECK (status IN ('present','absent','half_day','leave')),
  check_in    TIME,
  check_out   TIME,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_attendance_tenant ON attendance(tenant_id, date DESC);
CREATE UNIQUE INDEX idx_attendance_unique ON attendance(tenant_id, user_id, date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_all" ON attendance FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. PAYROLL ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  staff_name    TEXT NOT NULL,
  month         TEXT NOT NULL,          -- e.g. '2025-07'
  salary        NUMERIC(10,2) DEFAULT 0,
  days_worked   INTEGER DEFAULT 0,
  days_total    INTEGER DEFAULT 26,
  advance       NUMERIC(10,2) DEFAULT 0,
  deductions    NUMERIC(10,2) DEFAULT 0,
  bonus         NUMERIC(10,2) DEFAULT 0,
  net_pay       NUMERIC(10,2) DEFAULT 0,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_on       DATE,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payroll_tenant ON payroll(tenant_id, month DESC);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_all" ON payroll FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TRIGGER trg_payroll_ts BEFORE UPDATE ON payroll
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 3. SALARY CONFIG (per staff member) ───────────────────────
CREATE TABLE IF NOT EXISTS staff_config (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID UNIQUE REFERENCES users(id),
  staff_name    TEXT NOT NULL,
  monthly_salary NUMERIC(10,2) DEFAULT 0,
  working_days   INTEGER DEFAULT 26,
  advance_balance NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_config_all" ON staff_config FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TRIGGER trg_staff_config_ts BEFORE UPDATE ON staff_config
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 4. LOYALTY TRANSACTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_txns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id     UUID REFERENCES sales(id),
  txn_type    TEXT NOT NULL CHECK (txn_type IN ('earn','redeem','adjust')),
  points      INTEGER NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_loyalty_tenant   ON loyalty_txns(tenant_id);
CREATE INDEX idx_loyalty_customer ON loyalty_txns(customer_id);

ALTER TABLE loyalty_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_all" ON loyalty_txns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 5. ADD LOYALTY CONFIG TO TENANTS ──────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS loyalty_rate   NUMERIC(5,2) DEFAULT 1;   -- points per ₹100
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS loyalty_redeem NUMERIC(5,2) DEFAULT 1;   -- ₹ per point
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT FALSE;

-- ── 6. WHATSAPP CONFIG IN TENANTS ─────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_phone_id   TEXT;  -- WhatsApp Phone Number ID
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_token      TEXT;  -- WhatsApp Access Token
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_template   TEXT DEFAULT 'invoice_notification';
